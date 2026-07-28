// db.js - Gestión de base de datos local y lógica de negocio en localStorage
import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://neskvzjfwjgbhasboxfh.supabase.co';
const defaultKey = 'sb_publishable_hCm0ONw6mBihfXHHW23wfQ_-aGIA4uX';

let supabase = null;
const storedUrl = localStorage.getItem('supabase_url');
const storedKey = localStorage.getItem('supabase_key');

const activeUrl = storedUrl === 'none' ? null : (storedUrl || defaultUrl);
const activeKey = storedUrl === 'none' ? null : (storedKey || defaultKey);

if (activeUrl && activeKey) {
  try {
    supabase = createClient(activeUrl, activeKey);
  } catch (e) {
    console.error("Error initializing Supabase client:", e);
  }
}

export function getSupabaseClient() {
  return supabase;
}

let isSyncing = false;
let realtimeChannel = null;

// Agrupa (debounce) las sincronizaciones disparadas por Realtime: si llegan varios cambios
// seguidos (varios tickets, ajustes, etc.) en una ráfaga, solo se ejecuta UNA sincronización
// al final de la ráfaga en lugar de una por cada evento. Además solo se vuelve a pedir la
// tabla delivery_tickets (la más pesada, ~43 MB) si alguno de los cambios de la ráfaga era
// realmente sobre esa tabla.
let syncDebounceTimer = null;
let syncDebouncePendingTickets = false;
const SYNC_DEBOUNCE_MS = 4000;

function scheduleSyncFromCloud(changedTable) {
  if (changedTable === 'delivery_tickets') {
    syncDebouncePendingTickets = true;
  }
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }
  syncDebounceTimer = setTimeout(() => {
    const includeTickets = syncDebouncePendingTickets;
    syncDebounceTimer = null;
    syncDebouncePendingTickets = false;
    syncFromCloud(includeTickets);
  }, SYNC_DEBOUNCE_MS);
}

// Fix: isSaving era un booleano global compartido por 6 funciones de guardado
// distintas (tarifas, tickets, turnos, tarifas dormity, borrado de tarifas, usuarios).
// Al ser un simple true/false, si dos guardados se solapaban, el que terminaba antes
// podía dejarlo en false mientras el otro seguía en curso (o viceversa), y mientras
// tanto syncFromCloud()/reinitSupabase() se saltaban el pull por completo (ver más
// abajo) sin encolar ni reintentar. Ahora es un contador: cada guardado que empieza
// suma 1 y el que termina resta 1, así que solo llega a 0 cuando de verdad no hay
// ningún guardado en curso.
export let isSaving = 0;
export function setIsSaving(val) {
  if (val) {
    isSaving++;
  } else {
    isSaving = Math.max(0, isSaving - 1);
  }
}

// Fix (fuga de egress): reinitSupabase() se llamaba cada 15s (temporizador) + en cada
// cambio de pestaña/foco de la ventana, y CADA vez reconstruía el cliente entero,
// tiraba y recreaba el canal de Realtime, y volvía a descargar las 5 tablas completas
// (incluida delivery_tickets, ~43 MB según el comentario de más abajo). Con varios
// dispositivos con la app abierta (aunque fuera en segundo plano), esto se multiplicaba
// sin parar, día y noche — es la causa confirmada de superar el límite de egress del
// plan gratuito de Supabase. Realtime + el debounce ya existente (ver
// scheduleSyncFromCloud) se encargan de mantener los datos al día ante cambios reales;
// el temporizador y los eventos de foco/visibilidad solo necesitan actuar como red de
// seguridad, no repetir el trabajo pesado constantemente. Por eso: solo se ejecuta la
// reconstrucción completa si el canal de Realtime está realmente caído, o si ha pasado
// al menos REINIT_MIN_INTERVAL_MS desde la última vez que se hizo de verdad.
const REINIT_MIN_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos
let lastFullReinitAt = 0;

function isRealtimeChannelHealthy() {
  return !!(realtimeChannel && realtimeChannel.state === 'joined');
}

export async function reinitSupabase(force = false) {
  if (!force && isRealtimeChannelHealthy() && (Date.now() - lastFullReinitAt) < REINIT_MIN_INTERVAL_MS) {
    // El canal en tiempo real está sano y ya hicimos una reconstrucción completa hace
    // poco: no hay motivo para recrear cliente/canal/descargar todo otra vez.
    return;
  }
  if (isSyncing || isSaving > 0) return;
  isSyncing = true;
  try {
    const url = localStorage.getItem('supabase_url');
    const key = localStorage.getItem('supabase_key');
    
    const activeUrl = url === 'none' ? null : (url || defaultUrl);
    const activeKey = url === 'none' ? null : (key || defaultKey);
    
    if (activeUrl && activeKey) {
      try {
        const oldClient = supabase;
        supabase = createClient(activeUrl, activeKey);
        
        try {
          if (realtimeChannel && oldClient) {
            oldClient.removeChannel(realtimeChannel);
          }
        } catch (err) {}

        try {
          realtimeChannel = supabase
            .channel('delivery-realtime-sync')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
              console.log("Realtime payload received:", payload);
              if (payload.table === 'delivery_settings') {
                const record = payload.new || {};
                if (record.key && record.key.startsWith('loc_')) {
                  const fid = record.key.substring(4);
                  console.log("Realtime GPS update received for driver:", fid, record.value);
                  try {
                    const val = JSON.parse(record.value);
                    const locations = JSON.parse(localStorage.getItem('delivery_driver_locations')) || {};
                    locations[fid] = {
                      lat: parseFloat(val.lat),
                      lng: parseFloat(val.lng),
                      updatedAt: val.updatedAt || val.timestamp
                    };
                    localStorage.setItem('delivery_driver_locations', JSON.stringify(locations));

                    window.dispatchEvent(new CustomEvent('driver-location-updated', { detail: { fid, lat: val.lat, lng: val.lng } }));
                  } catch (e) {
                    console.error("Error parsing realtime driver location:", e);
                  }
                  return;
                }
              }
              // Antes: cada cambio en CUALQUIER tabla llamaba a syncFromCloud() de inmediato,
              // que siempre volvía a descargar las 5 tablas completas (incluida delivery_tickets,
              // ~43 MB). Con varios dispositivos conectados esto multiplicaba el tráfico y fue
              // la causa principal del exceso de egress. Ahora se agrupan los cambios que llegan
              // en ráfaga (p.ej. varios tickets seguidos) en una sola sincronización, y solo se
              // vuelve a pedir la tabla de tickets si de verdad hubo un cambio en delivery_tickets.
              scheduleSyncFromCloud(payload.table);
            })
            .subscribe();
        } catch (err) {
          console.error("Error subscribing to Supabase Realtime:", err);
        }

        await initializeSupabaseTables();
        await syncFromCloud();
      } catch (e) {
        console.error("Error re-initializing Supabase client:", e);
        supabase = null;
      }
    } else {
      supabase = null;
    }
  } finally {
    isSyncing = false;
    lastFullReinitAt = Date.now();
  }
}

let onDataSyncCallback = null;

export function onDataSync(callback) {
  onDataSyncCallback = callback;
}

function notifySync() {
  if (onDataSyncCallback) {
    onDataSyncCallback();
  }
}

export async function initializeSupabaseTables() {
  if (!supabase) return;
  try {
    // 1. Check if users are empty in cloud, if so seed from local
    const { data: cloudUsers } = await supabase.from('delivery_users').select('id');
    if (!cloudUsers || cloudUsers.length === 0) {
      const localUsers = JSON.parse(localStorage.getItem('delivery_users')) || [];
      if (localUsers.length > 0) {
        // Fix: ningún envío de esta función comprobaba `error`. Un fallo aquí (columna
        // inexistente, RLS, restricción de unicidad) pasaba completamente inadvertido:
        // ni consola, ni excepción, nada. Se añade el mismo chequeo que ya usan
        // saveTariffs()/saveTickets() en el resto del archivo.
        const { error } = await supabase.from('delivery_users').insert(localUsers.map(u => ({
          id: u.id,
          username: u.username,
          password: u.password,
          label: u.label,
          role: u.role,
          can_search: u.canSearch || false
        })));
        if (error) console.error("Error sembrando delivery_users en Supabase:", error);
      }
    }

    // 2. Check if tariffs are empty, seed from local
    const { data: cloudTariffs } = await supabase.from('delivery_tariffs').select('id');
    if (!cloudTariffs || cloudTariffs.length === 0) {
      const localTariffs = JSON.parse(localStorage.getItem('delivery_tariffs')) || [];
      if (localTariffs.length > 0) {
        // Fix: se mandaba el objeto de tarifa tal cual venía de localStorage, que puede
        // llevar el campo `createdBy` (camelCase) una vez ha pasado por saveTariffs() /
        // syncFromCloud() — esa columna no existe en delivery_tariffs (la real es
        // `created_by`), así que el envío entero fallaría. Se aplica el mismo whitelist
        // explícito de columnas reales que ya usa saveTariffs().
        const dbFormatted = localTariffs.map(t => ({
          id: t.id,
          name: t.name,
          block: t.block,
          type: t.type,
          value: t.value,
          created_by: t.createdBy || t.created_by || null
        }));
        const { error } = await supabase.from('delivery_tariffs').insert(dbFormatted);
        if (error) console.error("Error sembrando delivery_tariffs en Supabase:", error);
      }
    }

    // 3. Check if tickets are empty, seed from local
    const { data: cloudTickets } = await supabase.from('delivery_tickets').select('id');
    if (!cloudTickets || cloudTickets.length === 0) {
      const localTickets = JSON.parse(localStorage.getItem('delivery_tickets')) || [];
      if (localTickets.length > 0) {
        const formatted = localTickets.map(t => ({
          id: t.id,
          date: t.date,
          furgo_id: t.furgoId,
          furgo_label: t.furgoLabel,
          route_name: t.routeName,
          customer_name: t.customerName,
          phone: t.phone,
          address: t.address,
          postcode: t.postcode,
          notes: t.notes,
          cod_amount: t.codAmount,
          tasks: t.tasks,
          total_price: t.totalPrice,
          status: t.status,
          failure_reason: t.failureReason || '',
          lat: t.lat,
          lng: t.lng,
          completed_lat: t.completedLat,
          completed_lng: t.completedLng,
          route_order: t.routeOrder,
          created_at: t.createdAt,
          created_by: t.createdBy || null
        }));
        const { error } = await supabase.from('delivery_tickets').insert(formatted);
        if (error) console.error("Error sembrando delivery_tickets en Supabase:", error);
      }
    }

    // 4. Check if shifts are empty, seed from local
    const { data: cloudShifts } = await supabase.from('delivery_shifts').select('id');
    if (!cloudShifts || cloudShifts.length === 0) {
      const localShifts = JSON.parse(localStorage.getItem('delivery_shifts')) || [];
      if (localShifts.length > 0) {
        const formatted = localShifts.map(s => ({
          id: s.id,
          furgo_id: s.furgoId,
          date: s.date,
          status: s.status,
          opened_at: s.openedAt || null,
          closed_at: s.closedAt || null,
          created_by: s.createdBy || 'admin'
        }));
        const { error } = await supabase.from('delivery_shifts').insert(formatted);
        if (error) console.error("Error sembrando delivery_shifts en Supabase:", error);
      }
    }

    // 5. Seed settings
    const { data: cloudSettings } = await supabase.from('delivery_settings').select('key');
    if (!cloudSettings || cloudSettings.length === 0) {
      const mPrice = parseFloat(localStorage.getItem('delivery_module_price')) || 3.81;
      const appName = localStorage.getItem('delivery_app_name') || 'My Delivery Team';
      const startAddr = localStorage.getItem('delivery_default_start_addr') || 'Barcelona, España';
      const endAddr = localStorage.getItem('delivery_default_end_addr') || 'Barcelona, España';
      const { error } = await supabase.from('delivery_settings').insert([
        { key: 'module_price', value: mPrice.toString() },
        { key: 'app_name', value: appName },
        { key: 'default_start_addr', value: startAddr },
        { key: 'default_end_addr', value: endAddr }
      ]);
      if (error) console.error("Error sembrando delivery_settings en Supabase:", error);
    } else {
      const keys = cloudSettings.map(s => s.key);
      const toInsert = [];
      if (!keys.includes('default_start_addr')) {
        toInsert.push({ key: 'default_start_addr', value: localStorage.getItem('delivery_default_start_addr') || 'Barcelona, España' });
      }
      if (!keys.includes('default_end_addr')) {
        toInsert.push({ key: 'default_end_addr', value: localStorage.getItem('delivery_default_end_addr') || 'Barcelona, España' });
      }
      if (!keys.includes('google_maps_api_key')) {
        toInsert.push({ key: 'google_maps_api_key', value: '' });
      }
      if (!keys.includes('mapbox_access_token')) {
        toInsert.push({ key: 'mapbox_access_token', value: '' });
      }
      if (toInsert.length > 0) {
        const { error } = await supabase.from('delivery_settings').insert(toInsert);
        if (error) console.error("Error completando delivery_settings en Supabase:", error);
      }
    }
  } catch (e) {
    console.error("Error seeding Supabase tables:", e);
  }
}

export async function syncFromCloud(includeTickets = true, retriesLeft = 3) {
  if (!supabase) return;
  if (isSaving > 0) {
    // Fix: antes, si justo en ese momento había un guardado en curso, este ciclo de
    // sincronización se abortaba sin más — no se perdía solo esa vez, se perdía del
    // todo, sin reintento ni aviso. Ahora reprogramamos un reintento corto (hasta 3
    // veces) en vez de descartarlo directamente.
    if (retriesLeft > 0) {
      setTimeout(() => syncFromCloud(includeTickets, retriesLeft - 1), 2000);
    }
    return;
  }
  try {
    // Pull settings first so we can use them for user permissions fallback if needed.
    // Fix: paginado por el mismo motivo que delivery_tickets (ver más abajo) — hoy
    // delivery_settings tiene muchas menos filas que el límite de 1000 por petición,
    // pero crece con cada turno/ruta y en algún momento lo cruzaría igual, así que se
    // blinda de una vez con el mismo patrón.
    let settings = [];
    let errSettings = null;
    {
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data: page, error: pageErr } = await supabase
          .from('delivery_settings')
          .select('*')
          .order('key', { ascending: true })
          .range(from, from + pageSize - 1);
        if (pageErr) {
          console.error("Error paginando delivery_settings:", pageErr);
          errSettings = pageErr;
          break;
        }
        if (!page || page.length === 0) break;
        settings = settings.concat(page);
        if (page.length < pageSize) break;
        from += pageSize;
      }
    }

    // Pull Users
    // Fix: mismo motivo que delivery_tickets/delivery_settings/delivery_shifts —
    // select('*') sin paginar se corta en silencio a las 1000 filas que PostgREST
    // devuelve por defecto. Hoy delivery_users tiene muchas menos filas que ese
    // límite, pero crece con cada empleado/chofer nuevo, así que se pagina igual
    // por consistencia y para blindarla antes de que se acerque al límite.
    let users = [];
    let errUsers = null;
    {
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data: page, error: pageErr } = await supabase
          .from('delivery_users')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (pageErr) {
          console.error("Error paginando delivery_users:", pageErr);
          errUsers = pageErr;
          break;
        }
        if (!page || page.length === 0) break;
        users = users.concat(page);
        if (page.length < pageSize) break;
        from += pageSize;
      }
    }
    if (users && !errUsers) {
      let localCurrent = [];
      try {
        localCurrent = JSON.parse(localStorage.getItem('delivery_users')) || [];
      } catch (e) {}

      const localUsers = users.map(u => {
        const existingLocal = localCurrent.find(lu => lu.id === u.id);
        
        let pVal = u.permissions;
        if (pVal === undefined || pVal === null) {
          const settingKey = `user_permissions_${u.id}`;
          const metaSetting = settings ? settings.find(s => s.key === settingKey) : null;
          if (metaSetting) {
            pVal = metaSetting.value;
          } else {
            pVal = existingLocal ? existingLocal.permissions : null;
          }
        }

        let allowedProvs = u.allowed_providers || u.allowedProviders;
        if (!allowedProvs || !Array.isArray(allowedProvs) || allowedProvs.length === 0) {
          const settingKey = `user_allowed_providers_${u.id}`;
          const provSetting = settings ? settings.find(s => s.key === settingKey) : null;
          if (provSetting && provSetting.value) {
            try {
              allowedProvs = JSON.parse(provSetting.value);
            } catch (e) {}
          }
          if ((!allowedProvs || !Array.isArray(allowedProvs) || allowedProvs.length === 0) && existingLocal && existingLocal.allowedProviders) {
            allowedProvs = existingLocal.allowedProviders;
          }
        }
        if (!allowedProvs || !Array.isArray(allowedProvs) || allowedProvs.length === 0) {
          allowedProvs = ['eci', 'dormity'];
        }

        return {
          id: u.id,
          username: u.username,
          password: u.password,
          label: u.label,
          role: u.role,
          canSearch: u.can_search || false,
          createdBy: u.created_by || 'admin',
          mustChangePassword: !!u.must_change_password,
          permissions: pVal,
          allowedProviders: allowedProvs,
          email: u.email || null,
          auth_uid: u.auth_uid || null,
          active: u.active !== false
        };
      });
      localStorage.setItem('delivery_users', JSON.stringify(localUsers));
    }

    // Pull Tariffs
    // Fix: mismo motivo que delivery_users justo arriba — delivery_tariffs crece
    // con cada administrador nuevo (cada uno recibe su propia copia del
    // catálogo), así que conviene protegerla antes de que se acerque al límite
    // de 1000 filas por petición.
    let tariffs = [];
    let errTariffs = null;
    {
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data: page, error: pageErr } = await supabase
          .from('delivery_tariffs')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (pageErr) {
          console.error("Error paginando delivery_tariffs:", pageErr);
          errTariffs = pageErr;
          break;
        }
        if (!page || page.length === 0) break;
        tariffs = tariffs.concat(page);
        if (page.length < pageSize) break;
        from += pageSize;
      }
    }
    if (tariffs && !errTariffs) {
      const localTariffs = tariffs.map(t => ({
        id: t.id,
        name: t.name,
        block: t.block,
        type: t.type,
        value: parseFloat(t.value) || 0,
        createdBy: t.created_by || null
      }));

      // Migrar soportes a tarifa fija (5.23 € / equivalente a TV pequeña)
      let needsSave = false;
      
      const sparItem = localTariffs.find(t => t.id === 'SPAR');
      if (sparItem && (sparItem.type !== 'fixed' || sparItem.value !== 5.23)) {
        sparItem.type = 'fixed';
        sparItem.value = 5.23;
        needsSave = true;
      }
      
      const ssueItem = localTariffs.find(t => t.id === 'SSUE');
      if (ssueItem && (ssueItem.type !== 'fixed' || ssueItem.value !== 5.23)) {
        ssueItem.type = 'fixed';
        ssueItem.value = 5.23;
        needsSave = true;
      }

      localStorage.setItem('delivery_tariffs', JSON.stringify(localTariffs));
      if (needsSave) {
        saveTariffs(localTariffs);
      }
    }

    // Pull Tickets (se omite si el cambio detectado por Realtime no afecta a delivery_tickets,
    // para no volver a descargar la tabla completa -principal causa de egress- en cada cambio menor)
    if (includeTickets) {
    // Fix: `select('*')` sin paginar se corta en silencio en las 1000 filas que
    // PostgREST devuelve por defecto por petición. Con más de 1000 repartos en la
    // tabla (ya superado), esto hacía que la app cargara solo una porción parcial y
    // variable de los repartos —nunca exactamente la misma— y cada pantalla (Informe
    // del Día, Gestión de Repartos, Dashboard, etc.) mostrara un conteo distinto e
    // incompleto sin ningún aviso. Se pagina explícitamente con .range() hasta traer
    // todas las filas, ordenando por id para que la paginación sea estable.
    let tickets = [];
    let errTickets = null;
    {
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data: page, error: pageErr } = await supabase
          .from('delivery_tickets')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (pageErr) {
          console.error("Error paginando delivery_tickets:", pageErr);
          errTickets = pageErr;
          break;
        }
        if (!page || page.length === 0) break;
        tickets = tickets.concat(page);
        if (page.length < pageSize) break;
        from += pageSize;
      }
    }
    if (tickets && !errTickets) {
      const cloudTickets = tickets.map(t => ({
        id: t.id,
        date: t.date,
        furgoId: t.furgo_id,
        furgoLabel: t.furgo_label,
        routeName: t.route_name,
        customerName: t.customer_name,
        phone: t.phone,
        address: t.address,
        postcode: t.postcode,
        notes: t.notes,
        codAmount: t.cod_amount,
        tasks: t.tasks,
        totalPrice: parseFloat(t.total_price) || 0,
        status: t.status,
        failureReason: t.failure_reason,
        lat: t.lat,
        lng: t.lng,
        completedLat: t.completed_lat,
        completedLng: t.completed_lng,
        routeOrder: t.route_order,
        createdAt: t.created_at,
        createdBy: t.created_by || 'admin'
      }));

      // Offline-First reconciliation: merge cloud tickets with pending local tickets
      let localCurrent = [];
      try {
        localCurrent = JSON.parse(localStorage.getItem('delivery_tickets')) || [];
      } catch (e) {}

      let deletedIds = [];
      try {
        deletedIds = JSON.parse(localStorage.getItem('delivery_deleted_tickets')) || [];
      } catch (e) {}

      // Fix: si el borrado remoto de un ticket falló una vez (red inestable), nunca
      // se reintentaba automáticamente — el ticket solo quedaba oculto en ESTE
      // dispositivo gracias al tombstone local. Un dispositivo nuevo (reinstalación,
      // caché borrada) no tiene ese tombstone y podía ver "revivir" un ticket que ya
      // se había borrado hace tiempo. Se reintenta aquí el borrado remoto pendiente
      // en cada sincronización, no solo la vez que se pidió borrar.
      const stillPendingDeleteIds = cloudTickets.filter(t => t && deletedIds.includes(t.id)).map(t => t.id);
      if (stillPendingDeleteIds.length > 0) {
        supabase.from('delivery_tickets').delete().in('id', stillPendingDeleteIds).then(({ error }) => {
          if (error) {
            console.error("Error reintentando borrado remoto pendiente de tickets:", error);
          } else {
            try {
              const current = JSON.parse(localStorage.getItem('delivery_deleted_tickets')) || [];
              localStorage.setItem('delivery_deleted_tickets', JSON.stringify(current.filter(id => !stillPendingDeleteIds.includes(id))));
            } catch (e) {}
          }
        });
      }

      const pendingLocal = localCurrent.filter(t => t && t._syncStatus === 'pending');
      const filteredCloud = cloudTickets.filter(t => t && !deletedIds.includes(t.id));

      const mergedTickets = [...filteredCloud];
      pendingLocal.forEach(localT => {
        const cloudIndex = mergedTickets.findIndex(t => t.id === localT.id);
        if (cloudIndex !== -1) {
          mergedTickets[cloudIndex] = localT;
        } else {
          mergedTickets.push(localT);
        }
      });

      localStorage.setItem('delivery_tickets', JSON.stringify(mergedTickets));
    }
    }

    // Pull Shifts
    // Fix: mismo problema que delivery_tickets/delivery_settings — select('*') sin
    // paginar se corta en silencio a las 1000 filas. delivery_shifts crece con cada
    // turno abierto/cerrado por cada furgoneta, así que se pagina igual por seguridad.
    let shifts = [];
    let errShifts = null;
    {
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data: page, error: pageErr } = await supabase
          .from('delivery_shifts')
          .select('*')
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (pageErr) {
          console.error("Error paginando delivery_shifts:", pageErr);
          errShifts = pageErr;
          break;
        }
        if (!page || page.length === 0) break;
        shifts = shifts.concat(page);
        if (page.length < pageSize) break;
        from += pageSize;
      }
    }

    if (shifts && !errShifts && settings && !errSettings) {
      // Load existing local shifts so we can preserve any pending/unsaved metadata
      let localExisting = [];
      try {
        localExisting = JSON.parse(localStorage.getItem('delivery_shifts')) || [];
      } catch (e) {}

      const cloudShifts = shifts.map(s => {
        const metaSetting = settings.find(set => set.key === `shift_meta_${s.id}`);
        let meta = {
          helper: '',
          helper2: '',
          matricula: '',
          customDriver: '',
          observations: '',
          routeName: '',
          kms: null,
          startKms: null,
          endKms: null,
          summary: null
        };
        if (metaSetting) {
          try {
            meta = { ...meta, ...JSON.parse(metaSetting.value) };
          } catch (e) {
            console.error("Error parsing shift meta:", e);
          }
        }
        return {
          id: s.id,
          furgoId: s.furgo_id,
          date: s.date,
          status: s.status,
          openedAt: s.opened_at,
          closedAt: s.closed_at,
          routeName: meta.routeName || '',
          summary: meta.summary || null,
          createdBy: s.created_by || 'admin',
          helper: meta.helper || '',
          helper2: meta.helper2 || '',
          matricula: meta.matricula || '',
          customDriver: meta.customDriver || '',
          observations: meta.observations || '',
          kms: meta.kms || null,
          startKms: meta.startKms || null,
          endKms: meta.endKms || null
        };
      });

      // Fix: los turnos borrados (deletePlannedShift/resetMonthlyShifts) no dejaban
      // ningún rastro local, así que si el borrado remoto fallaba o llegaba tarde,
      // el turno "borrado" volvía a aparecer solo en el siguiente sync. Se aplica
      // ahora el mismo tombstone que ya usan los tickets.
      let deletedShiftIds = [];
      try {
        deletedShiftIds = JSON.parse(localStorage.getItem('delivery_deleted_shifts')) || [];
      } catch (e) {}

      // Fix: mismo motivo que el reintento de borrado de tickets — si el borrado
      // remoto de un turno falló una vez, nunca se reintentaba automáticamente.
      const stillPendingDeleteShiftIds = cloudShifts.filter(s => s && deletedShiftIds.includes(s.id)).map(s => s.id);
      if (stillPendingDeleteShiftIds.length > 0) {
        supabase.from('delivery_shifts').delete().in('id', stillPendingDeleteShiftIds).then(({ error }) => {
          if (error) {
            console.error("Error reintentando borrado remoto pendiente de turnos:", error);
          } else {
            try {
              const current = JSON.parse(localStorage.getItem('delivery_deleted_shifts')) || [];
              localStorage.setItem('delivery_deleted_shifts', JSON.stringify(current.filter(id => !stillPendingDeleteShiftIds.includes(id))));
            } catch (e) {}
          }
        });
      }

      const filteredCloudShifts = cloudShifts.filter(s => s && !deletedShiftIds.includes(s.id));

      // Merge: start from cloud, but if local version has richer metadata (non-empty driver/plate)
      // and the cloud version is empty, prefer the local data to avoid losing unsaved state
      const mergedShifts = [...filteredCloudShifts];

      // Fix: antes esta protección solo miraba si customDriver/matricula estaban vacíos
      // en la nube. Cualquier otro cambio local pendiente (status, kms, fecha movida,
      // helper, etc.) podía perderse en silencio si un sync llegaba antes de que la
      // subida terminara o fallara. Igual que con los tickets (ver pendingLocal más
      // arriba), un turno marcado _syncStatus:'pending' localmente tiene ahora
      // prioridad total sobre lo que venga de la nube hasta que se confirme la subida.
      const pendingLocalShifts = localExisting.filter(s => s && s._syncStatus === 'pending');
      pendingLocalShifts.forEach(localS => {
        const cloudIdx = mergedShifts.findIndex(cs => cs.id === localS.id);
        if (cloudIdx !== -1) {
          mergedShifts[cloudIdx] = localS;
        } else {
          mergedShifts.push(localS);
        }
      });

      localExisting.forEach(localS => {
        if (localS._syncStatus === 'pending') return; // ya protegido arriba
        const cloudIdx = mergedShifts.findIndex(cs => cs.id === localS.id);
        if (cloudIdx !== -1) {
          const cloud = mergedShifts[cloudIdx];
          // If local has more complete metadata than cloud, keep the local values
          if (
            (localS.customDriver && !cloud.customDriver) ||
            (localS.matricula && !cloud.matricula)
          ) {
            mergedShifts[cloudIdx] = {
              ...cloud,
              customDriver: cloud.customDriver || localS.customDriver || '',
              matricula: cloud.matricula || localS.matricula || '',
              helper: cloud.helper || localS.helper || '',
              helper2: cloud.helper2 || localS.helper2 || '',
              observations: cloud.observations || localS.observations || '',
              routeName: cloud.routeName || localS.routeName || '',
              kms: cloud.kms || localS.kms || null,
              startKms: cloud.startKms || localS.startKms || null,
              endKms: cloud.endKms || localS.endKms || null,
              summary: cloud.summary || localS.summary || null
            };
          }
        } else {
          // Local shift not yet in cloud - keep it
          mergedShifts.push(localS);
        }
      });

      localStorage.setItem('delivery_shifts', JSON.stringify(mergedShifts));
    }

    if (settings && !errSettings) {
      let sessionUser = null;
      try {
        const savedUser = localStorage.getItem('delivery_session');
        if (savedUser) sessionUser = JSON.parse(savedUser);
      } catch (e) {}

      const userId = sessionUser ? sessionUser.id : null;

      // Module Price
      if (userId) {
        const mPriceKey = `module_price_${userId}`;
        let mPrice = settings.find(s => s.key === mPriceKey);
        if (!mPrice) {
          mPrice = settings.find(s => s.key === 'module_price');
        }
        if (mPrice) {
          localStorage.setItem(`delivery_module_price_${userId}`, JSON.stringify(parseFloat(mPrice.value)));
          localStorage.setItem('delivery_module_price', JSON.stringify(parseFloat(mPrice.value)));
        }
      }
      
      // App Name
      if (userId) {
        const appNameKey = `app_name_${userId}`;
        let appNameSetting = settings.find(s => s.key === appNameKey);
        if (!appNameSetting) {
          appNameSetting = settings.find(s => s.key === 'app_name');
        }
        if (appNameSetting) {
          let val = appNameSetting.value;
          if (val === 'My Delevery Team' || val === 'MY Delevery Team' || val.toLowerCase().includes('delevery')) {
            val = 'My Delivery Team';
            supabase.from('delivery_settings').upsert({ key: appNameSetting.key, value: 'My Delivery Team' }).then(() => {});
          }
          localStorage.setItem(`delivery_app_name_${userId}`, val);
          localStorage.setItem('delivery_app_name', val);
        }
      }

      // App Theme
      if (userId) {
        const themeKey = `app_theme_${userId}`;
        let themeSetting = settings.find(s => s.key === themeKey);
        if (!themeSetting) {
          themeSetting = settings.find(s => s.key === 'app_theme');
        }
        if (themeSetting) {
          localStorage.setItem(`delivery_app_theme_${userId}`, themeSetting.value);
          localStorage.setItem('delivery_app_theme', themeSetting.value);
        }
      }

      // Start & End Addresses
      if (userId) {
        const startKey = `default_start_addr_${userId}`;
        let startSetting = settings.find(s => s.key === startKey);
        if (!startSetting) {
          startSetting = settings.find(s => s.key === 'default_start_addr');
        }
        if (startSetting) {
          localStorage.setItem(`delivery_start_addr_${userId}`, startSetting.value);
          localStorage.setItem('delivery_default_start_addr', startSetting.value);
        }

        const endKey = `default_end_addr_${userId}`;
        let endSetting = settings.find(s => s.key === endKey);
        if (!endSetting) {
          endSetting = settings.find(s => s.key === 'default_end_addr');
        }
        if (endSetting) {
          localStorage.setItem(`delivery_end_addr_${userId}`, endSetting.value);
          localStorage.setItem('delivery_default_end_addr', endSetting.value);
        }
      }

      // Google Maps Key & Mapbox Token
      const googleKeySetting = settings.find(s => s.key === 'google_maps_api_key');
      if (googleKeySetting) {
        localStorage.setItem('delivery_google_maps_api_key', googleKeySetting.value);
      }
      const mapboxTokenSetting = settings.find(s => s.key === 'mapbox_access_token');
      if (mapboxTokenSetting) {
        localStorage.setItem('delivery_mapbox_access_token', mapboxTokenSetting.value);
      }

      // Resolver ID de administrador gestor para aislar configuraciones
      let adminId = 'admin';
      if (sessionUser) {
        if (sessionUser.role === 'admin' || sessionUser.role === 'superadmin') {
          adminId = sessionUser.id;
        } else if (sessionUser.role === 'repartidor') {
          const dbUser = users ? users.find(u => u.id === sessionUser.id) : null;
          adminId = dbUser ? (dbUser.created_by || 'admin') : (sessionUser.createdBy || 'admin');
        }
      }

      // Allow Driver Support Transfer
      const transferKey = `allow_driver_support_transfer_${adminId}`;
      let transferSetting = settings.find(s => s.key === transferKey);
      if (!transferSetting) {
        transferSetting = settings.find(s => s.key === 'allow_driver_support_transfer');
      }
      if (transferSetting) {
        localStorage.setItem(`delivery_allow_driver_support_transfer_${adminId}`, transferSetting.value);
        localStorage.setItem('delivery_allow_driver_support_transfer', transferSetting.value);
      }

      // Helpers List
      const helpersKey = `delivery_helpers_list_${adminId}`;
      let helpersSetting = settings.find(s => s.key === helpersKey);
      if (!helpersSetting) {
        helpersSetting = settings.find(s => s.key === 'delivery_helpers_list');
      }
      if (helpersSetting) {
        localStorage.setItem(`delivery_helpers_list_${adminId}`, helpersSetting.value);
        localStorage.setItem('delivery_helpers_list', helpersSetting.value);
      }

      // Plates List
      const platesKey = `delivery_plates_list_${adminId}`;
      let platesSetting = settings.find(s => s.key === platesKey);
      if (!platesSetting) {
        platesSetting = settings.find(s => s.key === 'delivery_plates_list');
      }
      if (platesSetting) {
        localStorage.setItem(`delivery_plates_list_${adminId}`, platesSetting.value);
        localStorage.setItem('delivery_plates_list', platesSetting.value);
      }

      // Employees List
      const empKey = `delivery_employees_list_${adminId}`;
      let empSetting = settings.find(s => s.key === empKey);
      if (!empSetting) {
        empSetting = settings.find(s => s.key === 'delivery_employees_list');
      }
      if (empSetting) {
        localStorage.setItem(`delivery_employees_list_${adminId}`, empSetting.value);
        localStorage.setItem('delivery_employees_list', empSetting.value);
      }

      // Fleet Vehicles
      const vehiclesKey = `fleet_vehicles_${adminId}`;
      let vehiclesSetting = settings.find(s => s.key === vehiclesKey);
      if (vehiclesSetting) {
        localStorage.setItem(`delivery_fleet_vehicles_${adminId}`, vehiclesSetting.value);
        localStorage.setItem('delivery_fleet_vehicles', vehiclesSetting.value);
      }

      // Fleet Fuel Logs
      const fuelKey = `fleet_fuel_logs_${adminId}`;
      let fuelSetting = settings.find(s => s.key === fuelKey);
      if (fuelSetting) {
        localStorage.setItem(`delivery_fleet_fuel_logs_${adminId}`, fuelSetting.value);
        localStorage.setItem('delivery_fleet_fuel_logs', fuelSetting.value);
      }

      // Fleet Maintenance Logs
      const maintKey = `fleet_maintenance_logs_${adminId}`;
      let maintSetting = settings.find(s => s.key === maintKey);
      if (maintSetting) {
        localStorage.setItem(`delivery_fleet_maintenance_logs_${adminId}`, maintSetting.value);
        localStorage.setItem('delivery_fleet_maintenance_logs', maintSetting.value);
      }

      // Fleet Daily Logs
      const dailyKey = `fleet_daily_logs_${adminId}`;
      let dailySetting = settings.find(s => s.key === dailyKey);
      if (dailySetting) {
        localStorage.setItem(`delivery_fleet_daily_logs_${adminId}`, dailySetting.value);
        localStorage.setItem('delivery_fleet_daily_logs', dailySetting.value);
      }

      // Km Price
      if (userId) {
        const kmPriceKey = `km_price_${userId}`;
        let kmPriceSetting = settings.find(s => s.key === kmPriceKey);
        if (!kmPriceSetting) {
          kmPriceSetting = settings.find(s => s.key === 'km_price');
        }
        if (kmPriceSetting) {
          localStorage.setItem(`delivery_km_price_${userId}`, kmPriceSetting.value);
          localStorage.setItem('delivery_km_price', kmPriceSetting.value);
        }
      }

      // Route Kilometers and Driver Daily Rates
      settings.forEach(s => {
        if (s.key && s.key.startsWith('route_kms_')) {
          localStorage.setItem(`delivery_${s.key}`, s.value);
        }
        if (s.key && s.key.startsWith('driver_daily_rate_')) {
          localStorage.setItem(`delivery_${s.key}`, s.value);
        }
      });

      // Route Start Time
      settings.forEach(s => {
        if (s.key && s.key.startsWith('route_start_time_')) {
          localStorage.setItem(`delivery_${s.key}`, s.value);
        }
      });

      // Pull Driver Locations from Supabase
      const locations = {};
      settings.forEach(s => {
        if (s.key && s.key.startsWith('loc_')) {
          const fid = s.key.substring(4);
          try {
            const val = JSON.parse(s.value);
            if (val && typeof val === 'object' && val.lat !== undefined && val.lng !== undefined) {
              locations[fid] = {
                lat: parseFloat(val.lat),
                lng: parseFloat(val.lng),
                updatedAt: val.updatedAt || new Date().toISOString()
              };
            }
          } catch (e) {
            console.error(`Error parsing location for ${fid}:`, e);
          }
        }
      });
      if (Object.keys(locations).length > 0) {
        localStorage.setItem('delivery_driver_locations', JSON.stringify(locations));
      }
    }

    notifySync();
  } catch (e) {
    console.error("Error pulling database from Supabase:", e);
  }
}

const DEFAULT_USERS = [
  { id: 'admin', username: 'admin', label: 'Super Administrador', role: 'superadmin', password: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' }
];

const DEFAULT_MODULE_PRICE = 3.81;

const DEFAULT_TARIFFS = [
  // Bloque Paquetería
  { id: 'ENTREGA_PV', name: 'Entrega PV (Pequeño Volumen)', block: 'Paquetería', type: 'fixed', value: 3.81 },
  { id: 'ENTREGA_GV', name: 'Entrega GV (Gran Volumen)', block: 'Paquetería', type: 'fixed', value: 8.71 },
  { id: 'RECOGIDA_PV', name: 'Recogida PV (Pequeño Volumen)', block: 'Paquetería', type: 'fixed', value: 3.81 },
  { id: 'RECOGIDA_GV', name: 'Recogida GV (Gran Volumen)', block: 'Paquetería', type: 'fixed', value: 8.71 },

  // Bloque Televisores - Solo Entrega o Solo Recogida
  { id: 'TV_ENT_49', name: 'TV <= 49" (Entrega o Recogida)', block: 'Televisores', type: 'fixed', value: 5.23 },
  { id: 'TV_ENT_74', name: 'TV 50" a 74" (Entrega o Recogida)', block: 'Televisores', type: 'fixed', value: 12.42 },
  { id: 'TV_ENT_115', name: 'TV 75" a 115" (Entrega o Recogida)', block: 'Televisores', type: 'fixed', value: 25.50 },
  
  // Bloque Televisores - Entrega + Recogida (Combinado)
  { id: 'TV_COMB_49', name: 'TV <= 49" (Entrega + Recogida)', block: 'Televisores', type: 'fixed', value: 10.46 },
  { id: 'TV_COMB_74', name: 'TV 50" a 74" (Entrega + Recogida)', block: 'Televisores', type: 'fixed', value: 17.64 },
  { id: 'TV_COMB_115', name: 'TV 75" a 115" (Entrega + Recogida)', block: 'Televisores', type: 'fixed', value: 30.73 },

  // Recogida TV Vieja
  { id: 'TV_VIEJA_URB', name: 'Recogida TV Vieja Urbantz', block: 'Televisores', type: 'fixed', value: 5.23 },
  { id: 'TV_VIEJA_NO_URB', name: 'Recogida TV Vieja NO Urbantz', block: 'Televisores', type: 'fixed', value: 5.23 },

  // Puesta en Marcha (PM)
  { id: 'PM_BAS_49', name: 'PM Básica <= 49"', block: 'Instalaciones', type: 'modules', value: 3 },
  { id: 'PM_BAS_74', name: 'PM Básica 50" a 74"', block: 'Instalaciones', type: 'modules', value: 3 },
  { id: 'PM_BAS_115', name: 'PM Básica 75" a 115"', block: 'Instalaciones', type: 'modules', value: 3 },
  { id: 'PM_COMP_49', name: 'PM Compleja <= 49"', block: 'Instalaciones', type: 'modules', value: 5 },
  { id: 'PM_COMP_74', name: 'PM Compleja 50" a 74"', block: 'Instalaciones', type: 'modules', value: 5 },
  { id: 'PM_COMP_115', name: 'PM Compleja 75" a 115"', block: 'Instalaciones', type: 'modules', value: 5 },

  // Cuelgues
  { id: 'CUELGUE_49', name: 'Cuelgue en Pared <= 49"', block: 'Instalaciones', type: 'modules', value: 8 },
  { id: 'CUELGUE_74', name: 'Cuelgue en Pared 50" a 74"', block: 'Instalaciones', type: 'modules', value: 10 },
  { id: 'CUELGUE_115', name: 'Cuelgue en Pared 75" a 115"', block: 'Instalaciones', type: 'modules', value: 10 },

  // Otros Elementos
  { id: 'BSND', name: 'Barra de Sonido', block: 'Barras de Sonido', type: 'fixed', value: 5.23 },
  { id: 'PM_BSND', name: 'Puesta en Marcha Barra de Sonido', block: 'Barras de Sonido', type: 'modules', value: 3 },
  { id: 'CUELGUE_BSND', name: 'Cuelgue Barra de Sonido', block: 'Barras de Sonido', type: 'modules', value: 8 },
  { id: 'MFRA', name: 'Marco Frame', block: 'Electrodomésticos Varios', type: 'modules', value: 3 },
  { id: 'SPAR', name: 'Soporte de Pared', block: 'Electrodomésticos Varios', type: 'fixed', value: 5.23 },
  { id: 'SSUE', name: 'Soporte de Suelo', block: 'Electrodomésticos Varios', type: 'fixed', value: 5.23 },
  { id: 'ALTA', name: 'Altavoces', block: 'Electrodomésticos Varios', type: 'modules', value: 3 },
  { id: 'TDIC', name: 'Toca discos', block: 'Electrodomésticos Varios', type: 'modules', value: 3 },
  { id: 'PROY', name: 'Proyector', block: 'Electrodomésticos Varios', type: 'fixed', value: 5.23 },
  { id: 'VTEC', name: 'Visita Técnica', block: 'Servicios', type: 'modules', value: 5 },
  { id: 'URGENTE_100', name: 'Servicio Urgente 100€', block: 'Servicios', type: 'fixed', value: 100 },
  { id: 'URGENTE_120', name: 'Servicio Urgente 120€', block: 'Servicios', type: 'fixed', value: 120 },
  // Nuevos artículos
  { id: 'ORDE', name: 'Ordenador', block: 'Electrodomésticos Varios', type: 'fixed', value: 5.23 },
  { id: 'PANT', name: 'Pantalla', block: 'Electrodomésticos Varios', type: 'fixed', value: 5.23 },
  { id: 'MCAD', name: 'Micro Cadena', block: 'Electrodomésticos Varios', type: 'fixed', value: 5.23 },
  { id: 'KM_RUTA_LARGA', name: 'Kilometraje Ruta Larga / Extra (por km)', block: 'Servicios', type: 'fixed', value: 0.30 }
];

export const DEFAULT_DORMITY_TARIFFS = [
  // ☀️ Servicio Día
  { id: 'DORMITY_SERVDIA_EXPRESS', name: 'Tienda', block: 'Servicio Día', type: 'fixed', value: 150.00, provider: 'dormity' },
  { id: 'DORMITY_SERVDIA_CERCANIA', name: 'Servicio Día - Cercanía', block: 'Servicio Día', type: 'fixed', value: 210.00, provider: 'dormity' },
  { id: 'DORMITY_SERVDIA_MEDIA', name: 'Servicio Día - Media Distancia', block: 'Servicio Día', type: 'fixed', value: 260.00, provider: 'dormity' },
  { id: 'DORMITY_SERVDIA_LEJANIA', name: 'Servicio Día - Lejanía', block: 'Servicio Día', type: 'fixed', value: 310.00, provider: 'dormity' },

  // 🚀 Ruta Distancia Express
  { id: 'DORMITY_EXPRESS_CERCANIA', name: 'Ruta Express - Cercanía', block: 'Ruta Express', type: 'fixed', value: 180.00, provider: 'dormity' },
  { id: 'DORMITY_EXPRESS_MEDIA', name: 'Ruta Express - Media Distancia', block: 'Ruta Express', type: 'fixed', value: 230.00, provider: 'dormity' },
  { id: 'DORMITY_EXPRESS_LEJANIA', name: 'Ruta Express - Lejanía', block: 'Ruta Express', type: 'fixed', value: 280.00, provider: 'dormity' },

  // 🚚 Ruta Madrid
  { id: 'DORMITY_MADRID', name: 'Ruta Madrid (700,00 € hasta 8 clientes)', block: 'Ruta Madrid', type: 'fixed', value: 700.00, provider: 'dormity' },
  { id: 'DORMITY_MADRID_EXTRA', name: 'Cliente Adicional Madrid (+70,00 € a partir del 9º cliente)', block: 'Ruta Madrid', type: 'fixed', value: 70.00, provider: 'dormity' },

  // 🏢 Ruta Toledo
  { id: 'DORMITY_TOLEDO', name: 'Ruta Toledo (700,00 € Fija)', block: 'Ruta Toledo', type: 'fixed', value: 700.00, provider: 'dormity' }
];

export const PREDEFINED_TV_INCHES = [32, 40, 43, 48, 49, 50, 55, 58, 65, 70, 74, 75, 77, 83, 85, 98, 100, 115];

// Inicialización de la base de datos
export function initDB() {
  if (!localStorage.getItem('delivery_users')) {
    localStorage.setItem('delivery_users', JSON.stringify(DEFAULT_USERS));
  } else {
    // Migration: remove old default vans and make sure 'admin' user has 'superadmin' role
    try {
      let current = JSON.parse(localStorage.getItem('delivery_users')) || [];
      current = current.filter(u => u && u.id !== 'furgo1' && u.id !== 'furgo2' && u.id !== 'furgo3');
      
      const adminUser = current.find(u => u.id === 'admin');
      if (adminUser) {
        if (adminUser.role === 'admin') {
          adminUser.role = 'superadmin';
          adminUser.label = 'Super Administrador';
        }
      }
      localStorage.setItem('delivery_users', JSON.stringify(current));
    } catch (e) {
      console.error("Error migrating admin user role:", e);
    }
  }
  if (!localStorage.getItem('delivery_module_price')) {
    localStorage.setItem('delivery_module_price', JSON.stringify(DEFAULT_MODULE_PRICE));
  }
  if (!localStorage.getItem('delivery_tariffs')) {
    localStorage.setItem('delivery_tariffs', JSON.stringify(DEFAULT_TARIFFS));
  }
  let currentDormity = [];
  try {
    currentDormity = (JSON.parse(localStorage.getItem('delivery_dormity_tariffs')) || [])
      .filter(t => t && t.id && !t.id.includes('GRAN_LEJANIA') && t.id !== 'DORMITY_TOLEDO_EXTRA' && !t.id.startsWith('DORMITY_TOLEDO_EXTRA'));
  } catch (e) {}

  if (!currentDormity || currentDormity.length === 0) {
    localStorage.setItem('delivery_dormity_tariffs', JSON.stringify(DEFAULT_DORMITY_TARIFFS));
  } else {
    let updatedDormity = currentDormity.map(t => {
      if (t && t.id && (t.id === 'DORMITY_SERVDIA_EXPRESS' || t.id.startsWith('DORMITY_SERVDIA_EXPRESS_'))) {
        return { ...t, name: 'Tienda' };
      }
      if (t && t.id && (t.id === 'DORMITY_MADRID' || t.id.startsWith('DORMITY_MADRID_') && t.id !== 'DORMITY_MADRID_EXTRA')) {
        return { ...t, name: 'Ruta Madrid (700,00 € hasta 8 clientes)' };
      }
      if (t && t.id && (t.id === 'DORMITY_MADRID_EXTRA' || t.id.startsWith('DORMITY_MADRID_EXTRA_'))) {
        return { ...t, name: 'Cliente Adicional Madrid (+70,00 € a partir del 9º cliente)' };
      }
      if (t && t.id && (t.id === 'DORMITY_TOLEDO' || t.id.startsWith('DORMITY_TOLEDO_'))) {
        return { ...t, name: 'Ruta Toledo (700,00 € Fija)' };
      }
      return t;
    });
    DEFAULT_DORMITY_TARIFFS.forEach(defItem => {
      if (!updatedDormity.some(t => t.id === defItem.id || (t.id && t.id.startsWith(defItem.id + '_')))) {
        updatedDormity.push(defItem);
      }
    });
    localStorage.setItem('delivery_dormity_tariffs', JSON.stringify(updatedDormity));
  }

  // Migration to split Delivery and Pickup under Paquetería and add Soundbar items
  try {
      let current = JSON.parse(localStorage.getItem('delivery_tariffs'));
      const hasUnifiedKeys = current.some(t => t.id === 'ENTREGA_RECOGIDA_PV');
      if (hasUnifiedKeys) {
        const filtered = current.filter(t => t.id !== 'ENTREGA_RECOGIDA_PV' && t.id !== 'ENTREGA_RECOGIDA_GV');
        const newItems = [
          { id: 'ENTREGA_PV', name: 'Entrega PV (Pequeño Volumen)', block: 'Paquetería', type: 'fixed', value: 3.81 },
          { id: 'ENTREGA_GV', name: 'Entrega GV (Gran Volumen)', block: 'Paquetería', type: 'fixed', value: 8.71 },
          { id: 'RECOGIDA_PV', name: 'Recogida PV (Pequeño Volumen)', block: 'Paquetería', type: 'fixed', value: 3.81 },
          { id: 'RECOGIDA_GV', name: 'Recogida GV (Gran Volumen)', block: 'Paquetería', type: 'fixed', value: 8.71 }
        ];
        filtered.unshift(...newItems);
        current = filtered;
      }
      
      const hasSoundbarPM = current.some(t => t.id === 'PM_BSND');
      if (!hasSoundbarPM) {
        current.push(
          { id: 'PM_BSND', name: 'Puesta en Marcha Barra de Sonido', block: 'Barras de Sonido', type: 'modules', value: 3 },
          { id: 'CUELGUE_BSND', name: 'Cuelgue Barra de Sonido', block: 'Barras de Sonido', type: 'modules', value: 8 }
        );
      }

      const hasUrgente = current.some(t => t.id === 'URGENTE_100');
      if (!hasUrgente) {
        current.push(
          { id: 'URGENTE_100', name: 'Servicio Urgente 100€', block: 'Servicios', type: 'fixed', value: 100 },
          { id: 'URGENTE_120', name: 'Servicio Urgente 120€', block: 'Servicios', type: 'fixed', value: 120 }
        );
      }
      
      // Migrate BSND to fixed 5.23 (equivalent to small TV)
      const bsndItem = current.find(t => t.id === 'BSND');
      if (bsndItem && (bsndItem.type !== 'fixed' || bsndItem.value !== 5.23)) {
        bsndItem.type = 'fixed';
        bsndItem.value = 5.23;
      }
      
      // Migrate PROY to fixed 5.23 (equivalent to small TV / soundbar)
      const proyItem = current.find(t => t.id === 'PROY');
      if (proyItem && (proyItem.type !== 'fixed' || proyItem.value !== 5.23)) {
        proyItem.type = 'fixed';
        proyItem.value = 5.23;
      }
      
      // Migrate SPAR to fixed 5.23 (equivalent to small TV)
      const sparItem = current.find(t => t.id === 'SPAR');
      if (sparItem && (sparItem.type !== 'fixed' || sparItem.value !== 5.23)) {
        sparItem.type = 'fixed';
        sparItem.value = 5.23;
      }

      // Migrate SSUE to fixed 5.23 (equivalent to small TV)
      const ssueItem = current.find(t => t.id === 'SSUE');
      if (ssueItem && (ssueItem.type !== 'fixed' || ssueItem.value !== 5.23)) {
        ssueItem.type = 'fixed';
        ssueItem.value = 5.23;
      }
      
      // Migrate VTEC tariff (Visita Técnica 5 modules)
      const hasVtec = current.some(t => t.id === 'VTEC');
      if (!hasVtec) {
        current.push({
          id: 'VTEC',
          name: 'Visita Técnica',
          block: 'Servicios',
          type: 'modules',
          value: 5
        });
      }

      // Migrate: add Ordenador, Pantalla and Micro Cadena if missing
      const hasOrde = current.some(t => t.id === 'ORDE');
      if (!hasOrde) {
        current.push(
          { id: 'ORDE', name: 'Ordenador', block: 'Electrodomésticos Varios', type: 'fixed', value: 5.23 },
          { id: 'PANT', name: 'Pantalla', block: 'Electrodomésticos Varios', type: 'fixed', value: 5.23 },
          { id: 'MCAD', name: 'Micro Cadena', block: 'Electrodomésticos Varios', type: 'fixed', value: 5.23 }
        );
      }

      // Split 'Otros' block into new categories: 'Barras de Sonido', 'Electrodomésticos Varios', 'Servicios'
      const soundbarIds = ['BSND', 'PM_BSND', 'CUELGUE_BSND'];
      const electroIds = ['PROY', 'ORDE', 'PANT', 'MCAD', 'MFRA', 'SPAR', 'SSUE', 'ALTA', 'TDIC'];
      const serviceIds = ['URGENTE_100', 'URGENTE_120', 'VTEC'];
      
      let changed = false;
      current = current.map(t => {
        const matchesSoundbar = soundbarIds.some(sid => t.id === sid || t.id.startsWith(sid + '_'));
        const matchesElectro = electroIds.some(eid => t.id === eid || t.id.startsWith(eid + '_'));
        const matchesService = serviceIds.some(sid => t.id === sid || t.id.startsWith(sid + '_'));
        
        if (matchesSoundbar && t.block !== 'Barras de Sonido') {
          changed = true;
          return { ...t, block: 'Barras de Sonido' };
        }
        if (matchesElectro && t.block !== 'Electrodomésticos Varios') {
          changed = true;
          return { ...t, block: 'Electrodomésticos Varios' };
        }
        if (matchesService && t.block !== 'Servicios') {
          changed = true;
          return { ...t, block: 'Servicios' };
        }
        return t;
      });
      
      localStorage.setItem('delivery_tariffs', JSON.stringify(current));
    } catch (e) {
      console.error("Error migrating tariffs:", e);
    }
  if (!localStorage.getItem('delivery_tickets') || !localStorage.getItem('delivery_db_cleared_once')) {
    localStorage.setItem('delivery_tickets', JSON.stringify([]));
  }
  if (!localStorage.getItem('delivery_shifts') || !localStorage.getItem('delivery_db_cleared_once')) {
    localStorage.setItem('delivery_shifts', JSON.stringify([]));
  }
  localStorage.setItem('delivery_db_cleared_once', 'true');
}

// Hash password using browser-native SHA-256 Web Crypto API
export async function hashPassword(password) {
  if (!password) return '';
  try {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (e) {
    // Fix: este fallback solo debería activarse si crypto.subtle no está disponible
    // (contexto no seguro / navegador muy viejo) — no debería ocurrir nunca en
    // producción, ya que la app se sirve por HTTPS. El fallback anterior calculaba UN
    // solo hash de 32 bits y lo rellenaba con ceros hasta 64 caracteres para "parecer"
    // un SHA-256 real: era trivialmente débil (32 bits de espacio de búsqueda) y además
    // el relleno de ceros lo hacía aún más reconocible/atacable. Ahora se combinan 8
    // mezclas de 32 bits con semillas distintas para llenar los 64 caracteres sin
    // relleno predecible. Sigue sin ser SHA-256 real, pero ya no es un checksum trivial.
    console.error("Crypto subtle hash failed, falling back to a stronger local hash. Esto no debería pasar en producción (HTTPS); si ocurre, conviene investigar por qué crypto.subtle no está disponible:", e);
    const seeds = [5381, 52711, 1000003, 16777619, 2166136261, 40503, 65599, 131];
    const hex = seeds.map(seed => {
      let hash = seed >>> 0;
      for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = (Math.imul(hash, 33) + char + i) >>> 0;
        hash = (hash ^ (hash >>> 15)) >>> 0;
      }
      return hash.toString(16).padStart(8, '0');
    }).join('');
    return hex;
  }
}

// Check if string is SHA-256 hash format
export function isSHA256(str) {
  return /^[a-f0-9]{64}$/i.test(str);
}

// Obtener datos
export function getUsers() {
  initDB();
  const raw = localStorage.getItem('delivery_users');
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) || [];
    return list.map(u => {
      let pObj = u.permissions;
      if (pObj && typeof pObj === 'string') {
        try { pObj = JSON.parse(pObj); } catch(e) {}
      }
      return { ...u, permissions: pObj || null };
    });
  } catch (e) {
    return [];
  }
}

export async function saveUsers(users) {
  setIsSaving(true);
  try {
    // Automatically hash plain-text passwords
    const hashedUsers = [];
    for (const u of users) {
      let pwd = u.password || '';
      if (pwd && !isSHA256(pwd)) {
        pwd = await hashPassword(pwd);
      }
      // Asegurar que permissions sea una cadena JSON si es un objeto, o null
      let permissionsVal = u.permissions;
      if (permissionsVal && typeof permissionsVal === 'object') {
        permissionsVal = JSON.stringify(permissionsVal);
      }
      hashedUsers.push({ ...u, password: pwd, permissions: permissionsVal || null });
    }

    localStorage.setItem('delivery_users', JSON.stringify(hashedUsers));
    
    if (supabase) {
      // Guardar también en delivery_settings como plan de respaldo para sincronizar entre dispositivos
      for (const u of hashedUsers) {
        if (u.role === 'admin') {
          const permString = typeof u.permissions === 'object' ? JSON.stringify(u.permissions) : (u.permissions || null);
          supabase.from('delivery_settings').upsert({
            key: `user_permissions_${u.id}`,
            value: permString || '{}'
          }).then(() => {}).catch(err => console.warn("Failed saving backup permissions to settings:", err));
        }
        if (u.allowedProviders && Array.isArray(u.allowedProviders)) {
          const provString = JSON.stringify(u.allowedProviders);
          supabase.from('delivery_settings').upsert({
            key: `user_allowed_providers_${u.id}`,
            value: provString
          }).then(() => {}).catch(err => console.warn("Failed saving backup allowedProviders to settings:", err));
        }
      }
      try {
        // Detectar dinámicamente las columnas que existen realmente en la base de datos
        let dbColumns = null;
        try {
          const { data: colCheckData } = await supabase.from('delivery_users').select('*').limit(1);
          if (colCheckData && colCheckData.length > 0) {
            dbColumns = Object.keys(colCheckData[0]);
          }
        } catch (colErr) {
          console.warn("No se pudo detectar las columnas de delivery_users directamente, se usará fallback de errores:", colErr);
        }

        const formatted = hashedUsers.map(u => {
          const row = {
            id: u.id,
            username: u.username,
            password: u.password,
            label: u.label,
            role: u.role,
            can_search: u.canSearch || false,
            created_by: u.createdBy || 'admin'
          };
          
          if (!dbColumns || dbColumns.includes('must_change_password')) {
            row.must_change_password = u.mustChangePassword || false;
          }
          if (!dbColumns || dbColumns.includes('permissions')) {
            row.permissions = u.permissions || null;
          }
          if (dbColumns && dbColumns.includes('allowed_providers')) {
            row.allowed_providers = u.allowedProviders || ['eci', 'dormity'];
          }
          if (!dbColumns || dbColumns.includes('email')) {
            row.email = u.email || null;
          }
          if (!dbColumns || dbColumns.includes('auth_uid')) {
            row.auth_uid = u.auth_uid || null;
          }
          if (!dbColumns || dbColumns.includes('active')) {
            row.active = u.active !== false;
          }
          return row;
        });

        const { error } = await supabase.from('delivery_users').upsert(formatted);
        
        if (error) {
          console.error("Supabase upsert failed, attempting fallbacks:", error);
          
          if (error.code === '42703' || error.code === 'PGRST204') {
            const errMsg = error.message || '';
            const hasPermissionsErr = errMsg.includes('permissions');
            const hasMustChangeErr = errMsg.includes('must_change_password');
            const hasEmailErr = errMsg.includes('email');
            const hasAuthUidErr = errMsg.includes('auth_uid');
            
            if (hasPermissionsErr) {
              localStorage.setItem('delivery_supabase_needs_permissions_col', 'true');
            }
            if (hasEmailErr || hasAuthUidErr) {
              localStorage.setItem('delivery_supabase_needs_auth_migration_cols', 'true');
            }
            
            // Reintentar ajustando las columnas disponibles
            const fallbackFormatted = hashedUsers.map(u => {
              const row = {
                id: u.id,
                username: u.username,
                password: u.password,
                label: u.label,
                role: u.role,
                can_search: u.canSearch || false,
                created_by: u.createdBy || 'admin'
              };
              
              // Añadir condicionalmente solo si no fallaron en el primer intento
              if (!hasMustChangeErr) {
                row.must_change_password = u.mustChangePassword || false;
              }
              if (!hasPermissionsErr) {
                row.permissions = u.permissions || null;
              }
              if (!hasEmailErr) {
                row.email = u.email || null;
              }
              if (!hasAuthUidErr) {
                row.auth_uid = u.auth_uid || null;
              }
              return row;
            });
            
            const { error: fallbackError } = await supabase.from('delivery_users').upsert(fallbackFormatted);
            
            // Si el fallback sigue fallando por la otra columna
            if (fallbackError && (fallbackError.code === '42703' || fallbackError.code === 'PGRST204')) {
              console.warn("Second upsert failed, retrying with minimal columns...");
              const fallbackMsg = fallbackError.message || '';
              if (fallbackMsg.includes('permissions')) {
                localStorage.setItem('delivery_supabase_needs_permissions_col', 'true');
              }
              
              const minimalFormatted = hashedUsers.map(u => ({
                id: u.id,
                username: u.username,
                password: u.password,
                label: u.label,
                role: u.role,
                can_search: u.canSearch || false,
                created_by: u.createdBy || 'admin'
              }));
              
              const { error: minimalError } = await supabase.from('delivery_users').upsert(minimalFormatted);
              if (minimalError) {
                console.error("Minimal upsert failed:", minimalError);
                throw minimalError;
              } else {
                console.log("Minimal upsert succeeded!");
              }
            } else if (fallbackError) {
              throw fallbackError;
            } else {
              console.log("Fallback upsert succeeded!");
            }
          } else {
            throw error;
          }
        } else {
          // Upsert primario funcionó, borrar la bandera de error si existía
          localStorage.removeItem('delivery_supabase_needs_permissions_col');
          localStorage.removeItem('delivery_supabase_needs_auth_migration_cols');
        }
      } catch (e) {
        console.error("Error saving users to Supabase:", e);
        throw e;
      }
    }
  } finally {
    setIsSaving(false);
  }
}

export function getModulePrice(userId) {
  initDB();
  if (userId) {
    const customPrice = localStorage.getItem(`delivery_module_price_${userId}`);
    if (customPrice) return parseFloat(customPrice);
  }
  return parseFloat(localStorage.getItem('delivery_module_price'));
}

export async function saveModulePrice(price, userId) {
  if (userId) {
    localStorage.setItem(`delivery_module_price_${userId}`, JSON.stringify(price));
  }
  localStorage.setItem('delivery_module_price', JSON.stringify(price));
  if (supabase) {
    const key = userId ? `module_price_${userId}` : 'module_price';
    const { error } = await supabase.from('delivery_settings').upsert({ key, value: price.toString() });
    if (error) {
      console.error("Error saving module price to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

export function getTariffs() {
  initDB();
  let currentUserObj = null;
  try {
    const savedUser = localStorage.getItem('delivery_session');
    if (savedUser) {
      currentUserObj = JSON.parse(savedUser);
    }
  } catch (e) {}

  if (currentUserObj && currentUserObj.role !== 'superadmin') {
    const allowed = getUserAllowedProviders(currentUserObj);
    if (!allowed.includes('eci')) {
      return [];
    }
  }

  // Fix: un valor corrupto en localStorage aquí tumbaba toda la pantalla de
  // tarifas ECI (y con ella la creación/edición de tickets, que depende de
  // getTariffs()). Se captura y se cae a [] en vez de propagar la excepción.
  let rawTariffs;
  try {
    rawTariffs = JSON.parse(localStorage.getItem('delivery_tariffs')) || [];
  } catch (e) {
    console.error('Error parsing delivery_tariffs:', e);
    rawTariffs = [];
  }

  let targetAdminId = 'admin';
  let isSuperAdmin = false;
  try {
    if (currentUserObj) {
      if (currentUserObj.role === 'admin') {
        targetAdminId = currentUserObj.id;
      } else if (currentUserObj.role === 'repartidor') {
        targetAdminId = currentUserObj.createdBy || 'admin';
      } else if (currentUserObj.role === 'superadmin') {
        isSuperAdmin = true;
      }
    }
  } catch (e) {}
  
  if (isSuperAdmin) {
    return rawTariffs;
  }
  
  const adminSuffix = `_${targetAdminId}`;
  const tariffMap = {};
  
  rawTariffs.forEach(t => {
    if (t && (t.createdBy === targetAdminId || (t.id && t.id.endsWith(adminSuffix)))) {
      let baseId = t.id;
      if (t.id.endsWith(adminSuffix)) {
        baseId = t.id.slice(0, -adminSuffix.length);
      }
      tariffMap[baseId] = {
        ...t,
        id: baseId,
        createdBy: targetAdminId
      };
    }
  });
  
  rawTariffs.forEach(t => {
    if (t && !t.createdBy && !(t.id && t.id.endsWith(adminSuffix))) {
      if (!tariffMap[t.id]) {
        tariffMap[t.id] = t;
      }
    }
  });
  
  return Object.values(tariffMap);
}

export async function saveTariffs(tariffs) {
  isSaving++; // contador, no booleano (ver comentario junto a la declaración de isSaving)
  try {
    let activeAdminId = null;
    let isSuperAdmin = false;
    try {
      const savedUser = localStorage.getItem('delivery_session');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (u) {
          if (u.role === 'admin') {
            activeAdminId = u.id;
          } else if (u.role === 'superadmin') {
            isSuperAdmin = true;
          }
        }
      }
    } catch (e) {}

    const formatted = tariffs.map(t => {
      let dbId = t.id;
      let createdBy = t.createdBy || null;
      if (activeAdminId && !isSuperAdmin) {
        createdBy = activeAdminId;
      }
      
      // If it's a standard tariff owned by an admin, append the suffix
      if (createdBy && !t.id.startsWith('CUSTOM_') && !t.id.endsWith(`_${createdBy}`)) {
        dbId = `${t.id}_${createdBy}`;
      }
      
      return {
        id: dbId,
        name: t.name,
        block: t.block,
        type: t.type,
        value: parseFloat(t.value) || 0,
        createdBy: createdBy
      };
    });

    const existingRaw = JSON.parse(localStorage.getItem('delivery_tariffs')) || [];
    const mergedMap = {};
    existingRaw.forEach(t => {
      if (t && t.id) mergedMap[t.id] = t;
    });
    formatted.forEach(t => {
      if (t && t.id) mergedMap[t.id] = t;
    });
    const mergedList = Object.values(mergedMap);

    localStorage.setItem('delivery_tariffs', JSON.stringify(mergedList));
    if (supabase) {
      try {
        const dbFormatted = formatted.map(t => ({
          id: t.id,
          name: t.name,
          block: t.block,
          type: t.type,
          value: t.value,
          created_by: t.createdBy || null
        }));
        const { error } = await supabase.from('delivery_tariffs').upsert(dbFormatted);
        if (error) {
          console.error("Supabase upsert failed:", error);
          return { success: false, error };
        }
      } catch (e) {
        console.error("Error saving tariffs to Supabase:", e);
        return { success: false, error: e };
      }
    }
    // Fix: antes esta función nunca informaba si el guardado en la nube funcionó,
    // así que quien la llamaba (p.ej. al cambiar un precio de tarifa) recalculaba y
    // resubía TODOS los tickets con el nuevo valor sin saber si la tarifa en sí
    // había llegado a guardarse — devuelve ahora {success, error}.
    return { success: true };
  } finally {
    isSaving = Math.max(0, isSaving - 1);
  }
}

export function getTickets() {
  initDB();
  // Fix: un valor corrupto en localStorage (o ausente, donde JSON.parse(null)
  // devuelve null en vez de un array) rompía todo lo que llama a getTickets()
  // esperando un array (.map/.filter/.forEach) y podía tumbar pantallas enteras.
  try {
    return JSON.parse(localStorage.getItem('delivery_tickets')) || [];
  } catch (e) {
    console.error('Error parsing delivery_tickets:', e);
    return [];
  }
}

export async function saveTickets(tickets) {
  localStorage.setItem('delivery_tickets', JSON.stringify(tickets));
  // Fix: antes esta función nunca informaba a quien la llamaba si el guardado en la
  // nube realmente funcionó o falló (siempre "terminaba bien" aunque solo hubiera
  // guardado en local) — devuelve ahora {success, error} para que el que llama pueda
  // avisar de verdad al usuario en vez de asumir éxito.
  if (supabase) {
    isSaving++; // contador, no booleano (ver comentario junto a la declaración de isSaving)
    try {
      // Fix: antes se re-subía el array COMPLETO de tickets en cada guardado, sin
      // importar cuántos hubieran cambiado realmente. Con miles de tickets acumulados,
      // esto era caro (mismo patrón que causó el problema de egress, pero en subida) y
      // aumentaba el riesgo de pisar cambios concurrentes de otro dispositivo en filas
      // que ni siquiera habían cambiado aquí. Todos los que llaman a saveTickets()
      // marcan _syncStatus:'pending' en los tickets que sí modificaron, así que ahora
      // solo subimos esos. Si por algún motivo ninguno está marcado, no hay nada que
      // subir (p.ej. borrar un ticket o resetear el mes, que ya gestionan su propia
      // sincronización).
      const pendingTickets = tickets.filter(t => t && t._syncStatus === 'pending');

      if (pendingTickets.length === 0) {
        return { success: true }; // nada que subir; el finally de abajo igualmente libera isSaving
      }

      const formatted = pendingTickets.map(t => ({
        id: t.id,
        date: t.date,
        furgo_id: t.furgoId,
        furgo_label: t.furgoLabel,
        route_name: t.routeName,
        customer_name: t.customerName,
        phone: t.phone,
        address: t.address,
        postcode: t.postcode,
        notes: t.notes,
        cod_amount: t.codAmount,
        tasks: t.tasks,
        total_price: t.totalPrice,
        status: t.status,
        failure_reason: t.failureReason || '',
        lat: t.lat,
        lng: t.lng,
        completed_lat: t.completedLat,
        completed_lng: t.completedLng,
        route_order: t.routeOrder,
        created_at: t.createdAt,
        created_by: t.createdBy || 'admin'
      }));
      const { error } = await supabase.from('delivery_tickets').upsert(formatted);
      if (error) {
        console.error("Supabase upsert failed in saveTickets:", error);
        return { success: false, error };
      } else {
        // Clear _syncStatus flag on successful upsert
        try {
          const currentLocal = JSON.parse(localStorage.getItem('delivery_tickets')) || [];
          const updatedLocal = currentLocal.map(t => {
            if (t && t._syncStatus === 'pending') {
              const { _syncStatus, ...rest } = t;
              return rest;
            }
            return t;
          });
          localStorage.setItem('delivery_tickets', JSON.stringify(updatedLocal));
        } catch (e) {
          console.error("Error clearing local sync status:", e);
        }
        return { success: true };
      }
    } catch (e) {
      console.error("Error saving tickets to Supabase:", e);
      return { success: false, error: e };
    } finally {
      setTimeout(() => {
        isSaving = Math.max(0, isSaving - 1);
      }, 1500);
    }
  }
  return { success: true };
}

export function getDormityTariffs() {
  initDB();
  // Fix: un valor corrupto en localStorage aquí tumbaba toda la pantalla de
  // tarifas Dormity (JSON.parse lanza antes de que el `|| DEFAULT_...` pueda
  // aplicarse). Se captura y se usa el valor por defecto, igual que ya hacía
  // el caso de "no hay nada guardado".
  let rawTariffs;
  try {
    rawTariffs = JSON.parse(localStorage.getItem('delivery_dormity_tariffs')) || DEFAULT_DORMITY_TARIFFS;
  } catch (e) {
    console.error('Error parsing delivery_dormity_tariffs:', e);
    rawTariffs = DEFAULT_DORMITY_TARIFFS;
  }
  
  const sanitizedRaw = (rawTariffs || []).filter(t => t && t.id && !t.id.includes('GRAN_LEJANIA') && t.id !== 'DORMITY_TOLEDO_EXTRA' && !t.id.startsWith('DORMITY_TOLEDO_EXTRA')).map(t => {
    if (t.id === 'DORMITY_TOLEDO' || t.id.startsWith('DORMITY_TOLEDO_')) {
      return { ...t, name: 'Ruta Toledo (700,00 € Fija)' };
    }
    if (t.id === 'DORMITY_MADRID' || (t.id.startsWith('DORMITY_MADRID_') && t.id !== 'DORMITY_MADRID_EXTRA')) {
      return { ...t, name: 'Ruta Madrid (700,00 € hasta 8 clientes)' };
    }
    if (t.id === 'DORMITY_MADRID_EXTRA' || t.id.startsWith('DORMITY_MADRID_EXTRA_')) {
      return { ...t, name: 'Cliente Adicional Madrid (+70,00 € a partir del 9º cliente)' };
    }
    if (t.id === 'DORMITY_SERVDIA_EXPRESS' || t.id.startsWith('DORMITY_SERVDIA_EXPRESS_')) {
      return { ...t, name: 'Tienda' };
    }
    return t;
  });

  DEFAULT_DORMITY_TARIFFS.forEach(defItem => {
    if (!sanitizedRaw.some(t => t.id === defItem.id || (t.id && t.id.startsWith(defItem.id + '_')))) {
      sanitizedRaw.push(defItem);
    }
  });

  let targetAdminId = 'admin';
  let isSuperAdmin = false;
  try {
    const savedUser = localStorage.getItem('delivery_session');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      if (u) {
        if (u.role === 'admin') {
          targetAdminId = u.id;
        } else if (u.role === 'repartidor') {
          targetAdminId = u.createdBy || 'admin';
        } else if (u.role === 'superadmin') {
          isSuperAdmin = true;
        }
      }
    }
  } catch (e) {}
  
  if (isSuperAdmin) {
    return sanitizedRaw.length > 0 ? sanitizedRaw : DEFAULT_DORMITY_TARIFFS;
  }
  
  const adminSuffix = `_${targetAdminId}`;
  const tariffMap = {};
  
  sanitizedRaw.forEach(t => {
    if (t && (t.createdBy === targetAdminId || (t.id && t.id.endsWith(adminSuffix)))) {
      let baseId = t.id;
      if (t.id.endsWith(adminSuffix)) {
        baseId = t.id.slice(0, -adminSuffix.length);
      }
      tariffMap[baseId] = {
        ...t,
        id: baseId,
        createdBy: targetAdminId
      };
    }
  });
  
  sanitizedRaw.forEach(t => {
    if (t && (!t.createdBy || t.createdBy === 'admin' || !t.id.includes('_')) && !(t.id && t.id.endsWith(adminSuffix))) {
      let baseId = t.id;
      if (!tariffMap[baseId]) {
        tariffMap[baseId] = t;
      }
    }
  });

  DEFAULT_DORMITY_TARIFFS.forEach(defItem => {
    if (!tariffMap[defItem.id]) {
      tariffMap[defItem.id] = defItem;
    }
  });

  const resultList = Object.values(tariffMap);
  return resultList.length > 0 ? resultList : DEFAULT_DORMITY_TARIFFS;
}

export async function saveDormityTariffs(tariffs) {
  isSaving++; // contador, no booleano (ver comentario junto a la declaración de isSaving)
  try {
    let activeAdminId = null;
    let isSuperAdmin = false;
    try {
      const savedUser = localStorage.getItem('delivery_session');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (u) {
          if (u.role === 'admin') activeAdminId = u.id;
          else if (u.role === 'repartidor') activeAdminId = u.createdBy || 'admin';
          else if (u.role === 'superadmin') isSuperAdmin = true;
        }
      }
    } catch (e) {}

    const formatted = tariffs.map(t => {
      let finalId = t.id;
      let createdBy = t.createdBy || activeAdminId;
      if (!isSuperAdmin && activeAdminId && !t.id.endsWith(`_${activeAdminId}`)) {
        finalId = `${t.id}_${activeAdminId}`;
      }
      return {
        ...t,
        id: finalId,
        createdBy: createdBy || 'admin'
      };
    });

    const existingRaw = JSON.parse(localStorage.getItem('delivery_dormity_tariffs')) || DEFAULT_DORMITY_TARIFFS;
    const mergedMap = {};
    existingRaw.forEach(t => { if (t && t.id) mergedMap[t.id] = t; });
    formatted.forEach(t => { if (t && t.id) mergedMap[t.id] = t; });

    const mergedList = Object.values(mergedMap);
    localStorage.setItem('delivery_dormity_tariffs', JSON.stringify(mergedList));
    
    if (supabase) {
      // Fix: esta función mandaba a Supabase un campo `provider` que no existe en la
      // columna de delivery_tariffs, y `createdBy` en vez de `created_by`. La tabla
      // sólo tiene id, name, block, type, value, created_by (mismo patrón que ya usan
      // saveTariffs() y saveTickets()), así que cada guardado fallaba en silencio
      // contra Supabase — se veía bien en local pero nunca llegaba a la nube. El
      // catálogo de Dormity ha estado atrapado en el dispositivo de quien lo editara.
      const dbFormatted = formatted.map(t => ({
        id: t.id,
        name: t.name,
        block: t.block || 'General',
        type: t.type || 'fixed',
        value: Number(t.value) || 0,
        created_by: t.createdBy || 'admin'
      }));
      const { error } = await supabase.from('delivery_tariffs').upsert(dbFormatted);
      if (error) console.error("Error saving dormity tariffs to Supabase:", error);
    }
  } catch (err) {
    console.error("Error in saveDormityTariffs:", err);
  } finally {
    setTimeout(() => { isSaving = Math.max(0, isSaving - 1); }, 1500);
  }
}

// Fix: las sumas de precios de un ticket se guardaban tal cual las calcula
// JavaScript, sin redondear, y la suma de números decimales en JS puede
// acumular pequeños errores de precisión (p.ej. 0.1 + 0.2 !== 0.3). Con
// muchos repartos combinando distintas tarifas, esto podía generar
// discrepancias de céntimos entre lo que se ve en pantalla y lo que queda
// guardado. Se usa este helper para redondear siempre a 2 decimales antes de
// guardar cualquier precio calculado.
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function calculateDormityTaskPrice(tariffId, distanceKm = 0, extraOrders = 0, dormityTariffs = null) {
  const tariffs = dormityTariffs || getDormityTariffs();
  const tariff = tariffs.find(t => t.id === tariffId || t.id.startsWith(tariffId + '_'));
  if (!tariff) return 0;

  if (tariffId === 'DORMITY_MADRID') {
    const basePrice = Number(tariff.value) || 700;
    const extraCount = Math.max(0, extraOrders);
    const extraKey = 'DORMITY_MADRID_EXTRA';
    const extraTariff = tariffs.find(t => t.id === extraKey || t.id.startsWith(extraKey + '_'));
    const extraUnitPrice = extraTariff ? Number(extraTariff.value) : 70;
    return basePrice + (extraCount * extraUnitPrice);
  }

  return Number(tariff.value) || 0;
}

export function getUserAllowedProviders(user) {
  if (!user) return ['eci', 'dormity'];
  if (user.allowedProviders && Array.isArray(user.allowedProviders) && user.allowedProviders.length > 0) {
    return user.allowedProviders;
  }
  try {
    const saved = localStorage.getItem(`delivery_user_allowed_providers_${user.id}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  if (user.role === 'repartidor' && user.createdBy) {
    const creator = getUsers().find(u => u.id === user.createdBy);
    if (creator && creator.allowedProviders && Array.isArray(creator.allowedProviders) && creator.allowedProviders.length > 0) {
      return creator.allowedProviders;
    }
  }
  return ['eci', 'dormity'];
}

// Calcular precio de una tarifa individual
export function calculateTaskPrice(tariffId, tariffs = null, modulePrice = null) {
  const activeTariffs = tariffs || getTariffs();
  const activeModulePrice = modulePrice !== null ? modulePrice : getModulePrice();
  
  const tariff = activeTariffs.find(t => t.id === tariffId);
  if (!tariff) return 0;

  // Fix: a diferencia de la rama equivalente para tarifas Dormity
  // (calculateDormityTaskPrice), aquí no se comprobaba que tariff.value fuera
  // realmente un número. Si llegaba corrupto o vacío, el precio de esa tarea
  // se volvía inválido (NaN) y, como el total del ticket se calcula sumando
  // cada tarea una a una, ese único valor inválido invalidaba el total
  // completo del reparto sin ningún aviso. Se aplica la misma protección que
  // ya usa la rama Dormity: convertir siempre a número con 0 por defecto.
  if (tariff.type === 'fixed') {
    return Number(tariff.value) || 0;
  } else if (tariff.type === 'modules') {
    return (Number(tariff.value) || 0) * activeModulePrice;
  }
  return 0;
}

// Agregar un nuevo ticket (con lista flexible de tareas y cantidades)
// Fix: antes esta función guardaba en Supabase "en el aire" (sin await, sin
// devolver si falló), así que la pantalla mostraba "Guardado con éxito" y borraba
// el formulario aunque la subida a la nube hubiera fallado. Ahora es async y
// devuelve {success, error, ticket} para que quien llame pueda confirmar de
// verdad antes de avisar al usuario.
export async function addTicket(ticketData) {
  const tickets = getTickets();
  const tariffs = getTariffs();
  const dormityTariffs = getDormityTariffs();
  const modulePrice = getModulePrice();

  let totalCalculado = 0;
  let anyPriceNeedsReview = false;
  const detailedTasks = ticketData.tasks.map(task => {
    let basePrice = 0;
    let name = task.name;
    let priceNeedsReview = false;

    if (task.tariffId && task.tariffId.startsWith('DORMITY_')) {
      const dormityT = dormityTariffs.find(t => t.id === task.tariffId || t.id.startsWith(task.tariffId + '_'));
      basePrice = calculateDormityTaskPrice(task.tariffId, task.distanceKm || 0, task.extraOrders || 0, dormityTariffs);
      if (task.unitPrice !== undefined && task.unitPrice !== null && task.unitPrice > 0) {
        basePrice = task.unitPrice;
      }
      name = dormityT ? dormityT.name : (task.name || 'Servicio Dormity');
    } else {
      const catalogTariff = tariffs.find(t => t.id === task.tariffId);
      const isCustom = task.tariffId && task.tariffId.startsWith('CUSTOM_') && !catalogTariff;
      basePrice = isCustom
        ? (task.price || task.unitPrice || 0)
        : calculateTaskPrice(task.tariffId, tariffs, modulePrice);
      // Fix: si el tariffId no existe en el catálogo (borrado, editado o
      // corrupto), calculateTaskPrice() devuelve 0 en silencio y el ticket se
      // guardaría cobrando 0€ por esa tarea sin avisar a nadie. Si el propio
      // formulario ya traía un precio calculado para esa tarea, se conserva
      // ese precio en vez de ponerlo a 0€, y se marca la tarea/el ticket para
      // revisión manual del admin.
      if (basePrice === 0 && !isCustom && !catalogTariff && task.tariffId) {
        const fallbackPrice = task.unitPrice || task.price || 0;
        if (fallbackPrice > 0) {
          basePrice = fallbackPrice;
          priceNeedsReview = true;
          anyPriceNeedsReview = true;
        }
      }
      const tariff = tariffs.find(t => t.id === task.tariffId);
      name = tariff ? tariff.name : (task.name || 'Servicio Adicional');
      if (task.brand && task.inches) {
        const isComb = task.tariffId.includes('COMB') || task.action === 'combinado';
        const isRec = task.action === 'recogida';
        const typeStr = isComb ? 'Ent+Rec' : (isRec ? 'Recogida' : (task.tariffId.includes('ENT') ? 'Entrega' : ''));
        name = `${task.brand} ${task.inches}" (${typeStr || name})`;
      }
      // Fix: para Paquetería (Pequeño/Gran Volumen) el formulario ya arma el
      // nombre con la descripción de "qué se lleva" entre paréntesis (ej.
      // "Pequeño Volumen (ventilador de techo)"), pero esta línea lo pisaba
      // siempre con el nombre plano de la tarifa del catálogo, perdiendo la
      // descripción para siempre — nunca llegaba al Informe del Día ni a la
      // lista de repartos, y tampoco sobrevivía a una edición posterior del
      // ticket (que la reconstruye leyendo el paréntesis del nombre guardado).
      const isPaqueteria = task.tariffId && ['ENTREGA_PV', 'ENTREGA_GV', 'RECOGIDA_PV', 'RECOGIDA_GV'].includes(task.tariffId);
      if (isPaqueteria && task.name && task.name.includes('(')) {
        name = task.name;
      }
    }

    const price = round2(task.noCharge ? 0 : basePrice);
    const subtotal = round2(price * task.quantity);
    totalCalculado += subtotal;

    return {
      tariffId: task.tariffId,
      name: name,
      quantity: task.quantity,
      unitPrice: price,
      subtotal: subtotal,
      brand: task.brand || null,
      inches: task.inches || null,
      action: task.action || null,
      noCharge: !!task.noCharge,
      distanceKm: task.distanceKm || null,
      extraOrders: task.extraOrders || null,
      ...(priceNeedsReview ? { priceNeedsReview: true } : {})
    };
  });

  const users = getUsers();
  const activeShift = (JSON.parse(localStorage.getItem('delivery_shifts')) || [])
    .find(s => s.furgoId === ticketData.furgoId && s.date === (ticketData.date || new Date().toISOString().split('T')[0]));

  const inferredProvider = ticketData.provider || (ticketData.tasks && ticketData.tasks.some(t => t.tariffId && t.tariffId.startsWith('DORMITY_')) ? 'dormity' : 'eci');

  const newTicket = {
    // Fix: un id basado solo en Date.now() puede colisionar si dos dispositivos crean
    // un ticket en el mismo milisegundo (offline-first, con varios choferes/admins
    // trabajando a la vez). Añadimos un sufijo aleatorio, igual que ya se hace en otros
    // puntos de la app (ver App.jsx) para IDs generados en el cliente.
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    date: ticketData.date || new Date().toISOString().split('T')[0],
    furgoId: ticketData.furgoId,
    furgoLabel: users.find(u => u.id === ticketData.furgoId)?.label || ticketData.furgoId,
    routeName: ticketData.routeName || users.find(u => u.id === ticketData.furgoId)?.label || ticketData.furgoId,
    customerName: ticketData.customerName,
    phone: ticketData.phone || '',
    address: ticketData.address,
    postcode: ticketData.postcode || '',
    notes: ticketData.notes || '',
    codAmount: ticketData.codAmount || 0,
    provider: inferredProvider,
    tasks: detailedTasks,
    totalPrice: round2(totalCalculado),
    status: ticketData.status || 'pending',
    createdAt: new Date().toISOString(),
    lat: ticketData.lat || null,
    lng: ticketData.lng || null,
    routeOrder: ticketData.routeOrder || null,
    createdBy: ticketData.createdBy || 'admin',
    _syncStatus: 'pending',
    ...(anyPriceNeedsReview ? { priceNeedsReview: true } : {})
  };

  tickets.push(newTicket);
  const result = await saveTickets(tickets);
  return { ...result, ticket: newTicket };
}

// Actualizar un ticket existente
// Fix: mismo motivo que addTicket — ahora es async y devuelve {success, error, ticket}.
export async function updateTicket(updatedTicket) {
  const tickets = getTickets();
  const tariffs = getTariffs();
  const dormityTariffs = getDormityTariffs();
  const modulePrice = getModulePrice();

  let totalCalculado = 0;
  let anyPriceNeedsReview = false;
  const detailedTasks = updatedTicket.tasks.map(task => {
    let basePrice = 0;
    let name = task.name;
    let priceNeedsReview = false;

    if (task.tariffId && task.tariffId.startsWith('DORMITY_')) {
      const dormityT = dormityTariffs.find(t => t.id === task.tariffId || t.id.startsWith(task.tariffId + '_'));
      basePrice = calculateDormityTaskPrice(task.tariffId, task.distanceKm || 0, task.extraOrders || 0, dormityTariffs);
      if (task.unitPrice !== undefined && task.unitPrice !== null && task.unitPrice > 0) {
        basePrice = task.unitPrice;
      }
      name = dormityT ? dormityT.name : (task.name || 'Servicio Dormity');
    } else {
      const catalogTariff = tariffs.find(t => t.id === task.tariffId);
      const isCustom = task.tariffId && task.tariffId.startsWith('CUSTOM_') && !catalogTariff;
      basePrice = isCustom
        ? (task.price || task.unitPrice || 0)
        : calculateTaskPrice(task.tariffId, tariffs, modulePrice);
      // Fix: si el tariffId ya no existe en el catálogo (borrado/editado desde
      // que se creó el ticket), calculateTaskPrice() devuelve 0 en silencio y
      // se reescribiría a 0€ una tarea que YA se había cobrado correctamente
      // antes. Se conserva el precio anterior del propio ticket (unitPrice o
      // subtotal/cantidad) en vez de ponerlo a 0€, y se marca para revisión.
      if (basePrice === 0 && !isCustom && !catalogTariff && task.tariffId) {
        const previousUnitPrice = (task.unitPrice !== undefined && task.unitPrice !== null)
          ? task.unitPrice
          : (task.subtotal && task.quantity ? task.subtotal / task.quantity : 0);
        if (previousUnitPrice > 0) {
          basePrice = previousUnitPrice;
          priceNeedsReview = true;
          anyPriceNeedsReview = true;
        }
      }
      const tariff = tariffs.find(t => t.id === task.tariffId);
      name = tariff ? tariff.name : (task.name || 'Servicio Adicional');
      if (task.brand && task.inches) {
        const isComb = task.tariffId.includes('COMB') || task.action === 'combinado';
        const isRec = task.action === 'recogida';
        const typeStr = isComb ? 'Ent+Rec' : (isRec ? 'Recogida' : (task.tariffId.includes('ENT') ? 'Entrega' : ''));
        name = `${task.brand} ${task.inches}" (${typeStr || name})`;
      }
      // Fix: para Paquetería (Pequeño/Gran Volumen) el formulario ya arma el
      // nombre con la descripción de "qué se lleva" entre paréntesis (ej.
      // "Pequeño Volumen (ventilador de techo)"), pero esta línea lo pisaba
      // siempre con el nombre plano de la tarifa del catálogo, perdiendo la
      // descripción para siempre — nunca llegaba al Informe del Día ni a la
      // lista de repartos, y tampoco sobrevivía a una edición posterior del
      // ticket (que la reconstruye leyendo el paréntesis del nombre guardado).
      const isPaqueteria = task.tariffId && ['ENTREGA_PV', 'ENTREGA_GV', 'RECOGIDA_PV', 'RECOGIDA_GV'].includes(task.tariffId);
      if (isPaqueteria && task.name && task.name.includes('(')) {
        name = task.name;
      }
    }

    const price = round2(task.noCharge ? 0 : basePrice);
    const subtotal = round2(price * task.quantity);
    totalCalculado += subtotal;

    return {
      tariffId: task.tariffId,
      name: name,
      quantity: task.quantity,
      unitPrice: price,
      subtotal: subtotal,
      brand: task.brand || null,
      inches: task.inches || null,
      action: task.action || null,
      noCharge: !!task.noCharge,
      distanceKm: task.distanceKm || null,
      extraOrders: task.extraOrders || null,
      ...(priceNeedsReview ? { priceNeedsReview: true } : {})
    };
  });

  const index = tickets.findIndex(t => t.id === updatedTicket.id);
  if (index !== -1) {
    const users = getUsers();
    const activeShift = (JSON.parse(localStorage.getItem('delivery_shifts')) || [])
      .find(s => s.furgoId === updatedTicket.furgoId && s.date === updatedTicket.date);

    const inferredProvider = updatedTicket.provider || tickets[index].provider || (updatedTicket.tasks && updatedTicket.tasks.some(t => t.tariffId && t.tariffId.startsWith('DORMITY_')) ? 'dormity' : 'eci');

    tickets[index] = {
      ...tickets[index],
      date: updatedTicket.date,
      furgoId: updatedTicket.furgoId,
      furgoLabel: users.find(u => u.id === updatedTicket.furgoId)?.label || updatedTicket.furgoId,
      routeName: updatedTicket.routeName || users.find(u => u.id === updatedTicket.furgoId)?.label || updatedTicket.furgoId,
      customerName: updatedTicket.customerName,
      phone: updatedTicket.phone || '',
      address: updatedTicket.address,
      postcode: updatedTicket.postcode !== undefined ? updatedTicket.postcode : tickets[index].postcode || '',
      notes: updatedTicket.notes || '',
      codAmount: updatedTicket.codAmount || 0,
      provider: inferredProvider,
      tasks: detailedTasks,
      totalPrice: round2(totalCalculado),
      status: updatedTicket.status || tickets[index].status || 'pending',
      lat: updatedTicket.lat !== undefined ? updatedTicket.lat : tickets[index].lat,
      lng: updatedTicket.lng !== undefined ? updatedTicket.lng : tickets[index].lng,
      completedLat: updatedTicket.completedLat !== undefined ? updatedTicket.completedLat : tickets[index].completedLat,
      completedLng: updatedTicket.completedLng !== undefined ? updatedTicket.completedLng : tickets[index].completedLng,
      routeOrder: updatedTicket.routeOrder !== undefined ? updatedTicket.routeOrder : tickets[index].routeOrder,
      createdBy: updatedTicket.createdBy || tickets[index].createdBy || 'admin',
      _syncStatus: 'pending',
      priceNeedsReview: anyPriceNeedsReview
    };
    const result = await saveTickets(tickets);
    return { ...result, ticket: tickets[index] };
  }
  return { success: false, error: new Error('Ticket no encontrado'), ticket: null };
}

// Actualizar el estado de un ticket
export function updateTicketStatus(ticketId, status, failureReason = '', completedLat = null, completedLng = null) {
  const tickets = getTickets();
  const index = tickets.findIndex(t => t.id === ticketId);
  if (index !== -1) {
    tickets[index].status = status;
    if (status === 'failed') {
      tickets[index].failureReason = failureReason;
    } else {
      delete tickets[index].failureReason;
    }
    if (completedLat !== null && completedLng !== null) {
      tickets[index].completedLat = completedLat;
      tickets[index].completedLng = completedLng;
    }

    if (status === 'success' || status === 'failed') {
      const parsed = parseTicketNotes(tickets[index].notes);
      if (!parsed.completedAt) {
        const completedAt = new Date().toISOString();
        tickets[index].completedAt = completedAt;
        tickets[index].notes = encodeTicketNotes(
          parsed.timeSlot,
          parsed.estimatedDuration,
          parsed.cleanNotes,
          parsed.driverObservations,
          parsed.failedChargeType,
          parsed.originalRouteLabel,
          completedAt
        );
      } else {
        tickets[index].completedAt = parsed.completedAt;
      }
    } else {
      delete tickets[index].completedAt;
      const parsed = parseTicketNotes(tickets[index].notes);
      tickets[index].notes = encodeTicketNotes(
        parsed.timeSlot,
        parsed.estimatedDuration,
        parsed.cleanNotes,
        parsed.driverObservations,
        parsed.failedChargeType,
        parsed.originalRouteLabel,
        ''
      );
    }

    // Auto-reassignment if finalized (success or failed) and has [Ruta Original: XXX] in notes
    if ((status === 'success' || status === 'failed') && tickets[index].notes && tickets[index].notes.startsWith('[Ruta Original: ')) {
      const notesStr = tickets[index].notes;
      const endIdx = notesStr.indexOf(']');
      if (endIdx !== -1) {
        const origLabel = notesStr.substring(16, endIdx).trim();
        const users = JSON.parse(localStorage.getItem('delivery_users')) || [];
        const targetUser = users.find(u => 
          u.label.toLowerCase() === origLabel.toLowerCase() || 
          u.username.toLowerCase() === origLabel.toLowerCase()
        );
        if (targetUser) {
          const helperUser = users.find(u => u.id === tickets[index].furgoId);
          const helperLabel = helperUser ? helperUser.label : tickets[index].furgoId;
          tickets[index].notes = `${notesStr} (Auxilio realizado por ${helperLabel})`.trim();
          tickets[index].furgoId = targetUser.id;
          tickets[index].furgoLabel = targetUser.label;
          tickets[index].routeName = `Ruta ${targetUser.label} (${tickets[index].date})`;
        }
      }
    }

    tickets[index]._syncStatus = 'pending';
    saveTickets(tickets);
    return tickets[index];
  }
  return null;
}

// Eliminar un ticket (para el administrador)
// Fix: antes el borrado en la nube era "fire and forget" (sin await, sin avisar
// si falló) — la pantalla ya mostraba "Eliminado" aunque el ticket siguiera vivo
// en Supabase. Ahora es async y devuelve {success, error} para que quien llama
// pueda confirmar antes de dar el borrado por hecho.
export async function deleteTicket(ticketId) {
  const tickets = getTickets();
  const filtered = tickets.filter(t => t.id !== ticketId);
  saveTickets(filtered);

  // Track tombstone deleted ID to avoid re-downloading during background sync
  try {
    const deletedIds = JSON.parse(localStorage.getItem('delivery_deleted_tickets')) || [];
    deletedIds.push(ticketId);
    localStorage.setItem('delivery_deleted_tickets', JSON.stringify(deletedIds));
  } catch (e) {}

  if (supabase) {
    const { error } = await supabase.from('delivery_tickets').delete().eq('id', ticketId);
    if (error) {
      console.error("Error deleting ticket from Supabase:", error);
      return { success: false, error };
    } else {
      // Remove tombstone ID once confirmed deleted on the cloud
      try {
        const currentDeleted = JSON.parse(localStorage.getItem('delivery_deleted_tickets')) || [];
        const updatedDeleted = currentDeleted.filter(id => id !== ticketId);
        localStorage.setItem('delivery_deleted_tickets', JSON.stringify(updatedDeleted));
      } catch (e) {}
      return { success: true };
    }
  }
  return { success: true };
}

// Iniciar mes de cero
// Fix: antes esto solo vaciaba la lista local (saveTickets([]) no borra nada en
// la nube porque no hay ningún ticket marcado como "pendiente de subir" en un
// array vacío) — los repartos "reseteados" volvían a aparecer solos en la
// siguiente sincronización. Ahora se borran de verdad en Supabase y se registran
// como tombstone, igual que el borrado individual de un ticket.
export async function resetMonthlyTickets() {
  const tickets = getTickets();
  const idsToDelete = tickets.map(t => t.id).filter(Boolean);

  saveTickets([]);

  if (idsToDelete.length === 0) return { success: true };

  try {
    const deletedIds = JSON.parse(localStorage.getItem('delivery_deleted_tickets')) || [];
    localStorage.setItem('delivery_deleted_tickets', JSON.stringify([...new Set([...deletedIds, ...idsToDelete])]));
  } catch (e) {}

  if (supabase) {
    const { error } = await supabase.from('delivery_tickets').delete().in('id', idsToDelete);
    if (error) {
      console.error("Error borrando tickets en el reset mensual:", error);
      return { success: false, error };
    }
    try {
      const deletedIds = JSON.parse(localStorage.getItem('delivery_deleted_tickets')) || [];
      localStorage.setItem('delivery_deleted_tickets', JSON.stringify(deletedIds.filter(id => !idsToDelete.includes(id))));
    } catch (e) {}
  }
  return { success: true };
}

// Obtener rango de TV según las pulgadas
export function getTVRange(inches) {
  const inch = parseInt(inches, 10);
  if (inch <= 49) return '49';
  if (inch <= 74) return '74';
  return '115';
}

// Parse helper, matricula and clean observations from observations string
export function parseObservationsHelper(obsText) {
  if (!obsText) return { helper: '', matricula: '', customDriver: '', observations: '' };
  let str = obsText.toString();
  let helper = '';
  let matricula = '';
  let customDriver = '';

  // Extract Chofer
  if (str.startsWith('[Chofer: ')) {
    const endIdx = str.indexOf(']');
    if (endIdx !== -1) {
      customDriver = str.substring(9, endIdx).trim();
      str = str.substring(endIdx + 1).trim();
    }
  } else if (str.includes('[Chofer: ')) {
    const startIdx = str.indexOf('[Chofer: ');
    const endIdx = str.indexOf(']', startIdx);
    if (endIdx !== -1) {
      customDriver = str.substring(startIdx + 9, endIdx).trim();
      str = (str.substring(0, startIdx) + str.substring(endIdx + 1)).trim();
    }
  }

  // Extract Ayudante
  if (str.startsWith('[Ayudante: ')) {
    const endIdx = str.indexOf(']');
    if (endIdx !== -1) {
      helper = str.substring(11, endIdx).trim();
      str = str.substring(endIdx + 1).trim();
    }
  } else if (str.includes('[Ayudante: ')) {
    const startIdx = str.indexOf('[Ayudante: ');
    const endIdx = str.indexOf(']', startIdx);
    if (endIdx !== -1) {
      helper = str.substring(startIdx + 11, endIdx).trim();
      str = (str.substring(0, startIdx) + str.substring(endIdx + 1)).trim();
    }
  }

  // Extract Matricula
  if (str.startsWith('[Matricula: ')) {
    const endIdx = str.indexOf(']');
    if (endIdx !== -1) {
      matricula = str.substring(12, endIdx).trim();
      str = str.substring(endIdx + 1).trim();
    }
  } else if (str.includes('[Matricula: ')) {
    const startIdx = str.indexOf('[Matricula: ');
    const endIdx = str.indexOf(']', startIdx);
    if (endIdx !== -1) {
      matricula = str.substring(startIdx + 12, endIdx).trim();
      str = (str.substring(0, startIdx) + str.substring(endIdx + 1)).trim();
    }
  }

  return { helper, matricula, customDriver, observations: str };
}

// Encode helper, matricula and observations into observations string
export function encodeObservationsHelper(helper, matricula, customDriver, obsText) {
  let cleanObs = obsText || '';
  let prefixes = '';
  if (customDriver && customDriver.trim()) {
    prefixes += `[Chofer: ${customDriver.trim()}] `;
  }
  if (helper && helper.trim()) {
    prefixes += `[Ayudante: ${helper.trim()}] `;
  }
  if (matricula && matricula.trim()) {
    prefixes += `[Matricula: ${matricula.trim()}] `;
  }
  return `${prefixes}${cleanObs}`.trim();
}

// Obtener turnos
export function getShifts() {
  initDB();
  // Fix: un valor corrupto en localStorage aquí tumbaba cualquier pantalla que
  // dependiera de los turnos (planificación, nómina, dashboard). Se captura y
  // se cae a [] en vez de dejar que la excepción se propague sin control.
  try {
    return JSON.parse(localStorage.getItem('delivery_shifts')) || [];
  } catch (e) {
    console.error('Error parsing delivery_shifts:', e);
    return [];
  }
}

// Guardar turnos
export async function saveShifts(shifts) {
  localStorage.setItem('delivery_shifts', JSON.stringify(shifts));
  if (supabase) {
    isSaving++; // contador, no booleano (ver comentario junto a la declaración de isSaving)
    try {
      const basicShifts = shifts.map(s => ({
        id: s.id,
        furgo_id: s.furgoId,
        date: s.date,
        status: s.status,
        opened_at: s.openedAt || null,
        closed_at: s.closedAt || null,
        created_by: s.createdBy || 'admin'
      }));
      const { error } = await supabase.from('delivery_shifts').upsert(basicShifts);
      if (error) {
        console.error("Error saving basic shifts to Supabase:", error);
        return { success: false, error };
      }

      // Save metadata for all shifts in settings in a single batch upsert
      const metaRows = shifts.map(s => ({
        key: `shift_meta_${s.id}`,
        value: JSON.stringify({
          helper: s.helper || '',
          helper2: s.helper2 || '',
          matricula: s.matricula || '',
          customDriver: s.customDriver || '',
          observations: s.observations || '',
          routeName: s.routeName || '',
          kms: s.kms || null,
          startKms: s.startKms || null,
          endKms: s.endKms || null,
          summary: s.summary || null
        })
      }));
      if (metaRows.length > 0) {
        const { error: metaErr } = await supabase.from('delivery_settings').upsert(metaRows);
        if (metaErr) {
          console.error("Error saving shift meta batch to Supabase:", metaErr);
        }
      }

      // Fix: si la subida del turno fue bien, limpiar _syncStatus de los turnos
      // afectados, igual que ya hace saveTickets(). Esto es lo que permite que la
      // protección de merge en el pull (ver más arriba) sepa quién sigue "pendiente
      // de confirmar" y quién ya se subió con éxito.
      if (!error) {
        try {
          const currentLocal = JSON.parse(localStorage.getItem('delivery_shifts')) || [];
          const savedIds = new Set(shifts.map(s => s.id));
          const updatedLocal = currentLocal.map(s => {
            if (s && savedIds.has(s.id) && s._syncStatus === 'pending') {
              const { _syncStatus, ...rest } = s;
              return rest;
            }
            return s;
          });
          localStorage.setItem('delivery_shifts', JSON.stringify(updatedLocal));
        } catch (e) {
          console.error("Error clearing local shift sync status:", e);
        }
      }
    } catch (e) {
      console.error("Error saving shifts or meta to Supabase:", e);
      return { success: false, error: e };
    } finally {
      isSaving = Math.max(0, isSaving - 1);
    }
  }
  return { success: true };
}

// Comprobar si el turno para una furgoneta en una fecha está cerrado
export function getShiftStatus(furgoId, date) {
  const shifts = getShifts();
  const shift = shifts.find(s => s.furgoId === furgoId && s.date === date);
  return shift ? shift.status : 'open';
}

// Obtener un turno específico
export function getShift(furgoId, date) {
  const shifts = getShifts();
  return shifts.find(s => s.furgoId === furgoId && s.date === date) || null;
}

// Guardar o cambiar el nombre de la ruta de una jornada
// Fix (hallazgo #22): esta función delegaba en saveShifts() sin esperar su
// resultado ni devolverlo, así que quien llamaba nunca podía saber si el
// guardado en la nube realmente funcionó. Ahora es async y devuelve el mismo
// {success, error} que ya devuelve saveShifts().
export async function saveShiftRoute(furgoId, date, routeName) {
  const shifts = getShifts();
  const shiftId = `${furgoId}_${date}`;
  const index = shifts.findIndex(s => s.id === shiftId);
  if (index !== -1) {
    shifts[index].routeName = routeName;
  } else {
    shifts.push({
      id: shiftId,
      furgoId,
      date,
      status: 'open',
      closedAt: null,
      routeName: routeName,
      summary: null
    });
  }
  return await saveShifts(shifts);
}

// Cerrar el turno de un día
// Fix (hallazgo #22): igual que saveShiftRoute, no esperaba ni devolvía la
// confirmación real de saveShifts(). Cerrar un turno es una operación
// importante (dispara el cálculo de nómina/kms), así que conviene saber de
// verdad si llegó a la nube.
export async function closeShift(furgoId, date, summary) {
  const shifts = getShifts();
  const shiftId = `${furgoId}_${date}`;
  const existingIndex = shifts.findIndex(s => s.id === shiftId);
  const existingShift = existingIndex !== -1 ? shifts[existingIndex] : {};

  const helper = existingShift.helper || (summary ? summary.helper : '') || '';
  const matricula = existingShift.matricula || (summary ? summary.matricula : '') || '';
  const customDriver = existingShift.customDriver || '';

  const newShift = {
    id: shiftId,
    furgoId,
    date,
    status: 'closed',
    closedAt: new Date().toISOString(),
    routeName: existingShift.routeName || '',
    helper,
    matricula,
    customDriver,
    kms: summary ? summary.kms : null,
    startKms: summary ? summary.startKms : null,
    endKms: summary ? summary.endKms : null,
    observations: summary ? summary.observations : '',
    summary
  };

  if (existingIndex !== -1) {
    shifts[existingIndex] = newShift;
  } else {
    shifts.push(newShift);
  }

  const result = await saveShifts(shifts);
  return { ...(result || {}), shift: newShift };
}

// Guardar turno planificado (fecha, chofer, ayudante, matricula y chofer personalizado)
// Fix (hallazgo #22): mismo motivo — delegaba en saveShifts() sin esperar ni
// devolver su resultado.
export async function savePlannedShift(furgoId, date, helper, matricula, customDriver, createdBy = 'admin', helper2 = '') {
  const shifts = getShifts();
  const shiftId = `${furgoId}_${date}`;
  const index = shifts.findIndex(s => s.id === shiftId);
  if (index !== -1) {
    shifts[index].helper = helper;
    shifts[index].helper2 = helper2;
    shifts[index].matricula = matricula;
    shifts[index].customDriver = customDriver;
    if (createdBy && createdBy !== 'admin') {
      shifts[index].createdBy = createdBy;
    }
  } else {
    shifts.push({
      id: shiftId,
      furgoId,
      date,
      status: 'open',
      openedAt: null,
      closedAt: null,
      helper,
      helper2,
      matricula,
      customDriver,
      observations: '',
      routeName: '',
      createdBy
    });
  }
  saveShifts(shifts);
}

// Eliminar un turno planificado
// Fix: no dejaba tombstone (a diferencia de deleteTicket), así que un turno
// borrado podía "revivir" solo con la siguiente sincronización si el borrado
// remoto fallaba o llegaba tarde. Ahora registra el borrado igual que los tickets
// y devuelve {success, error} en vez de ser fire-and-forget.
export async function deletePlannedShift(furgoId, date) {
  const shifts = getShifts();
  const shiftId = `${furgoId}_${date}`;
  const filtered = shifts.filter(s => s.id !== shiftId);
  saveShifts(filtered);

  try {
    const deletedIds = JSON.parse(localStorage.getItem('delivery_deleted_shifts')) || [];
    deletedIds.push(shiftId);
    localStorage.setItem('delivery_deleted_shifts', JSON.stringify(deletedIds));
  } catch (e) {}

  if (supabase) {
    const { error } = await supabase.from('delivery_shifts').delete().eq('id', shiftId);
    if (error) {
      console.error("Error deleting planned shift from Supabase:", error);
      return { success: false, error };
    }
    supabase.from('delivery_settings').delete().eq('key', `shift_meta_${shiftId}`).then(({ error: metaErr }) => {
      if (metaErr) console.error("Error deleting shift meta from Supabase:", metaErr);
    });
    try {
      const deletedIds = JSON.parse(localStorage.getItem('delivery_deleted_shifts')) || [];
      localStorage.setItem('delivery_deleted_shifts', JSON.stringify(deletedIds.filter(id => id !== shiftId)));
    } catch (e) {}
  }
  return { success: true };
}

// Reabrir un turno
// Fix: antes no se esperaba la confirmación real de la nube — quien llamaba
// refrescaba la pantalla a un tiempo fijo (100ms) asumiendo que ya había terminado,
// lo que con una red lenta podía seguir mostrando "Cerrado" pese al aviso de éxito.
export async function reopenShift(furgoId, date) {
  const shifts = getShifts();
  const shiftId = `${furgoId}_${date}`;
  const index = shifts.findIndex(s => s.id === shiftId);
  if (index !== -1) {
    shifts[index].status = 'open';
    shifts[index].closedAt = null;
    const result = await saveShifts(shifts);
    return result || { success: true };
  }
  return { success: false, error: new Error('Turno no encontrado') };
}

// Resetear turnos mensuales
// Fix: igual que resetMonthlyTickets, saveShifts([]) por sí solo no borra nada
// en la nube (un array vacío no tiene turnos "pendientes de subir" que marcar
// para borrado), así que los turnos "reseteados" volvían a aparecer en la
// siguiente sincronización. Ahora se borran de verdad en Supabase y se
// registran como tombstone en delivery_deleted_shifts, igual que
// deletePlannedShift.
export async function resetMonthlyShifts() {
  const shifts = getShifts();
  const idsToDelete = shifts.map(s => s.id).filter(Boolean);

  saveShifts([]);

  if (idsToDelete.length === 0) return { success: true };

  try {
    const deletedIds = JSON.parse(localStorage.getItem('delivery_deleted_shifts')) || [];
    localStorage.setItem('delivery_deleted_shifts', JSON.stringify([...new Set([...deletedIds, ...idsToDelete])]));
  } catch (e) {}

  if (supabase) {
    const { error } = await supabase.from('delivery_shifts').delete().in('id', idsToDelete);
    if (error) {
      console.error("Error borrando turnos en el reset mensual:", error);
      return { success: false, error };
    }
    try {
      const deletedIds = JSON.parse(localStorage.getItem('delivery_deleted_shifts')) || [];
      localStorage.setItem('delivery_deleted_shifts', JSON.stringify(deletedIds.filter(id => !idsToDelete.includes(id))));
    } catch (e) {}
  }
  return { success: true };
}

// Crear nuevo usuario dinámicamente
export async function addUser(username, label, password, role = 'repartidor', createdBy = null, email = null, auth_uid = null, allowedProviders = ['eci', 'dormity']) {
  const users = getUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'El usuario ya existe' };
  }
  if (email && users.some(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, error: 'El correo electrónico ya está registrado' };
  }

  // Fix: la comprobación de arriba solo mira el array local (localStorage), que puede
  // estar desactualizado respecto a otros dispositivos. Si dos personas creaban casi a
  // la vez un usuario con el mismo nombre desde dispositivos distintos, ambas pasaban
  // esta comprobación local y el segundo guardado sobrescribía en silencio al primero
  // en Supabase (mismo id determinista = nombre de usuario en minúsculas). Añadimos una
  // comprobación en vivo contra Supabase antes de crear.
  if (supabase) {
    try {
      const { data: existingRemote } = await supabase
        .from('delivery_users')
        .select('id')
        .ilike('username', username);
      if (existingRemote && existingRemote.length > 0) {
        return { success: false, error: 'El usuario ya existe (registrado desde otro dispositivo)' };
      }
      if (email) {
        const { data: existingRemoteEmail } = await supabase
          .from('delivery_users')
          .select('id')
          .ilike('email', email);
        if (existingRemoteEmail && existingRemoteEmail.length > 0) {
          return { success: false, error: 'El correo electrónico ya está registrado (desde otro dispositivo)' };
        }
      }
    } catch (e) {
      console.error("Error comprobando colisión de usuario contra Supabase:", e);
      // Si falla la comprobación remota (sin red, etc.) seguimos solo con la local,
      // igual que antes de este fix, para no bloquear la creación de usuarios offline.
    }
  }

  const newUser = {
    id: username.toLowerCase().trim(),
    username: username.trim(),
    label: label.trim(),
    password: password.trim(),
    role,
    createdBy,
    mustChangePassword: true,
    email: email || null,
    auth_uid: auth_uid || null,
    allowedProviders: allowedProviders && Array.isArray(allowedProviders) && allowedProviders.length > 0 ? allowedProviders : ['eci', 'dormity']
  };
  users.push(newUser);
  await saveUsers(users);
  return { success: true, user: newUser };
}

export async function updateUserAllowedProviders(userId, allowedProviders) {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  const provs = allowedProviders && Array.isArray(allowedProviders) && allowedProviders.length > 0 ? allowedProviders : ['eci', 'dormity'];
  
  if (index !== -1) {
    users[index].allowedProviders = provs;
  }
  
  try {
    localStorage.setItem(`delivery_user_allowed_providers_${userId}`, JSON.stringify(provs));
  } catch (e) {}

  await saveUsers(users);
  
  if (supabase) {
    try {
      await supabase.from('delivery_settings').upsert({
        key: `user_allowed_providers_${userId}`,
        value: JSON.stringify(provs)
      });
    } catch (e) {
      console.error("Error saving allowed providers to Supabase settings:", e);
    }
  }
  return true;
}

// Inicializar tarifas de un administrador (copiar por defecto o a 0)
export async function initializeAdminTariffs(newAdminId, option, creatorTariffs, allowedProviders = ['eci', 'dormity']) {
  if (option === 'none' || (allowedProviders && Array.isArray(allowedProviders) && !allowedProviders.includes('eci'))) {
    return [];
  }
  const currentTariffs = JSON.parse(localStorage.getItem('delivery_tariffs')) || [];
  
  // Lista base: usar las del creador si existen, o sino las DEFAULT_TARIFFS
  const baseTariffs = creatorTariffs && creatorTariffs.length > 0 ? creatorTariffs : DEFAULT_TARIFFS;
  
  const newTariffsToInsert = baseTariffs.map(t => {
    let baseId = t.id;
    // Eliminar sufijo del creador si existe
    if (t.createdBy && t.id.endsWith(`_${t.createdBy}`)) {
      baseId = t.id.slice(0, -`_${t.createdBy}`.length);
    }
    
    let dbId = baseId;
    if (!t.id.startsWith('CUSTOM_')) {
      dbId = `${baseId}_${newAdminId}`;
    } else {
      dbId = 'CUSTOM_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }
    
    return {
      ...t,
      id: dbId,
      value: option === 'copy_default' ? t.value : 0,
      createdBy: newAdminId
    };
  });
  
  const updatedTariffs = [...currentTariffs, ...newTariffsToInsert];
  await saveTariffs(updatedTariffs);
  return newTariffsToInsert;
}

// Eliminar un usuario
// Desactiva una cuenta (reversible): no borra nada, solo impide iniciar sesión
// y la marca como inactiva. Es la acción por defecto para "quitar" un usuario.
export async function deactivateUser(userId) {
  const users = getUsers();
  const updated = users.map(u => u.id === userId ? { ...u, active: false } : u);
  localStorage.setItem('delivery_users', JSON.stringify(updated));
  if (!supabase) return { success: true };
  const { error } = await supabase.from('delivery_users').update({ active: false }).eq('id', userId);
  if (error) {
    console.error("Error deactivating user in Supabase:", error);
    return { success: false, error };
  }
  return { success: true };
}

// Reactiva una cuenta previamente desactivada.
export async function reactivateUser(userId) {
  const users = getUsers();
  const updated = users.map(u => u.id === userId ? { ...u, active: true } : u);
  localStorage.setItem('delivery_users', JSON.stringify(updated));
  if (!supabase) return { success: true };
  const { error } = await supabase.from('delivery_users').update({ active: true }).eq('id', userId);
  if (error) {
    console.error("Error reactivating user in Supabase:", error);
    return { success: false, error };
  }
  return { success: true };
}

// Borrado PERMANENTE y real de una cuenta (irreversible). Reservado para el
// superadministrador. Espera la confirmación real de Supabase antes de tocar
// la copia local, para no mostrar nunca "eliminado" si en realidad falló.
export async function deleteUserPermanently(userId) {
  if (!supabase) {
    return { success: false, error: new Error('Sin conexión a la base de datos. No se puede eliminar de forma permanente sin conexión.') };
  }
  const { error } = await supabase.from('delivery_users').delete().eq('id', userId);
  if (error) {
    console.error("Error deleting user permanently from Supabase:", error);
    return { success: false, error };
  }
  const users = getUsers();
  const filtered = users.filter(u => u.id !== userId);
  localStorage.setItem('delivery_users', JSON.stringify(filtered));
  return { success: true };
}

// Obtener nombre de la aplicación
export function getAppName(userId) {
  if (userId) {
    const customName = localStorage.getItem(`delivery_app_name_${userId}`);
    if (customName) {
      if (customName === 'My Delevery Team' || customName === 'MY Delevery Team' || customName.toLowerCase().includes('delevery')) {
        localStorage.setItem(`delivery_app_name_${userId}`, 'My Delivery Team');
        return 'My Delivery Team';
      }
      return customName;
    }
  }
  const globalName = localStorage.getItem('delivery_app_name');
  if (globalName === 'My Delevery Team' || globalName === 'MY Delevery Team' || (globalName && globalName.toLowerCase().includes('delevery'))) {
    localStorage.setItem('delivery_app_name', 'My Delivery Team');
    return 'My Delivery Team';
  }
  return globalName || 'My Delivery Team';
}

// Guardar nombre de la aplicación
// Fix (hallazgo #22): esta y las siguientes funciones de ajustes enviaban el
// cambio a la nube sin esperar su confirmación (fire-and-forget con .then()),
// así que si la red fallaba, el cambio quedaba solo en este dispositivo sin
// que nadie se enterara. Ahora son async y esperan (await) la confirmación
// real, devolviendo {success, error}.
export async function saveAppName(name, userId) {
  if (userId) {
    localStorage.setItem(`delivery_app_name_${userId}`, name.trim());
  }
  localStorage.setItem('delivery_app_name', name.trim());
  if (supabase) {
    const key = userId ? `app_name_${userId}` : 'app_name';
    const { error } = await supabase.from('delivery_settings').upsert({ key, value: name.trim() });
    if (error) {
      console.error("Error saving app name to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

// Obtener tema visual (por cuenta, sincronizado entre dispositivos vía Supabase)
export function getAppTheme(userId) {
  if (userId) {
    const custom = localStorage.getItem(`delivery_app_theme_${userId}`);
    if (custom) return custom;
  }
  return localStorage.getItem('delivery_app_theme') || 'theme-emerald';
}

// Guardar tema visual
export async function saveAppTheme(theme, userId) {
  if (userId) {
    localStorage.setItem(`delivery_app_theme_${userId}`, theme);
  }
  localStorage.setItem('delivery_app_theme', theme);
  if (supabase) {
    const key = userId ? `app_theme_${userId}` : 'app_theme';
    const { error } = await supabase.from('delivery_settings').upsert({ key, value: theme });
    if (error) {
      console.error("Error saving app theme to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

// Obtener precio de kilómetro
export function getKmPrice(userId) {
  if (userId) {
    const custom = localStorage.getItem(`delivery_km_price_${userId}`);
    if (custom) return parseFloat(custom) || 0.43;
  }
  const globalPrice = localStorage.getItem('delivery_km_price');
  return globalPrice !== null ? (parseFloat(globalPrice) || 0.43) : 0.43;
}

// Guardar precio de kilómetro
export async function saveKmPrice(price, userId) {
  const pStr = price.toString();
  if (userId) {
    localStorage.setItem(`delivery_km_price_${userId}`, pStr);
  }
  localStorage.setItem('delivery_km_price', pStr);
  if (supabase) {
    const key = userId ? `km_price_${userId}` : 'km_price';
    const { error } = await supabase.from('delivery_settings').upsert({ key, value: pStr });
    if (error) {
      console.error("Error saving km price to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

// Obtener precio de combustible (gasoil) por litro
export function getFuelPrice(userId) {
  if (userId) {
    const custom = localStorage.getItem(`delivery_fuel_price_${userId}`);
    if (custom) return parseFloat(custom) || 1.65;
  }
  const globalPrice = localStorage.getItem('delivery_fuel_price');
  return globalPrice !== null ? (parseFloat(globalPrice) || 1.65) : 1.65;
}

// Guardar precio de combustible (gasoil) por litro
export async function saveFuelPrice(price, userId) {
  const pStr = price.toString();
  if (userId) {
    localStorage.setItem(`delivery_fuel_price_${userId}`, pStr);
  }
  localStorage.setItem('delivery_fuel_price', pStr);
  if (supabase) {
    const key = userId ? `fuel_price_${userId}` : 'fuel_price';
    const { error } = await supabase.from('delivery_settings').upsert({ key, value: pStr });
    if (error) {
      console.error("Error saving fuel price to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}


// Obtener kms de una ruta
export function getRouteKms(furgoId, date) {
  const key = `delivery_route_kms_${furgoId}_${date}`;
  const kms = localStorage.getItem(key);
  return kms !== null ? (parseFloat(kms) || 0) : 0;
}

// Guardar kms de una ruta
export async function saveRouteKms(furgoId, date, kms) {
  const key = `delivery_route_kms_${furgoId}_${date}`;
  const kStr = kms.toString();
  localStorage.setItem(key, kStr);
  if (supabase) {
    const dbKey = `route_kms_${furgoId}_${date}`;
    const { error } = await supabase.from('delivery_settings').upsert({ key: dbKey, value: kStr });
    if (error) {
      console.error("Error saving route kms to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

// Agregar nueva tarifa
export async function addTariff(tariff) {
  // Fix: esta capa de datos no validaba nada contra un valor negativo, vacío o
  // no numérico — un valor así se propagaría directamente al cálculo de
  // precios de cualquier ticket que use esta tarifa, restando del total sin
  // ningún aviso de error. Se valida aquí también (además de en la pantalla),
  // por si algún otro punto de la app llega a llamar a addTariff() sin pasar
  // por esa validación.
  const safeValue = Number(tariff?.value);
  if (!Number.isFinite(safeValue) || safeValue < 0) {
    return { success: false, error: new Error('El valor de la tarifa debe ser un número mayor o igual a cero') };
  }

  const tariffs = getTariffs();
  // Fix: un id basado solo en Date.now() puede colisionar si dos administradores
  // en dispositivos distintos crean una tarifa personalizada en el mismo
  // milisegundo — una sustituiría silenciosamente a la otra. Se añade el mismo
  // sufijo aleatorio que ya se usa en el resto de IDs generados en el cliente
  // (ver addTicket en este mismo archivo).
  const id = 'CUSTOM_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newTariff = {
    ...tariff,
    value: safeValue,
    id
  };
  tariffs.push(newTariff);
  await saveTariffs(tariffs);
  return { success: true, tariff: newTariff };
}

// Eliminar tarifa
export async function deleteTariff(id) {
  isSaving++; // contador, no booleano (ver comentario junto a la declaración de isSaving)
  try {
    const tariffs = getTariffs();
    const filtered = tariffs.filter(t => t.id !== id);
    await saveTariffs(filtered);
    if (supabase) {
      // Fix: getTariffs() devuelve el id SIN el sufijo de admin (baseId) para tarifas
      // propias de un admin (ver el mismo patrón "_<adminId>" que usa saveTariffs()).
      // Borrar en Supabase con ese baseId tal cual no encontraba la fila real (quedaba
      // huérfana en la nube y reaparecía en el siguiente sync) o, si existía otra
      // tarifa global/de otro admin con ese mismo id corto, se borraba por error esa
      // tarifa equivocada. Reconstruimos aquí el mismo id sufijado que usa
      // saveTariffs() antes de borrar.
      let activeAdminId = null;
      let isSuperAdmin = false;
      try {
        const savedUser = localStorage.getItem('delivery_session');
        if (savedUser) {
          const u = JSON.parse(savedUser);
          if (u) {
            if (u.role === 'admin') activeAdminId = u.id;
            else if (u.role === 'superadmin') isSuperAdmin = true;
          }
        }
      } catch (e) {}

      let realId = id;
      if (!isSuperAdmin && activeAdminId && !id.startsWith('CUSTOM_')) {
        const rawTariffs = JSON.parse(localStorage.getItem('delivery_tariffs')) || [];
        const suffixedId = `${id}_${activeAdminId}`;
        if (rawTariffs.some(t => t.id === suffixedId)) {
          realId = suffixedId;
        }
      }

      const { error } = await supabase.from('delivery_tariffs').delete().eq('id', realId);
      if (error) console.error("Error deleting tariff from Supabase:", error);
    }
  } finally {
    isSaving = Math.max(0, isSaving - 1);
  }
}

// Guardar ubicación en tiempo real de un repartidor
// Fix (hallazgo #22): se deja como función async con await interno para que
// realmente confirme el guardado (en vez de un .then() suelto), pero se sigue
// llamando sin esperar su resultado en el polling de ubicación (cada pocos
// segundos) — aquí no tiene sentido bloquear ni avisar al chofer por un fallo
// puntual de un solo ping de posición.
// Fix (fuga de egress, parte 2): watchPosition() en App.jsx llama a esta función en
// CADA posición nueva que reporta el GPS del móvil, sin ningún límite. En muchos
// dispositivos con alta precisión activada eso dispara varias veces por segundo,
// y cada una mandaba un POST a Supabase de inmediato — confirmado en los logs
// (un POST a delivery_settings prácticamente cada segundo mientras un repartidor
// tenía la app abierta). El mapa en tiempo real no necesita esa frecuencia: con
// actualizar la ubicación cada pocos segundos es más que suficiente para ver al
// conductor moverse. Se añade aquí un límite de envío (throttle) por conductor:
// - Si ha pasado suficiente tiempo desde el último envío real, se manda ya mismo.
// - Si no, se guarda la posición más reciente y se programa un envío al final de
//   la ventana, así nunca se pierde la posición más actual del conductor.
// El localStorage (para el mapa local) se sigue actualizando siempre, al instante.
const DRIVER_LOCATION_THROTTLE_MS = 8000; // 8 segundos entre envíos por conductor
const lastLocationSentAt = {};
const pendingLocationTimers = {};

export async function saveDriverLocation(furgoId, lat, lng) {
  try {
    const locations = JSON.parse(localStorage.getItem('delivery_driver_locations')) || {};
    locations[furgoId] = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('delivery_driver_locations', JSON.stringify(locations));

    const now = Date.now();
    const lastSent = lastLocationSentAt[furgoId] || 0;
    const elapsed = now - lastSent;

    if (elapsed >= DRIVER_LOCATION_THROTTLE_MS) {
      lastLocationSentAt[furgoId] = now;
      return await pushDriverLocationToSupabase(furgoId, lat, lng);
    }

    // Aún dentro de la ventana de espera: guarda la última posición y programa
    // un único envío diferido (si no hay ya uno pendiente para este conductor).
    if (!pendingLocationTimers[furgoId]) {
      const remaining = DRIVER_LOCATION_THROTTLE_MS - elapsed;
      pendingLocationTimers[furgoId] = setTimeout(() => {
        pendingLocationTimers[furgoId] = null;
        const latestLoc = JSON.parse(localStorage.getItem('delivery_driver_locations') || '{}')[furgoId];
        if (latestLoc) {
          lastLocationSentAt[furgoId] = Date.now();
          pushDriverLocationToSupabase(furgoId, latestLoc.lat, latestLoc.lng);
        }
      }, remaining);
    }
    return { success: true, throttled: true };
  } catch (e) {
    console.error("Error saving driver location:", e);
    return { success: false, error: e };
  }
}

async function pushDriverLocationToSupabase(furgoId, lat, lng) {
  try {
    if (supabase) {
      const { error } = await supabase.from('delivery_settings').upsert({
        key: `loc_${furgoId}`,
        value: JSON.stringify({ lat: parseFloat(lat), lng: parseFloat(lng), updatedAt: new Date().toISOString() })
      });
      if (error) {
        console.error("Error pushing driver location to Supabase:", error);
        return { success: false, error };
      }
    }
    return { success: true };
  } catch (e) {
    console.error("Error saving driver location:", e);
    return { success: false, error: e };
  }
}

// Obtener todas las ubicaciones actuales de repartidores
export function getDriverLocations() {
  try {
    return JSON.parse(localStorage.getItem('delivery_driver_locations')) || {};
  } catch (e) {
    console.error("Error reading driver locations:", e);
    return {};
  }
}

// Normalizar abreviaturas comunes en España y sus lenguas regionales
export function normalizeSpanishAddressQuery(queryText) {
  if (!queryText) return '';
  let q = queryText.trim();
  
  // Abreviaturas comunes en castellano, catalán y regional
  q = q.replace(/\bcl\b\.?\s*/gi, 'Calle '); // cl. -> Calle
  q = q.replace(/\bcl\/[o\s]?/gi, 'Calle '); // cl/ -> Calle
  q = q.replace(/\bc\/[o\s]?/gi, 'Calle '); // c/ -> Calle
  q = q.replace(/\bc\.\s+/gi, 'Calle ');  // c. -> Calle
  q = q.replace(/\bav\b\.?\s*/gi, 'Avenida '); // av. -> Avenida
  q = q.replace(/\bavda\b\.?\s*/gi, 'Avenida '); // avda. -> Avenida
  q = q.replace(/\bav\/[o\s]?/gi, 'Avenida '); // av/ -> Avenida
  q = q.replace(/\bplz\b\.?\s*/gi, 'Plaza '); // plz. -> Plaza
  q = q.replace(/\bpl\b\.?\s*/gi, 'Plaza ');   // pl. -> Plaza
  q = q.replace(/\bpº/gi, 'Paseo');       // pº -> Paseo
  q = q.replace(/\bp\.\º/gi, 'Paseo');    // p.º -> Paseo
  q = q.replace(/\bctra\b\.?\s*/gi, 'Carretera '); // ctra. -> Carretera
  q = q.replace(/\brbla\b\.?\s*/gi, 'Rambla ');   // rbla. -> Rambla
  q = q.replace(/\bptge\b\.?\s*/gi, 'Passatge '); // ptge. -> Passatge
  q = q.replace(/\bpol\b\.?\s*(ind\b\.?)?/gi, 'Polígono Industrial '); // pol. ind. -> Polígono Industrial
  
  // Limpiar espacios dobles
  q = q.replace(/\s+/g, ' ').trim();
  return q;
}

// Convertir texto de dirección a coordenadas mediante Google Maps, Mapbox o Nominatim (OSM)
export async function geocodeAddress(addressText) {
  if (!addressText || !addressText.trim()) return null;
  
  const googleKey = localStorage.getItem('delivery_google_maps_api_key') || '';
  const mapboxToken = localStorage.getItem('delivery_mapbox_access_token') || '';

  // 1. Google Maps Geocoding
  if (googleKey.trim()) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressText.trim())}&key=${googleKey.trim()}&language=es`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data && data.status === 'OK' && data.results && data.results.length > 0) {
          const result = data.results[0];
          const lat = result.geometry.location.lat;
          const lng = result.geometry.location.lng;
          const displayName = result.formatted_address;
          let postcode = '';
          const pcComponent = result.address_components.find(c => c.types.includes('postal_code'));
          if (pcComponent) postcode = pcComponent.long_name;
          return { lat, lng, displayName, postcode };
        }
      }
    } catch (e) {
      console.error("Google Maps Geocoding failed:", e);
    }
  }

  // 2. Mapbox Geocoding
  if (mapboxToken.trim()) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressText.trim())}.json?access_token=${mapboxToken.trim()}&country=es&language=es,ca,eu,gl&limit=1`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data && data.features && data.features.length > 0) {
          const feature = data.features[0];
          const lng = feature.geometry.coordinates[0];
          const lat = feature.geometry.coordinates[1];
          const displayName = feature.place_name;
          let postcode = '';
          if (feature.context) {
            const pc = feature.context.find(c => c.id.startsWith('postcode'));
            if (pc) postcode = pc.text;
          }
          return { lat, lng, displayName, postcode };
        }
      }
    } catch (e) {
      console.error("Mapbox Geocoding failed:", e);
    }
  }

  // 3. Fallback: Free Nominatim (OSM) / CartoCiudad (Spain)
  try {
    const countryCode = localStorage.getItem('search_country_code') || 'es';
    const cityBias = localStorage.getItem('search_city_bias') || 'Barcelona';
    const strictCity = localStorage.getItem('search_strict_city') === 'true';

    let searchQuery = normalizeSpanishAddressQuery(addressText);
    const hasComma = searchQuery.includes(',');
    const hasPostalCode = /\b\d{5}\b/.test(searchQuery);
    const commonCities = ['sabadell', 'terrassa', 'badalona', 'hospitalet', 'mataro', 'cornella', 'sant cugat', 'girona', 'tarragona', 'lleida', 'vic', 'manresa', 'sitges', 'castelldefels', 'viladecans', 'prat', 'rubi', 'granollers', 'mollet', 'figueres', 'reus', 'santiago', 'sevilla', 'bilbao', 'madrid', 'valencia', 'zaragoza', 'malaga', 'murcia', 'palma', 'las palmas', 'alicante', 'cordoba', 'valladolid', 'vigo', 'gijon'];
    const hasCommonCity = commonCities.some(city => searchQuery.toLowerCase().includes(city));

    const shouldAppendCity = strictCity && cityBias && !hasComma && !hasPostalCode && !hasCommonCity && !searchQuery.toLowerCase().includes(cityBias.toLowerCase());

    let searchQueryWithCity = searchQuery;
    if (shouldAppendCity) {
      searchQueryWithCity += `, ${cityBias}`;
    }

    // Try CartoCiudad first for Spain as it is extremely accurate and has portal-level data
    if (countryCode === 'es') {
      try {
        let cartoQuery = searchQuery;
        if (!hasComma && !hasPostalCode && cityBias && !searchQuery.toLowerCase().includes(cityBias.toLowerCase())) {
          cartoQuery += `, ${cityBias}`;
        }
        const cartoUrl = `https://www.cartociudad.es/geocoder/api/geocoder/candidates?q=${encodeURIComponent(cartoQuery)}&limit=1`;
        const cartoRes = await fetch(cartoUrl);
        if (cartoRes.ok) {
          const cartoData = await cartoRes.json();
          if (cartoData && cartoData.length > 0) {
            const first = cartoData[0];
            return {
              lat: first.lat,
              lng: first.lng,
              displayName: first.muni ? `${first.address}, ${first.muni}, ${first.province}, España` : `${first.address}, ${first.province}, España`,
              postcode: first.postalCode || ''
            };
          }
        }
      } catch (err) {
        console.error("CartoCiudad geocoding failed, falling back to Nominatim:", err);
      }
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=${countryCode}&q=${encodeURIComponent(searchQueryWithCity)}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'es,ca,eu,gl,en;q=0.9'
      }
    });
    if (!response.ok) return null;
    let data = await response.json();

    if (!data || data.length === 0) {
      const strippedQuery = searchQuery.replace(/^\s*(carrer\s+(de\s+|d')?|calle\s+(de\s+)?|avinguda\s+(de\s+|d')?|avenida\s+(de\s+)?|paseo\s+(de\s+)?|passeig\s+(de\s+|d')?|plaza\s+(de\s+)?|plaça\s+(de\s+|d')?|ronda\s+(de\s+)?|via\s+|vía\s+|camí\s+(de\s+|d')?|cami\s+(de\s+|d')?|carretera\s+(de\s+)?|ctra\s+|pasaje\s+(de\s+)?|passatge\s+(de\s+|d')?|ptge\s+)/i, '').trim();
      if (strippedQuery && strippedQuery !== searchQuery) {
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=${countryCode}&q=${encodeURIComponent(strippedQuery)}`;
        const fallbackRes = await fetch(fallbackUrl, { 
          headers: { 
            'Accept': 'application/json',
            'Accept-Language': 'es,ca,eu,gl,en;q=0.9'
          } 
        });
        if (fallbackRes.ok) {
          data = await fallbackRes.json();
        }
      }
    }

    if (data && data.length > 0) {
      let displayName = data[0].display_name || '';
      
      const rawAddr = data[0].address || {};
      let street = rawAddr.road || rawAddr.pedestrian || rawAddr.footway || rawAddr.path || rawAddr.cycleway || rawAddr.square || rawAddr.amenity || rawAddr.building || '';
      if (!street && displayName) {
        street = displayName.split(',')[0].trim();
      }

      let houseNumber = rawAddr.house_number || '';
      const numberMatch = addressText.match(/\b\d{1,4}[a-zA-Z]?\b/);
      if (!houseNumber && numberMatch) {
        const typedNumber = numberMatch[0];
        const isPostalCode = typedNumber.length === 5;
        if (!isPostalCode) {
          houseNumber = typedNumber;
        }
      }

      let city = rawAddr.city || rawAddr.town || rawAddr.village || rawAddr.municipality || rawAddr.hamlet || '';
      if (!city && displayName) {
        const parts = displayName.split(',').map(p => p.trim());
        if (parts.length > 2) {
          city = houseNumber ? (parts[2] || '') : (parts[1] || '');
        }
      }

      let shortParts = [];
      if (street) shortParts.push(street);
      if (houseNumber) {
        const cleanStreet = street.toLowerCase();
        if (!cleanStreet.includes(` ${houseNumber.toLowerCase()}`) && !cleanStreet.includes(`,${houseNumber.toLowerCase()}`)) {
          shortParts.push(houseNumber);
        }
      }
      if (city) shortParts.push(city);
      
      const shortDisplayName = shortParts.length > 0 ? shortParts.join(', ') : displayName;

      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        postcode: data[0].address && data[0].address.postcode ? data[0].address.postcode : '',
        displayName: shortDisplayName
      };
    }
  } catch (e) {
    console.error("Geocoding failed for address:", addressText, e);
  }
  return null;
}

// Alternar el permiso de búsqueda del buscador general para un usuario
// Fix: antes no se esperaba la confirmación real del guardado (saveUsers no se
// "awaiteaba") y siempre se devolvía {success:true} de inmediato — un admin
// podía ver el mensaje de éxito aunque el cambio nunca llegara al servidor.
export async function toggleUserSearchPermission(userId) {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) {
    return { success: false, error: 'Usuario no encontrado' };
  }
  user.canSearch = !user.canSearch;
  try {
    await saveUsers(users);
    return { success: true, user };
  } catch (error) {
    console.error("Error guardando el permiso de búsqueda:", error);
    return { success: false, error };
  }
}

// Obtener punto de inicio predeterminado
export function getRouteStartAddr(userId) {
  if (userId) {
    const custom = localStorage.getItem(`delivery_start_addr_${userId}`);
    if (custom) return custom;
  }
  return localStorage.getItem('delivery_default_start_addr') || 'Barcelona, España';
}

// Guardar punto de inicio predeterminado
export async function saveRouteStartAddr(addr, userId) {
  if (userId) {
    localStorage.setItem(`delivery_start_addr_${userId}`, addr.trim());
  }
  localStorage.setItem('delivery_default_start_addr', addr.trim());
  if (supabase) {
    const key = userId ? `default_start_addr_${userId}` : 'default_start_addr';
    const { error } = await supabase.from('delivery_settings').upsert({ key, value: addr.trim() });
    if (error) {
      console.error("Error saving start address setting to cloud:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

// Obtener punto de fin predeterminado
export function getRouteEndAddr(userId) {
  if (userId) {
    const custom = localStorage.getItem(`delivery_end_addr_${userId}`);
    if (custom) return custom;
  }
  return localStorage.getItem('delivery_default_end_addr') || 'Barcelona, España';
}

// Guardar punto de fin predeterminado
export async function saveRouteEndAddr(addr, userId) {
  if (userId) {
    localStorage.setItem(`delivery_end_addr_${userId}`, addr.trim());
  }
  localStorage.setItem('delivery_default_end_addr', addr.trim());
  if (supabase) {
    const key = userId ? `default_end_addr_${userId}` : 'default_end_addr';
    const { error } = await supabase.from('delivery_settings').upsert({ key, value: addr.trim() });
    if (error) {
      console.error("Error saving end address setting to cloud:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

// Obtener API Keys de mapas
export function getGoogleMapsKey() {
  return localStorage.getItem('delivery_google_maps_api_key') || '';
}
export async function saveGoogleMapsKey(key) {
  localStorage.setItem('delivery_google_maps_api_key', key.trim());
  if (supabase) {
    const { error } = await supabase.from('delivery_settings').upsert({ key: 'google_maps_api_key', value: key.trim() });
    if (error) {
      console.error("Error saving google maps key to cloud:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

export function getMapboxToken() {
  return localStorage.getItem('delivery_mapbox_access_token') || '';
}
export async function saveMapboxToken(token) {
  localStorage.setItem('delivery_mapbox_access_token', token.trim());
  if (supabase) {
    const { error } = await supabase.from('delivery_settings').upsert({ key: 'mapbox_access_token', value: token.trim() });
    if (error) {
      console.error("Error saving mapbox token to cloud:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

// Parsear información de franja horaria y duración codificada en las notas
export function parseTicketNotes(notesText) {
  let timeSlot = 'any';
  let estimatedDuration = 10; // 10 minutos por defecto
  let cleanNotes = notesText || '';
  let driverObservations = '';
  let failedChargeType = 'none';
  let originalRouteLabel = '';
  let completedAt = '';

  // 1. Extraer [Ruta Original: ...] si existe en cualquier parte del texto
  const routeMatch = cleanNotes.match(/\[Ruta Original:\s*([^\]]+)\]/);
  if (routeMatch) {
    originalRouteLabel = routeMatch[1].trim();
    cleanNotes = cleanNotes.replace(/\[Ruta Original:\s*[^\]]+\]\s*/g, '');
  }

  // 1.5. Detectar y extraer tags combinados de servicio y franja horaria
  if (cleanNotes.match(/\[CUELGUE_MA?Ñ?NANA\]/i) || cleanNotes.toLowerCase().includes('[cuelgue_mañana]') || cleanNotes.toLowerCase().includes('[cuelgue_manana]')) {
    timeSlot = 'morning';
    cleanNotes = cleanNotes.replace(/\[CUELGUE_MA?Ñ?NANA\]/gi, '').trim();
  } else if (cleanNotes.match(/\[CUELGUE_TARDE\]/i) || cleanNotes.toLowerCase().includes('[cuelgue_tarde]')) {
    timeSlot = 'afternoon';
    cleanNotes = cleanNotes.replace(/\[CUELGUE_TARDE\]/gi, '').trim();
  } else if (cleanNotes.match(/\[PUESTA_MARCHA_MA?Ñ?NANA\]/i) || cleanNotes.toLowerCase().includes('[puesta_marcha_mañana]') || cleanNotes.toLowerCase().includes('[puesta_marcha_manana]')) {
    timeSlot = 'morning';
    cleanNotes = cleanNotes.replace(/\[PUESTA_MARCHA_MA?Ñ?NANA\]/gi, '').trim();
  } else if (cleanNotes.match(/\[PUESTA_MARCHA_TARDE\]/i) || cleanNotes.toLowerCase().includes('[puesta_marcha_tarde]')) {
    timeSlot = 'afternoon';
    cleanNotes = cleanNotes.replace(/\[PUESTA_MARCHA_TARDE\]/gi, '').trim();
  }

  // 2. Extraer [Horario: ...]
  const slotMatch = cleanNotes.match(/\[Horario:\s*([^\]]+)\]/);
  if (slotMatch) {
    const rawSlot = slotMatch[1].trim().toLowerCase();
    timeSlot = rawSlot === 'mañana' ? 'morning' : rawSlot === 'tarde' ? 'afternoon' : 'any';
    cleanNotes = cleanNotes.replace(/\[Horario:\s*[^\]]+\]\s*/g, '');
  }

  // 3. Extraer [Duracion: ...]
  const durationMatch = cleanNotes.match(/\[Duracion:\s*(\d+)\s*min\]/);
  if (durationMatch) {
    estimatedDuration = parseInt(durationMatch[1], 10);
    cleanNotes = cleanNotes.replace(/\[Duracion:\s*\d+\s*min\]\s*/g, '');
  }

  // Parse driver observations: check if there's an [Observacion: ...] block
  const obsMatch = cleanNotes.match(/\[Observacion:\s*([^\]]+)\]/);
  if (obsMatch) {
    driverObservations = obsMatch[1].trim();
    cleanNotes = cleanNotes.replace(/\[Observacion:\s*[^\]]+\]\s*/g, '');
  }

  // Parse failed charge: check if there's a [CobroFallo: ...] block
  const chargeMatch = cleanNotes.match(/\[CobroFallo:\s*([^\]]+)\]/);
  if (chargeMatch) {
    failedChargeType = chargeMatch[1].trim();
    cleanNotes = cleanNotes.replace(/\[CobroFallo:\s*[^\]]+\]\s*/g, '');
  }

  // Parse completed at timestamp: check if there's a [CompletadoEn: ...] block
  const completedMatch = cleanNotes.match(/\[CompletadoEn:\s*([^\]]+)\]/);
  if (completedMatch) {
    completedAt = completedMatch[1].trim();
    cleanNotes = cleanNotes.replace(/\[CompletadoEn:\s*[^\]]+\]\s*/g, '');
  }

  return { 
    timeSlot, 
    estimatedDuration, 
    cleanNotes: cleanNotes.trim(), 
    driverObservations, 
    failedChargeType,
    originalRouteLabel,
    completedAt
  };
}

// Codificar franja horaria y duración como prefijo en las notas
export function encodeTicketNotes(timeSlot, estimatedDuration, cleanNotesText, driverObservations = '', failedChargeType = 'none', originalRouteLabel = '', completedAt = '') {
  const slotStr = timeSlot === 'morning' ? 'Mañana' : timeSlot === 'afternoon' ? 'Tarde' : 'Cualquiera';
  const prefix = `[Horario: ${slotStr}] [Duracion: ${estimatedDuration || 10} min] `;
  let finalNotes = (prefix + (cleanNotesText || '').trim()).trim();
  if (driverObservations && driverObservations.trim()) {
    finalNotes += ` [Observacion: ${driverObservations.trim()}]`;
  }
  if (failedChargeType && failedChargeType !== 'none') {
    finalNotes += ` [CobroFallo: ${failedChargeType}]`;
  }
  if (originalRouteLabel && originalRouteLabel.trim()) {
    finalNotes = `[Ruta Original: ${originalRouteLabel.trim()}] ${finalNotes}`;
  }
  if (completedAt && completedAt.trim()) {
    finalNotes += ` [CompletadoEn: ${completedAt.trim()}]`;
  }
  return finalNotes;
}

// Obtener hora de inicio de una ruta
export function getRouteStartTime(furgoId, date) {
  if (furgoId && date) {
    const key = `delivery_route_start_time_${furgoId}_${date}`;
    const time = localStorage.getItem(key);
    if (time) return time;
  }
  return '09:00';
}

// Guardar hora de inicio de una ruta
export async function saveRouteStartTime(furgoId, date, time) {
  if (furgoId && date) {
    const key = `delivery_route_start_time_${furgoId}_${date}`;
    localStorage.setItem(key, time);
    if (supabase) {
      const dbKey = `route_start_time_${furgoId}_${date}`;
      const { error } = await supabase.from('delivery_settings').upsert({ key: dbKey, value: time });
      if (error) {
        console.error("Error saving route start time to Supabase:", error);
        return { success: false, error };
      }
    }
  }
  return { success: true };
}

// Helper para obtener el ID del administrador activo en la sesión actual
export function getActiveAdminId() {
  try {
    const sessionStr = localStorage.getItem('delivery_session');
    if (sessionStr) {
      const user = JSON.parse(sessionStr);
      if (user) {
        if (user.role === 'admin' || user.role === 'superadmin') {
          return user.id;
        } else if (user.role === 'repartidor') {
          return user.createdBy || 'admin';
        }
      }
    }
  } catch (e) {}
  return 'admin';
}

// Obtener si los repartidores pueden hacer transferencias de apoyo
export function getAllowDriverSupportTransfer() {
  const adminId = getActiveAdminId();
  const val = localStorage.getItem(`delivery_allow_driver_support_transfer_${adminId}`);
  if (val !== null) return val === 'true';
  return localStorage.getItem('delivery_allow_driver_support_transfer') === 'true';
}

// Guardar si los repartidores pueden hacer transferencias de apoyo
export async function saveAllowDriverSupportTransfer(value) {
  const adminId = getActiveAdminId();
  const valStr = value ? 'true' : 'false';
  localStorage.setItem(`delivery_allow_driver_support_transfer_${adminId}`, valStr);
  localStorage.setItem('delivery_allow_driver_support_transfer', valStr);
  if (supabase) {
    const { error } = await supabase.from('delivery_settings').upsert({
      key: `allow_driver_support_transfer_${adminId}`,
      value: valStr
    });
    if (error) {
      console.error("Error saving allow_driver_support_transfer to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

// Guardar estado manual de la ruta
export async function saveRouteManualStatus(furgoId, date, isManual) {
  if (furgoId && date) {
    const key = `manual_route_${furgoId}_${date}`;
    const value = isManual ? 'true' : 'false';
    localStorage.setItem(`delivery_${key}`, value);
    if (supabase) {
      const { error } = await supabase.from('delivery_settings').upsert({ key: key, value: value });
      if (error) {
        console.error("Error saving manual route status to Supabase:", error);
        return { success: false, error };
      }
    }
  }
  return { success: true };
}

// Obtener si la ruta está configurada en modo manual
export function getRouteManualStatus(furgoId, date) {
  if (!furgoId || !date) return false;
  const key = `delivery_manual_route_${furgoId}_${date}`;
  return localStorage.getItem(key) === 'true';
}

// Cambiar la fecha completa de una ruta (tickets y turnos)
export async function moveRouteDate(furgoId, oldDate, newDate) {
  const tickets = getTickets();
  const shifts = getShifts();

  // Fix: antes, ni los tickets ni el turno se marcaban con _syncStatus:'pending'.
  // syncFromCloud() protege de sobrescrituras precisamente a los registros marcados
  // como 'pending' (ver el filtro pendingLocal más arriba en este archivo). Sin esa
  // marca, si un sync desde la nube llegaba mientras esta subida todavía estaba en
  // curso (o fallaba), el cambio de fecha se revertía en silencio a la fecha vieja,
  // sin ningún aviso ni error visible.

  // 1. Filtrar e ir cambiando la fecha de los tickets
  const ticketsToUpdate = tickets.filter(t => t.furgoId === furgoId && t.date === oldDate);
  ticketsToUpdate.forEach(t => {
    t.date = newDate;
    t._syncStatus = 'pending';
  });
  await saveTickets(tickets);

  // 2. Filtrar e ir cambiando la fecha del turno (shift)
  const shiftIndex = shifts.findIndex(s => s.furgoId === furgoId && s.date === oldDate);
  let shiftToUpsert = null;
  if (shiftIndex !== -1) {
    shifts[shiftIndex].date = newDate;
    shifts[shiftIndex]._syncStatus = 'pending';
    shiftToUpsert = shifts[shiftIndex];
    await saveShifts(shifts);
  }

  // 3. Sincronizar remotamente si Supabase está activo
  let remoteSyncError = null;
  if (supabase) {
    try {
      // Upsert tickets
      if (ticketsToUpdate.length > 0) {
        const ticketsFormatted = ticketsToUpdate.map(t => ({
          id: t.id,
          date: t.date,
          furgo_id: t.furgoId,
          furgo_label: t.furgoLabel,
          route_name: t.routeName,
          customer_name: t.customerName,
          phone: t.phone,
          address: t.address,
          postcode: t.postcode,
          notes: t.notes,
          cod_amount: t.codAmount,
          tasks: t.tasks,
          total_price: t.totalPrice,
          status: t.status,
          failure_reason: t.failureReason || '',
          lat: t.lat,
          lng: t.lng,
          completed_lat: t.completedLat,
          completed_lng: t.completedLng,
          route_order: t.routeOrder,
          created_at: t.createdAt,
          created_by: t.createdBy || 'admin'
        }));
        const { error: ticketsErr } = await supabase.from('delivery_tickets').upsert(ticketsFormatted);
        if (ticketsErr) {
          console.error("Error al subir el cambio de fecha de tickets a Supabase:", ticketsErr);
          remoteSyncError = ticketsErr;
        }
      }

      // Upsert shift
      if (shiftToUpsert) {
        const { error: shiftErr } = await supabase.from('delivery_shifts').upsert({
          id: shiftToUpsert.id,
          date: shiftToUpsert.date,
          furgo_id: shiftToUpsert.furgoId,
          status: shiftToUpsert.status,
          created_by: shiftToUpsert.createdBy || 'admin'
        });
        if (shiftErr) {
          console.error("Error al subir el cambio de fecha del turno a Supabase:", shiftErr);
          remoteSyncError = remoteSyncError || shiftErr;
        }
        const meta = {
          helper: shiftToUpsert.helper || '',
          helper2: shiftToUpsert.helper2 || '',
          matricula: shiftToUpsert.matricula || '',
          customDriver: shiftToUpsert.customDriver || '',
          observations: shiftToUpsert.observations || '',
          routeName: shiftToUpsert.routeName || '',
          kms: shiftToUpsert.kms || null,
          startKms: shiftToUpsert.startKms || null,
          endKms: shiftToUpsert.endKms || null,
          summary: shiftToUpsert.summary || null
        };
        const { error: metaErr } = await supabase.from('delivery_settings').upsert({
          key: `shift_meta_${shiftToUpsert.id}`,
          value: JSON.stringify(meta)
        });
        if (metaErr) {
          console.error("Error al subir metadatos del turno a Supabase:", metaErr);
          remoteSyncError = remoteSyncError || metaErr;
        }
      }

      // Si todo se subió bien, quitar la marca 'pending' de los registros afectados
      if (!remoteSyncError) {
        try {
          const currentTickets = JSON.parse(localStorage.getItem('delivery_tickets')) || [];
          const movedIds = new Set(ticketsToUpdate.map(t => t.id));
          const clearedTickets = currentTickets.map(t => {
            if (t && movedIds.has(t.id) && t._syncStatus === 'pending') {
              const { _syncStatus, ...rest } = t;
              return rest;
            }
            return t;
          });
          localStorage.setItem('delivery_tickets', JSON.stringify(clearedTickets));

          if (shiftToUpsert) {
            const currentShifts = JSON.parse(localStorage.getItem('delivery_shifts')) || [];
            const clearedShifts = currentShifts.map(s => {
              if (s && s.id === shiftToUpsert.id && s._syncStatus === 'pending') {
                const { _syncStatus, ...rest } = s;
                return rest;
              }
              return s;
            });
            localStorage.setItem('delivery_shifts', JSON.stringify(clearedShifts));
          }
        } catch (e) {
          console.error("Error limpiando _syncStatus tras mover fecha de ruta:", e);
        }
      }
    } catch (e) {
      console.error("Error inesperado sincronizando el cambio de fecha de ruta con Supabase:", e);
      remoteSyncError = e;
    }
  }

  return { ticketsCount: ticketsToUpdate.length, hasShift: !!shiftToUpsert, remoteSyncError };
}

// Obtener la lista de ayudantes configurados
export function getHelpersList() {
  const adminId = getActiveAdminId();
  let helpersStr = localStorage.getItem(`delivery_helpers_list_${adminId}`);
  if (!helpersStr) {
    helpersStr = localStorage.getItem('delivery_helpers_list');
  }
  try {
    const list = helpersStr ? JSON.parse(helpersStr) : [];
    return list.map(item => {
      if (typeof item === 'string') {
        return { name: item, dailyRate: 0 };
      }
      return { name: item.name || '', dailyRate: parseFloat(item.dailyRate) || 0 };
    });
  } catch (e) {
    return [];
  }
}

// Guardar la lista de ayudantes configurados
export async function saveHelpersList(helpers) {
  const adminId = getActiveAdminId();
  const formatted = helpers.map(item => ({
    name: item.name.trim(),
    dailyRate: parseFloat(item.dailyRate) || 0
  }));
  const helpersStr = JSON.stringify(formatted);
  localStorage.setItem(`delivery_helpers_list_${adminId}`, helpersStr);
  localStorage.setItem('delivery_helpers_list', helpersStr);
  if (supabase) {
    const { error } = await supabase.from('delivery_settings').upsert({
      key: `delivery_helpers_list_${adminId}`,
      value: helpersStr
    });
    if (error) {
      console.error("Error saving helpers list to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

// Obtener la lista de matriculas configuradas
export function getPlatesList() {
  const adminId = getActiveAdminId();
  let platesStr = localStorage.getItem(`delivery_plates_list_${adminId}`);
  if (!platesStr) {
    platesStr = localStorage.getItem('delivery_plates_list');
  }
  try {
    return platesStr ? JSON.parse(platesStr) : [];
  } catch (e) {
    return [];
  }
}

// Guardar la lista de matriculas configuradas
export async function savePlatesList(plates) {
  const adminId = getActiveAdminId();
  const platesStr = JSON.stringify(plates);
  localStorage.setItem(`delivery_plates_list_${adminId}`, platesStr);
  localStorage.setItem('delivery_plates_list', platesStr);
  if (supabase) {
    const { error } = await supabase.from('delivery_settings').upsert({
      key: `delivery_plates_list_${adminId}`,
      value: platesStr
    });
    if (error) {
      console.error("Error saving plates list to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

// Obtener la tarifa diaria de un chofer
export function getDriverDailyRate(driverId) {
  const val = localStorage.getItem(`delivery_driver_daily_rate_${driverId}`);
  return val ? parseFloat(val) : 0;
}

// Guardar la tarifa diaria de un chofer
export async function saveDriverDailyRate(driverId, rate) {
  localStorage.setItem(`delivery_driver_daily_rate_${driverId}`, rate.toString());
  if (supabase) {
    const { error } = await supabase.from('delivery_settings').upsert({
      key: `driver_daily_rate_${driverId}`,
      value: rate.toString()
    });
    if (error) {
      console.error(`Error saving driver rate ${driverId} to Supabase:`, error);
      return { success: false, error };
    }
  }
  return { success: true };
}

// Obtener la lista de empleados configurados
export function getEmployeesList() {
  const adminId = getActiveAdminId();
  let empStr = localStorage.getItem(`delivery_employees_list_${adminId}`);
  if (!empStr) {
    empStr = localStorage.getItem('delivery_employees_list');
  }
  try {
    if (empStr) {
      return JSON.parse(empStr);
    }
    // Si no existe, migrar del antiguo helpersList
    const helpers = getHelpersList();
    const migrated = helpers.map((h, index) => ({
      id: `emp_${Date.now()}_${index}`,
      name: h.name,
      role: 'ayudante',
      dailyRate: h.dailyRate
    }));
    if (migrated.length > 0) {
      localStorage.setItem(`delivery_employees_list_${adminId}`, JSON.stringify(migrated));
    }
    return migrated;
  } catch (e) {
    return [];
  }
}

// Guardar la lista de empleados configurados
export async function saveEmployeesList(employees) {
  const adminId = getActiveAdminId();
  const formatted = employees.map(item => ({
    id: item.id || `emp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    name: item.name.trim(),
    role: item.role || 'chofer',
    dailyRate: parseFloat(item.dailyRate) || 0,
    active: item.active === false ? false : true
  }));
  const empStr = JSON.stringify(formatted);
  localStorage.setItem(`delivery_employees_list_${adminId}`, empStr);
  localStorage.setItem('delivery_employees_list', empStr);
  if (supabase) {
    const { error } = await supabase.from('delivery_settings').upsert({
      key: `delivery_employees_list_${adminId}`,
      value: empStr
    });
    if (error) {
      console.error("Error saving employees list to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

// Función auxiliar para verificar si un usuario tiene permiso para acceder a un módulo específico
export function hasPermission(user, moduleId) {
  if (!user) return false;
  if (user.role === 'superadmin') return true; // El Super Administrador siempre tiene acceso completo
  
  let pObj = user.permissions;
  if (pObj) {
    if (typeof pObj === 'string') {
      try {
        pObj = JSON.parse(pObj);
      } catch (e) {
        pObj = {};
      }
    }
    // Si el permiso está explícitamente configurado como false, se deniega.
    // Si no está (undefined) o es true, se permite (compatibilidad por defecto).
    return pObj[moduleId] !== false;
  }
  
  return true; // Acceso por defecto para usuarios antiguos sin permisos configurados
}

/**
 * Saves only the driver/helper/plate metadata for a single shift directly to localStorage
 * AND Supabase, bypassing the full shifts array save. This prevents any race condition
 * with the periodic sync cycle overwriting data.
 */
export async function saveDriverShiftMeta(shiftId, furgoId, date, customDriver, matricula, helper, helper2) {
  // 1. Update the specific shift in localStorage directly
  let localShifts = [];
  try {
    localShifts = JSON.parse(localStorage.getItem('delivery_shifts')) || [];
  } catch (e) {}

  const idx = localShifts.findIndex(s => s.id === shiftId);
  if (idx !== -1) {
    localShifts[idx] = {
      ...localShifts[idx],
      customDriver,
      matricula,
      helper,
      helper2
    };
  } else {
    // Create new shift entry if doesn't exist
    localShifts.push({
      id: shiftId,
      furgoId,
      date,
      status: 'open',
      openedAt: new Date().toISOString(),
      closedAt: null,
      customDriver,
      matricula,
      helper,
      helper2,
      observations: '',
      routeName: '',
      createdBy: 'driver'
    });
  }
  localStorage.setItem('delivery_shifts', JSON.stringify(localShifts));

  // 2. Save to Supabase directly (both the shift row and its metadata setting)
  if (supabase) {
    try {
      // Upsert the basic shift row
      const { error: shiftErr } = await supabase.from('delivery_shifts').upsert([{
        id: shiftId,
        furgo_id: furgoId,
        date,
        status: localShifts.find(s => s.id === shiftId)?.status || 'open',
        opened_at: localShifts.find(s => s.id === shiftId)?.openedAt || new Date().toISOString(),
        closed_at: localShifts.find(s => s.id === shiftId)?.closedAt || null,
        created_by: 'driver'
      }]);
      if (shiftErr) console.error('saveDriverShiftMeta: error upserting shift row:', shiftErr);

      // Get existing meta to preserve other fields (kms, summary, observations, etc.)
      const { data: existingMeta } = await supabase
        .from('delivery_settings')
        .select('value')
        .eq('key', `shift_meta_${shiftId}`)
        .single();

      let currentMeta = {};
      if (existingMeta?.value) {
        try { currentMeta = JSON.parse(existingMeta.value); } catch (e) {}
      }

      // Merge: keep existing fields, override only driver/plate/helper fields
      const newMeta = {
        ...currentMeta,
        customDriver,
        matricula,
        helper,
        helper2
      };

      const { error: metaErr } = await supabase.from('delivery_settings').upsert([{
        key: `shift_meta_${shiftId}`,
        value: JSON.stringify(newMeta)
      }]);
      if (metaErr) console.error('saveDriverShiftMeta: error upserting shift meta:', metaErr);

    } catch (e) {
      console.error('saveDriverShiftMeta: unexpected error:', e);
    }
  }

  return localShifts;
}

// ==========================================
// MÓDULO DE CONTROL DE FLOTA (NATIVO & AISLADO)
// ==========================================

export function getFleetVehicles() {
  const adminId = getActiveAdminId();
  const data = localStorage.getItem(`delivery_fleet_vehicles_${adminId}`);
  try {
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export async function saveFleetVehicles(vehicles) {
  const adminId = getActiveAdminId();
  const valStr = JSON.stringify(vehicles);
  localStorage.setItem(`delivery_fleet_vehicles_${adminId}`, valStr);
  localStorage.setItem('delivery_fleet_vehicles', valStr); // fallback local
  if (supabase) {
    const { error } = await supabase.from('delivery_settings').upsert({
      key: `fleet_vehicles_${adminId}`,
      value: valStr
    });
    if (error) {
      console.error("Error saving fleet vehicles to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

export function getFleetFuelLogs() {
  const adminId = getActiveAdminId();
  const data = localStorage.getItem(`delivery_fleet_fuel_logs_${adminId}`);
  try {
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export async function saveFleetFuelLogs(logs) {
  const adminId = getActiveAdminId();
  const valStr = JSON.stringify(logs);
  localStorage.setItem(`delivery_fleet_fuel_logs_${adminId}`, valStr);
  localStorage.setItem('delivery_fleet_fuel_logs', valStr); // fallback local
  if (supabase) {
    const { error } = await supabase.from('delivery_settings').upsert({
      key: `fleet_fuel_logs_${adminId}`,
      value: valStr
    });
    if (error) {
      console.error("Error saving fleet fuel logs to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

export function getFleetMaintenanceLogs() {
  const adminId = getActiveAdminId();
  const data = localStorage.getItem(`delivery_fleet_maintenance_logs_${adminId}`);
  try {
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export async function saveFleetMaintenanceLogs(logs) {
  const adminId = getActiveAdminId();
  const valStr = JSON.stringify(logs);
  localStorage.setItem(`delivery_fleet_maintenance_logs_${adminId}`, valStr);
  localStorage.setItem('delivery_fleet_maintenance_logs', valStr); // fallback local
  if (supabase) {
    const { error } = await supabase.from('delivery_settings').upsert({
      key: `fleet_maintenance_logs_${adminId}`,
      value: valStr
    });
    if (error) {
      console.error("Error saving fleet maintenance logs to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}

export function getFleetDailyLogs() {
  const adminId = getActiveAdminId();
  const data = localStorage.getItem(`delivery_fleet_daily_logs_${adminId}`);
  try {
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export async function saveFleetDailyLogs(logs) {
  const adminId = getActiveAdminId();
  const valStr = JSON.stringify(logs);
  localStorage.setItem(`delivery_fleet_daily_logs_${adminId}`, valStr);
  localStorage.setItem('delivery_fleet_daily_logs', valStr); // fallback local
  if (supabase) {
    const { error } = await supabase.from('delivery_settings').upsert({
      key: `fleet_daily_logs_${adminId}`,
      value: valStr
    });
    if (error) {
      console.error("Error saving fleet daily logs to Supabase:", error);
      return { success: false, error };
    }
  }
  return { success: true };
}


