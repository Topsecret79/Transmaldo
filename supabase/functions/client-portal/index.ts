// Edge Function: client-portal
//
// Portal de solo lectura para empresas cliente (cliente.html).
// Recibe credenciales + filtros y devuelve los tickets de la empresa
// correspondiente, sin exponer datos de otras empresas ni precios internos.
//
// Flujo:
//   1. Autenticar usuario en delivery_users (mismo mecanismo que verify-login)
//   2. Determinar la empresa (provider) asociada al usuario
//   3. Consultar delivery_tickets filtrados por proveedor, rango de fechas,
//      furgo y texto de búsqueda
//   4. Devolver { company, tickets, furgos, total, count }
//
// Mapeo company ↔ provider:
//   corte_ingles → provider = 'eci'
//   dormity      → provider = 'dormity'
//
// La empresa del usuario se lee de (en orden de prioridad):
//   1. Campo `permissions` JSON del usuario: { "clientCompany": "corte_ingles" }
//   2. Campo `allowed_providers` de delivery_settings si existe
//   3. Fallback: inferido a partir de allowed_providers del usuario

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isSHA256(str: string | null | undefined): boolean {
  return !!str && /^[a-f0-9]{64}$/i.test(str);
}

// Mapeo provider (valor en BD) → company key (devuelto al cliente)
const PROVIDER_TO_COMPANY: Record<string, string> = {
  eci: 'corte_ingles',
  dormity: 'dormity',
};

// Mapeo inverso: company key → provider en BD
const COMPANY_TO_PROVIDER: Record<string, string> = {
  corte_ingles: 'eci',
  dormity: 'dormity',
};

function parseFailedChargeType(notesText: string | null | undefined): string {
  if (!notesText) return 'none';
  const match = notesText.match(/\[CobroFallo:\s*([^\]]+)\]/);
  return match ? match[1].trim() : 'none';
}

const CHARGE_TYPE_TO_TARIFF: Record<string, string> = {
  pv: 'ENTREGA_PV',
  gv: 'ENTREGA_GV',
  tv_small: 'TV_ENT_49',
  tv_large: 'TV_ENT_74',
};


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { username, password, dateFrom, dateTo, search = '', furgo = '' } = body;

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Credenciales requeridas.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obtener tarifas para calcular cobros de fallidos
    const { data: tariffs } = await supabase
      .from('delivery_tariffs')
      .select('id, value');

    const tariffsMap: Record<string, number> = {};
    if (tariffs) {
      for (const t of tariffs) {
        tariffsMap[t.id] = Number(t.value) || 0;
      }
    }


    // ── 1. AUTENTICAR ──────────────────────────────────────────────────────────
    const { data: matches, error: userError } = await supabase
      .from('delivery_users')
      .select('id, username, password, label, role, active, permissions')
      .ilike('username', username);

    if (userError) {
      console.error('Error consultando delivery_users:', userError);
      return new Response(
        JSON.stringify({ error: 'Error de servidor.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hashedInput = await hashPassword(password);
    const found = (matches || []).find(
      (u: any) => u.password === password || u.password === hashedInput
    );

    if (!found) {
      return new Response(
        JSON.stringify({ error: 'Usuario o contraseña incorrectos.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (found.active === false) {
      return new Response(
        JSON.stringify({ error: 'Esta cuenta está desactivada.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Migración silenciosa de contraseña a hash si aún era texto plano
    if (!isSHA256(found.password)) {
      await supabase
        .from('delivery_users')
        .update({ password: hashedInput })
        .eq('id', found.id);
    }

    // ── 2. DETERMINAR EMPRESA (provider) ──────────────────────────────────────
    // Prioridad 1: campo permissions JSON  { "clientCompany": "corte_ingles" }
    let company: string | null = null;
    if (found.permissions) {
      try {
        const perms = typeof found.permissions === 'string'
          ? JSON.parse(found.permissions)
          : found.permissions;
        if (perms?.clientCompany) company = perms.clientCompany;
      } catch (_) { /* ignorar JSON malformado */ }
    }

    // Prioridad 2: allowed_providers del usuario (columna directa o delivery_settings)
    if (!company) {
      // Intentar leer de delivery_settings: clave client_company_<id>
      const { data: settingRow } = await supabase
        .from('delivery_settings')
        .select('value')
        .eq('key', `client_company_${found.id}`)
        .maybeSingle();
      if (settingRow?.value) {
        company = settingRow.value;
      }
    }


    // Sin empresa configurada → acceso denegado (el usuario no es un cliente)
    if (!company) {
      return new Response(
        JSON.stringify({ error: 'Este usuario no tiene acceso al portal de cliente.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const provider = COMPANY_TO_PROVIDER[company] ?? company;

    // ── 3. CONSULTAR TICKETS ──────────────────────────────────────────────────
    // La tabla no tiene columna `provider`: el tipo de empresa se deduce del
    // tariffId de las tareas:
    //   - Dormity  → tariffId empieza por 'DORMITY_'
    //   - ECI      → cualquier otro tariffId (TV_ENT_, TV_REC_, ENTREGA_GV, etc.)
    let query = supabase
      .from('delivery_tickets')
      .select('id, date, furgo_id, furgo_label, route_name, customer_name, address, tasks, total_price, status, created_at, notes')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });


    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo)   query = query.lte('date', dateTo);
    if (furgo)    query = query.eq('furgo_id', furgo);

    const { data: tickets, error: ticketsError } = await query;

    if (ticketsError) {
      console.error('Error consultando delivery_tickets:', ticketsError);
      return new Response(
        JSON.stringify({ error: 'Error al cargar los repartos.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filtrar por empresa
    const isDormityTicket = (t: any) => {
      // 1. Si la furgoneta/ruta contiene "dormity"
      const furgo = String(t.furgo_id || '').toLowerCase();
      const label = String(t.furgo_label || '').toLowerCase();
      if (furgo.includes('dormity') || label.includes('dormity')) {
        return true;
      }
      // 2. Si las tareas son de Dormity
      if (Array.isArray(t.tasks) && t.tasks.length > 0) {
        return t.tasks.some((task: any) => (task.tariffId || '').startsWith('DORMITY_'));
      }
      return false;
    };

    let filtered = (tickets || []).filter((t: any) => {
      if (company === 'dormity') return isDormityTicket(t);
      return !isDormityTicket(t); // corte_ingles = todo lo que no es Dormity
    });

    // Ajustar precios sobre la marcha para alinearlos con el dashboard de administración
    // (Solo los tickets exitosos o sin estado se facturan)
    for (const t of filtered) {
      const isSuccess = t.status === 'success' || !t.status;
      if (!isSuccess) {
        t.total_price = 0;
      }
    }



    // Búsqueda de texto en cliente, dirección (se hace en JS porque ilike
    // con OR en Supabase requiere sintaxis especial)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((t: any) =>
        (t.customer_name || '').toLowerCase().includes(q) ||
        (t.address || '').toLowerCase().includes(q)
      );
    }

    // ── 4. CALCULAR RESUMEN ───────────────────────────────────────────────────
    const total = filtered.reduce((sum: number, t: any) => sum + (Number(t.total_price) || 0), 0);
    const count = filtered.length;

    // Lista de furgonetas únicas presentes en los resultados (para el selector
    // de rutas del panel cliente)
    const furgosMap: Record<string, string> = {};
    for (const t of filtered) {
      if (t.furgo_id && !furgosMap[t.furgo_id]) {
        furgosMap[t.furgo_id] = t.furgo_label || t.furgo_id;
      }
    }
    const furgos = Object.entries(furgosMap).map(([id, label]) => ({ id, label }));

    // ── 5. RESPUESTA ──────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ company, tickets: filtered, furgos, total, count }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error inesperado en client-portal:', err);
    return new Response(
      JSON.stringify({ error: 'Error inesperado. Inténtalo de nuevo.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
