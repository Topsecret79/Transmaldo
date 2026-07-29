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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lista blanca de tablas permitidas y, para cada una, la única columna por la
// que se permite filtrar el borrado. Cualquier otra combinación se rechaza.
const ALLOWED: Record<string, string> = {
  delivery_tickets: 'id',
  delivery_shifts: 'id',
  delivery_tariffs: 'id',
  delivery_settings: 'key',
};

const MAX_VALUES = 500; // límite defensivo por petición

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { table, values } = await req.json();

    const column = ALLOWED[table];
    if (!column) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tabla no permitida.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
