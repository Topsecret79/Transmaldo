// Edge Function: secure-delete
//
// Objetivo de seguridad: centralizar TODOS los borrados de delivery_tickets,
// delivery_shifts, delivery_tariffs y delivery_settings aquí, usando la clave
// de servicio (nunca expuesta al navegador). Así, estas 4 tablas pueden
// protegerse con RLS SIN conceder permiso de DELETE a la clave pública (anon):
// la app sigue pudiendo borrar filas concretas suyas a través de esta función,
// pero nadie puede mandarle a Supabase directamente un "borra todo" con la
// clave pública, porque esa clave ya no tiene permiso de borrado en absoluto
// sobre estas tablas.
//
// Solo permite borrar por una lista de valores concretos de una columna
// concreta (id, o key para delivery_settings) — nunca un borrado sin filtro.
//
// SEGURIDAD: requiere cabecera Authorization con un JWT válido de Supabase.
// Peticiones sin token o con token inválido reciben HTTP 401.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-user-id, x-app-token',
};

// Lista blanca de tablas permitidas y, para cada una, la única columna por la
// que se permite filtrar el borrado. Cualquier otra combinación se rechaza.
const ALLOWED: Record<string, string> = {
  delivery_tickets: 'id',
  delivery_shifts: 'id',
  delivery_tariffs: 'id',
  delivery_settings: 'key',
};

// Permisos de borrado por rol de usuario
const ROLE_ALLOWED_TABLES: Record<string, string[]> = {
  superadmin: ['delivery_tickets', 'delivery_shifts', 'delivery_tariffs', 'delivery_settings'],
  admin: ['delivery_tickets', 'delivery_shifts', 'delivery_tariffs', 'delivery_settings'],
  coordinador: ['delivery_tickets', 'delivery_shifts', 'delivery_tariffs', 'delivery_settings'],
  repartidor: ['delivery_tickets', 'delivery_shifts'],
};

const MAX_VALUES = 500; // límite defensivo por petición

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64UrlToText(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// Verifica el token HMAC-SHA256 emitido por verify-login
async function verifyAppSessionToken(
  token: string,
  secret: string
): Promise<{ sub: string; role?: string; exp: number } | null> {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const expectedSigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
    const expectedSigB64 = toBase64Url(new Uint8Array(expectedSigBuffer));

    // Comparación en tiempo constante para evitar ataques de temporización
    if (expectedSigB64.length !== sigB64.length) return null;
    let diff = 0;
    for (let i = 0; i < expectedSigB64.length; i++) {
      diff |= expectedSigB64.charCodeAt(i) ^ sigB64.charCodeAt(i);
    }
    if (diff !== 0) return null;

    const payload = JSON.parse(fromBase64UrlToText(payloadB64));
    if (!payload || typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
      return null;
    }
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── AUTENTICACIÓN: verificar JWT de Supabase Auth o token HMAC firmado ─────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ success: false, error: 'No autorizado. Se requiere token de sesión.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const jwt = authHeader.replace('Bearer ', '').trim();
  if (!jwt) {
    return new Response(
      JSON.stringify({ success: false, error: 'No autorizado. Token vacío.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // 1) Intentar autenticar como usuario real de Supabase Auth (administradores con correo)
  const supabaseAnon = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );

  const { data: { user: authUser } } = await supabaseAnon.auth.getUser();
  let verifiedRole: string | null = null;
  let verifiedUserId: string | null = null;

  if (authUser) {
    verifiedUserId = authUser.id;
    verifiedRole = 'admin';
    try {
      const { data: profileRows } = await supabaseAdmin
        .from('delivery_users')
        .select('id, role, active')
        .eq('auth_uid', authUser.id)
        .limit(1);
      const profile = profileRows && profileRows[0];
      if (profile) {
        if (profile.active === false) {
          return new Response(
            JSON.stringify({ success: false, error: 'No autorizado. Cuenta desactivada.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        verifiedUserId = String(profile.id);
        verifiedRole = String(profile.role || 'admin');
      }
    } catch (_) {}
  } else {
    // 2) Usuario sin correo: exigir token HMAC-SHA256 firmado en verify-login + verificar usuario activo en BD
    const appToken = (req.headers.get('x-app-token') || '').trim();
    const appUserIdHeader = (req.headers.get('x-app-user-id') || '').trim();
    const signingSecret = Deno.env.get('APP_SESSION_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const tokenPayload = await verifyAppSessionToken(appToken, signingSecret);

    if (!tokenPayload || (appUserIdHeader && appUserIdHeader !== tokenPayload.sub)) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado. Token de sesión inválido o expirado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: dbUser, error: dbUserErr } = await supabaseAdmin
      .from('delivery_users')
      .select('id, role, active')
      .eq('id', tokenPayload.sub)
      .maybeSingle();

    if (dbUserErr || !dbUser || dbUser.active === false) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado. Usuario no encontrado o inactivo.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    verifiedUserId = String(dbUser.id);
    verifiedRole = String(dbUser.role || 'repartidor');
  }

  if (!verifiedUserId || !verifiedRole) {
    return new Response(
      JSON.stringify({ success: false, error: 'No autorizado.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  // ── FIN AUTENTICACIÓN ──────────────────────────────────────────────────────

  try {
    const { table, values } = await req.json();

    const column = ALLOWED[table];
    if (!column) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tabla no permitida.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedForRole = ROLE_ALLOWED_TABLES[verifiedRole] || [];
    if (!allowedForRole.includes(table)) {
      return new Response(
        JSON.stringify({ success: false, error: `Tu rol (${verifiedRole}) no tiene permiso para borrar en ${table}.` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(values) || values.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Debes indicar al menos un valor a borrar.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (values.length > MAX_VALUES) {
      return new Response(
        JSON.stringify({ success: false, error: `No se pueden borrar más de ${MAX_VALUES} filas en una sola petición.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!values.every((v: unknown) => typeof v === 'string' && v.length > 0)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valores de borrado no válidos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error } = await supabaseAdmin.from(table).delete().in(column, values);

    if (error) {
      console.error(`Error borrando en ${table}:`, error);
      return new Response(
        JSON.stringify({ success: false, error: 'Error de servidor al borrar. Inténtalo de nuevo.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error inesperado en secure-delete:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error inesperado. Inténtalo de nuevo.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
