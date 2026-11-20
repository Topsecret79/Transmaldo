// Edge Function: verify-login
//
// Objetivo de seguridad: comprobar la contraseña del login clásico (usuario +
// contraseña, sin correo) DENTRO de Supabase, usando la clave de servicio
// (SERVICE_ROLE_KEY), que nunca se expone al navegador. Así, la columna
// `password` de `delivery_users` puede bloquearse por completo para la clave
// pública (anon) sin romper el login: el navegador ya no necesita leer esa
// columna directamente, solo llama a esta función y recibe un sí/no.
//
// Nunca se devuelve el valor de `password` en la respuesta, en ningún caso.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-user-id, x-app-token',
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// Firma un token de sesión HMAC-SHA256 con caducidad (30 días) para usuarios sin correo (repartidores / coordinadores)
async function signAppSessionToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(JSON.stringify(payload));
  const payloadB64 = toBase64Url(payloadBytes);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sigBuffer));
  return `${payloadB64}.${sigB64}`;
}

// Replica exacta del hashPassword() del cliente (SHA-256 vía Web Crypto,
// disponible de forma nativa en el runtime Deno de las Edge Functions).
async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isSHA256(str: string | null | undefined): boolean {
  return !!str && /^[a-f0-9]{64}$/i.test(str);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario o contraseña incorrectos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: matches, error } = await supabaseAdmin
      .from('delivery_users')
      .select('id, username, password, label, role, can_search, created_by, email, auth_uid, active, permissions')
      .ilike('username', username);

    if (error) {
      console.error('Error consultando delivery_users:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Error de servidor. Inténtalo de nuevo.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hashedInput = await hashPassword(password);
    const found = (matches || []).find(
      (u) => u.password === password || u.password === hashedInput
    );

    // Mensaje genérico tanto si el usuario no existe como si la contraseña no
    // coincide, para no revelar qué nombres de usuario están registrados.
    if (!found) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario o contraseña incorrectos.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Migración transparente: si la contraseña seguía en texto plano, se
    // actualiza aquí mismo a su versión con hash SHA-256, sin exponer nunca
    // el valor al navegador.
    if (!isSHA256(found.password)) {
      await supabaseAdmin
        .from('delivery_users')
        .update({ password: hashedInput })
        .eq('id', found.id);
    }

    if (found.active === false) {
      return new Response(
        JSON.stringify({ success: false, error: 'Esta cuenta está desactivada. Contacta con tu administrador.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generar token firmado criptográficamente (HMAC-SHA256) con caducidad de 30 días
    const signingSecret = Deno.env.get('APP_SESSION_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const appToken = signingSecret
      ? await signAppSessionToken(
          {
            sub: String(found.id),
            username: String(found.username || ''),
            role: String(found.role || 'repartidor'),
            exp: Date.now() + 30 * 24 * 3600 * 1000,
          },
          signingSecret
        )
      : null;

    // Objeto de usuario seguro para el navegador: SIN el campo password.
    // Nota: must_change_password / allowed_providers no existen como columnas
    // en esta tabla en producción (se gestionan aparte, vía delivery_settings)
    // — se devuelven con sus valores por defecto. `permissions` sí existe
    // (columna añadida el 29 jul 2026) y se lee de verdad.
    const safeUser = {
      id: found.id,
      username: found.username,
      label: found.label,
      role: found.role,
      canSearch: found.can_search || false,
      createdBy: found.created_by || 'admin',
      mustChangePassword: false,
      permissions: found.permissions || null,
      allowedProviders: ['eci', 'dormity'],
      email: found.email || null,
      auth_uid: found.auth_uid || null,
      active: found.active !== false,
      ...(appToken ? { appToken } : {}),
    };

    return new Response(
      JSON.stringify({ success: true, user: safeUser, appToken }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error inesperado en verify-login:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Error inesperado. Inténtalo de nuevo.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
