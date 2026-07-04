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

export async function reinitSupabase() {
  if (isSyncing) return;
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
            .on('postgres_changes', { event: '*', schema: 'public' }, () => {
              syncFromCloud();
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
        await supabase.from('delivery_users').insert(localUsers.map(u => ({
          id: u.id,
          username: u.username,
          password: u.password,
          label: u.label,
          role: u.role,
          can_search: u.canSearch || false
        })));
      }
    }

    // 2. Check if tariffs are empty, seed from local
    const { data: cloudTariffs } = await supabase.from('delivery_tariffs').select('id');
    if (!cloudTariffs || cloudTariffs.length === 0) {
      const localTariffs = JSON.parse(localStorage.getItem('delivery_tariffs')) || [];
      if (localTariffs.length > 0) {
        await supabase.from('delivery_tariffs').insert(localTariffs);
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
          created_at: t.createdAt
        }));
        await supabase.from('delivery_tickets').insert(formatted);
      }
    }

    // 4. Check if shifts are empty, seed from local
    const { data: cloudShifts } = await supabase.from('delivery_shifts').select('id');
    if (!cloudShifts || cloudShifts.length === 0) {
      const localShifts = JSON.parse(localStorage.getItem('delivery_shifts')) || [];
      if (localShifts.length > 0) {
        await supabase.from('delivery_shifts').insert(localShifts);
      }
    }

    // 5. Seed settings
    const { data: cloudSettings } = await supabase.from('delivery_settings').select('key');
    if (!cloudSettings || cloudSettings.length === 0) {
      const mPrice = parseFloat(localStorage.getItem('delivery_module_price')) || 3.81;
      const appName = localStorage.getItem('delivery_app_name') || 'My Delivery Team';
      const startAddr = localStorage.getItem('delivery_default_start_addr') || 'Barcelona, España';
      const endAddr = localStorage.getItem('delivery_default_end_addr') || 'Barcelona, España';
      await supabase.from('delivery_settings').insert([
        { key: 'module_price', value: mPrice.toString() },
        { key: 'app_name', value: appName },
        { key: 'default_start_addr', value: startAddr },
        { key: 'default_end_addr', value: endAddr }
      ]);
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
        await supabase.from('delivery_settings').insert(toInsert);
      }
    }
  } catch (e) {
    console.error("Error seeding Supabase tables:", e);
  }
}

export async function syncFromCloud() {
  if (!supabase) return;
  try {
    // Pull Users
    const { data: users, error: errUsers } = await supabase.from('delivery_users').select('*');
    if (users && !errUsers) {
      const localUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        password: u.password,
        label: u.label,
        role: u.role,
        canSearch: u.can_search || false,
        createdBy: u.created_by || 'admin'
      }));
      localStorage.setItem('delivery_users', JSON.stringify(localUsers));
    }

    // Pull Tariffs
    const { data: tariffs, error: errTariffs } = await supabase.from('delivery_tariffs').select('*');
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

    // Pull Tickets
    const { data: tickets, error: errTickets } = await supabase.from('delivery_tickets').select('*');
    if (tickets && !errTickets) {
      const localTickets = tickets.map(t => ({
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
      localStorage.setItem('delivery_tickets', JSON.stringify(localTickets));
    }

    // Pull Shifts
    const { data: shifts, error: errShifts } = await supabase.from('delivery_shifts').select('*');
    if (shifts && !errShifts) {
      const localShifts = shifts.map(s => ({
        id: s.id,
        furgoId: s.furgo_id,
        date: s.date,
        status: s.status,
        openedAt: s.opened_at,
        closedAt: s.closed_at,
        createdBy: s.created_by || 'admin'
      }));
      localStorage.setItem('delivery_shifts', JSON.stringify(localShifts));
    }

    // Pull Settings
    const { data: settings, error: errSettings } = await supabase.from('delivery_settings').select('*');
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

      // Route Kilometers
      settings.forEach(s => {
        if (s.key && s.key.startsWith('route_kms_')) {
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
  { id: 'admin', username: 'admin', label: 'Super Administrador', role: 'superadmin', password: 'admin' }
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
  { id: 'BSND', name: 'Barra de Sonido', block: 'Otros', type: 'fixed', value: 5.23 },
  { id: 'PM_BSND', name: 'Puesta en Marcha Barra de Sonido', block: 'Otros', type: 'modules', value: 3 },
  { id: 'CUELGUE_BSND', name: 'Cuelgue Barra de Sonido', block: 'Otros', type: 'modules', value: 8 },
  { id: 'MFRA', name: 'Marco Frame', block: 'Otros', type: 'modules', value: 3 },
  { id: 'SPAR', name: 'Soporte de Pared', block: 'Otros', type: 'fixed', value: 5.23 },
  { id: 'SSUE', name: 'Soporte de Suelo', block: 'Otros', type: 'fixed', value: 5.23 },
  { id: 'ALTA', name: 'Altavoces', block: 'Otros', type: 'modules', value: 3 },
  { id: 'TDIC', name: 'Toca discos', block: 'Otros', type: 'modules', value: 3 },
  { id: 'PROY', name: 'Proyector', block: 'Otros', type: 'fixed', value: 5.23 },
  { id: 'VTEC', name: 'Visita Técnica', block: 'Otros', type: 'modules', value: 5 },
  { id: 'URGENTE_100', name: 'Servicio Urgente 100€', block: 'Otros', type: 'fixed', value: 100 },
  { id: 'URGENTE_120', name: 'Servicio Urgente 120€', block: 'Otros', type: 'fixed', value: 120 },
  // Nuevos artículos
  { id: 'ORDE', name: 'Ordenador', block: 'Otros', type: 'fixed', value: 5.23 },
  { id: 'PANT', name: 'Pantalla', block: 'Otros', type: 'fixed', value: 5.23 },
  { id: 'MCAD', name: 'Micro Cadena', block: 'Otros', type: 'fixed', value: 5.23 }
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
  } else {
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
          { id: 'PM_BSND', name: 'Puesta en Marcha Barra de Sonido', block: 'Otros', type: 'modules', value: 3 },
          { id: 'CUELGUE_BSND', name: 'Cuelgue Barra de Sonido', block: 'Otros', type: 'modules', value: 8 }
        );
      }

      const hasUrgente = current.some(t => t.id === 'URGENTE_100');
      if (!hasUrgente) {
        current.push(
          { id: 'URGENTE_100', name: 'Servicio Urgente 100€', block: 'Otros', type: 'fixed', value: 100 },
          { id: 'URGENTE_120', name: 'Servicio Urgente 120€', block: 'Otros', type: 'fixed', value: 120 }
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
          block: 'Otros',
          type: 'modules',
          value: 5
        });
      }

      // Migrate: add Ordenador, Pantalla and Micro Cadena if missing
      const hasOrde = current.some(t => t.id === 'ORDE');
      if (!hasOrde) {
        current.push(
          { id: 'ORDE', name: 'Ordenador', block: 'Otros', type: 'fixed', value: 5.23 },
          { id: 'PANT', name: 'Pantalla', block: 'Otros', type: 'fixed', value: 5.23 },
          { id: 'MCAD', name: 'Micro Cadena', block: 'Otros', type: 'fixed', value: 5.23 }
        );
      }
      
      localStorage.setItem('delivery_tariffs', JSON.stringify(current));
    } catch (e) {
      console.error("Error migrating tariffs:", e);
    }
  }
  if (!localStorage.getItem('delivery_tickets') || !localStorage.getItem('delivery_db_cleared_once')) {
    localStorage.setItem('delivery_tickets', JSON.stringify([]));
  }
  if (!localStorage.getItem('delivery_shifts') || !localStorage.getItem('delivery_db_cleared_once')) {
    localStorage.setItem('delivery_shifts', JSON.stringify([]));
  }
  localStorage.setItem('delivery_db_cleared_once', 'true');
}

// Obtener datos
export function getUsers() {
  initDB();
  return JSON.parse(localStorage.getItem('delivery_users'));
}

export function saveUsers(users) {
  localStorage.setItem('delivery_users', JSON.stringify(users));
  if (supabase) {
    (async () => {
      try {
        const formatted = users.map(u => ({
          id: u.id,
          username: u.username,
          password: u.password,
          label: u.label,
          role: u.role,
          can_search: u.canSearch || false,
          created_by: u.createdBy || 'admin'
        }));
        await supabase.from('delivery_users').upsert(formatted);
      } catch (e) {
        console.error("Error saving users to Supabase:", e);
      }
    })();
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

export function saveModulePrice(price, userId) {
  if (userId) {
    localStorage.setItem(`delivery_module_price_${userId}`, JSON.stringify(price));
  }
  localStorage.setItem('delivery_module_price', JSON.stringify(price));
  if (supabase) {
    const key = userId ? `module_price_${userId}` : 'module_price';
    supabase.from('delivery_settings').upsert({ key, value: price.toString() }).then(({ error }) => {
      if (error) console.error("Error saving module price to Supabase:", error);
    });
  }
}

export function getTariffs() {
  initDB();
  return JSON.parse(localStorage.getItem('delivery_tariffs'));
}

export function saveTariffs(tariffs) {
  localStorage.setItem('delivery_tariffs', JSON.stringify(tariffs));
  if (supabase) {
    (async () => {
      try {
        const formatted = tariffs.map(t => ({
          id: t.id,
          name: t.name,
          block: t.block,
          type: t.type,
          value: t.value,
          created_by: t.createdBy || null
        }));
        await supabase.from('delivery_tariffs').upsert(formatted);
      } catch (e) {
        console.error("Error saving tariffs to Supabase:", e);
      }
    })();
  }
}

export function getTickets() {
  initDB();
  return JSON.parse(localStorage.getItem('delivery_tickets'));
}

export function saveTickets(tickets) {
  localStorage.setItem('delivery_tickets', JSON.stringify(tickets));
  if (supabase) {
    (async () => {
      try {
        const formatted = tickets.map(t => ({
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
        await supabase.from('delivery_tickets').upsert(formatted);
      } catch (e) {
        console.error("Error saving tickets to Supabase:", e);
      }
    })();
  }
}

// Calcular precio de una tarifa individual
export function calculateTaskPrice(tariffId, tariffs = null, modulePrice = null) {
  const activeTariffs = tariffs || getTariffs();
  const activeModulePrice = modulePrice !== null ? modulePrice : getModulePrice();
  
  const tariff = activeTariffs.find(t => t.id === tariffId);
  if (!tariff) return 0;

  // PM de barra de sonido: Entrega TV pequeña (TV_ENT_49) + 3 módulos
  if (tariffId === 'PM_BSND') {
    const tvSmall = activeTariffs.find(t => t.id === 'TV_ENT_49');
    const tvSmallPrice = tvSmall ? tvSmall.value : 5.23;
    return tvSmallPrice + (3 * activeModulePrice);
  }

  // Cuelgue de barra de sonido: Entrega TV pequeña (TV_ENT_49) + 8 módulos
  if (tariffId === 'CUELGUE_BSND') {
    const tvSmall = activeTariffs.find(t => t.id === 'TV_ENT_49');
    const tvSmallPrice = tvSmall ? tvSmall.value : 5.23;
    return tvSmallPrice + (8 * activeModulePrice);
  }

  if (tariff.type === 'fixed') {
    return tariff.value;
  } else if (tariff.type === 'modules') {
    return tariff.value * activeModulePrice;
  }
  return 0;
}

// Agregar un nuevo ticket (con lista flexible de tareas y cantidades)
export function addTicket(ticketData) {
  const tickets = getTickets();
  const tariffs = getTariffs();
  const modulePrice = getModulePrice();

  let totalCalculado = 0;
  const detailedTasks = ticketData.tasks.map(task => {
    const isCustom = task.tariffId && task.tariffId.startsWith('CUSTOM_');
    const basePrice = isCustom 
      ? (task.price || task.unitPrice || 0) 
      : calculateTaskPrice(task.tariffId, tariffs, modulePrice);
    const price = task.noCharge ? 0 : basePrice;
    const subtotal = price * task.quantity;
    totalCalculado += subtotal;
    const tariff = tariffs.find(t => t.id === task.tariffId);

    let name = tariff ? tariff.name : (task.name || 'Servicio Adicional');
    if (task.brand && task.inches) {
      const isComb = task.tariffId.includes('COMB');
      const typeStr = isComb ? 'Ent+Rec' : (task.tariffId.includes('ENT') ? 'Entrega' : '');
      name = `${task.brand} ${task.inches}" (${typeStr || name})`;
    }

    return {
      tariffId: task.tariffId,
      name: name,
      quantity: task.quantity,
      unitPrice: price,
      subtotal: subtotal,
      brand: task.brand || null,
      inches: task.inches || null,
      noCharge: !!task.noCharge
    };
  });

  const users = getUsers();
  const activeShift = (JSON.parse(localStorage.getItem('delivery_shifts')) || [])
    .find(s => s.furgoId === ticketData.furgoId && s.date === (ticketData.date || new Date().toISOString().split('T')[0]));

  const newTicket = {
    id: Date.now().toString(),
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
    tasks: detailedTasks,
    totalPrice: totalCalculado,
    status: ticketData.status || 'pending',
    createdAt: new Date().toISOString(),
    lat: ticketData.lat || null,
    lng: ticketData.lng || null,
    routeOrder: ticketData.routeOrder || null,
    createdBy: ticketData.createdBy || 'admin'
  };

  tickets.push(newTicket);
  saveTickets(tickets);
  if (supabase) {
    (async () => {
      try {
        await supabase.from('delivery_tickets').insert({
          id: newTicket.id,
          date: newTicket.date,
          furgo_id: newTicket.furgoId,
          furgo_label: newTicket.furgoLabel,
          route_name: newTicket.routeName,
          customer_name: newTicket.customerName,
          phone: newTicket.phone,
          address: newTicket.address,
          postcode: newTicket.postcode,
          notes: newTicket.notes,
          cod_amount: newTicket.codAmount,
          tasks: newTicket.tasks,
          total_price: newTicket.totalPrice,
          status: newTicket.status,
          failure_reason: newTicket.failureReason || '',
          lat: newTicket.lat,
          lng: newTicket.lng,
          completed_lat: newTicket.completedLat,
          completed_lng: newTicket.completedLng,
          route_order: newTicket.routeOrder,
          created_at: newTicket.createdAt,
          created_by: newTicket.createdBy || 'admin'
        });
      } catch (e) {
        console.error("Error pushing ticket to Supabase:", e);
      }
    })();
  }
  return newTicket;
}

// Actualizar un ticket existente
export function updateTicket(updatedTicket) {
  const tickets = getTickets();
  const tariffs = getTariffs();
  const modulePrice = getModulePrice();

  let totalCalculado = 0;
  const detailedTasks = updatedTicket.tasks.map(task => {
    const isCustom = task.tariffId && task.tariffId.startsWith('CUSTOM_');
    const basePrice = isCustom 
      ? (task.price || task.unitPrice || 0) 
      : calculateTaskPrice(task.tariffId, tariffs, modulePrice);
    const price = task.noCharge ? 0 : basePrice;
    const subtotal = price * task.quantity;
    totalCalculado += subtotal;
    const tariff = tariffs.find(t => t.id === task.tariffId);

    let name = tariff ? tariff.name : (task.name || 'Servicio Adicional');
    if (task.brand && task.inches) {
      const isComb = task.tariffId.includes('COMB');
      const typeStr = isComb ? 'Ent+Rec' : (task.tariffId.includes('ENT') ? 'Entrega' : '');
      name = `${task.brand} ${task.inches}" (${typeStr || name})`;
    }

    return {
      tariffId: task.tariffId,
      name: name,
      quantity: task.quantity,
      unitPrice: price,
      subtotal: subtotal,
      brand: task.brand || null,
      inches: task.inches || null,
      noCharge: !!task.noCharge
    };
  });

  const index = tickets.findIndex(t => t.id === updatedTicket.id);
  if (index !== -1) {
    const users = getUsers();
    const activeShift = (JSON.parse(localStorage.getItem('delivery_shifts')) || [])
      .find(s => s.furgoId === updatedTicket.furgoId && s.date === updatedTicket.date);

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
      tasks: detailedTasks,
      totalPrice: totalCalculado,
      status: updatedTicket.status || tickets[index].status || 'pending',
      lat: updatedTicket.lat !== undefined ? updatedTicket.lat : tickets[index].lat,
      lng: updatedTicket.lng !== undefined ? updatedTicket.lng : tickets[index].lng,
      completedLat: updatedTicket.completedLat !== undefined ? updatedTicket.completedLat : tickets[index].completedLat,
      completedLng: updatedTicket.completedLng !== undefined ? updatedTicket.completedLng : tickets[index].completedLng,
      routeOrder: updatedTicket.routeOrder !== undefined ? updatedTicket.routeOrder : tickets[index].routeOrder,
      createdBy: updatedTicket.createdBy || tickets[index].createdBy || 'admin'
    };
    saveTickets(tickets);
    if (supabase) {
      (async () => {
        try {
          const t = tickets[index];
          await supabase.from('delivery_tickets').upsert({
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
          });
        } catch (e) {
          console.error("Error updating ticket in Supabase:", e);
        }
      })();
    }
    return tickets[index];
  }
  return null;
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
      tickets[index].completedAt = new Date().toISOString();
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
        }
      }
    }

    saveTickets(tickets);
    if (supabase) {
      supabase.from('delivery_tickets').update({
        status: status,
        failure_reason: failureReason,
        completed_lat: completedLat,
        completed_lng: completedLng,
        notes: tickets[index].notes,
        furgo_id: tickets[index].furgoId,
        furgo_label: tickets[index].furgoLabel || null
      }).eq('id', ticketId).then(({ error }) => {
        if (error) console.error("Error updating ticket status in Supabase:", error);
      });
    }
    return tickets[index];
  }
  return null;
}

// Eliminar un ticket (para el administrador)
export function deleteTicket(ticketId) {
  const tickets = getTickets();
  const filtered = tickets.filter(t => t.id !== ticketId);
  saveTickets(filtered);
  if (supabase) {
    supabase.from('delivery_tickets').delete().eq('id', ticketId).then(({ error }) => {
      if (error) console.error("Error deleting ticket from Supabase:", error);
    });
  }
}

// Iniciar mes de cero
export function resetMonthlyTickets() {
  saveTickets([]);
}

// Obtener rango de TV según las pulgadas
export function getTVRange(inches) {
  const inch = parseInt(inches, 10);
  if (inch <= 49) return '49';
  if (inch <= 74) return '74';
  return '115';
}

// Obtener turnos
export function getShifts() {
  initDB();
  return JSON.parse(localStorage.getItem('delivery_shifts')) || [];
}

// Guardar turnos
export function saveShifts(shifts) {
  localStorage.setItem('delivery_shifts', JSON.stringify(shifts));
  if (supabase) {
    (async () => {
      try {
        const formatted = shifts.map(s => ({
          id: s.id,
          furgo_id: s.furgoId,
          date: s.date,
          status: s.status,
          opened_at: s.openedAt || null,
          closed_at: s.closedAt || null,
          created_by: s.createdBy || 'admin'
        }));
        await supabase.from('delivery_shifts').upsert(formatted);
      } catch (e) {
        console.error("Error saving shifts to Supabase:", e);
      }
    })();
  }
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
export function saveShiftRoute(furgoId, date, routeName) {
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
  saveShifts(shifts);
}

// Cerrar el turno de un día
export function closeShift(furgoId, date, summary) {
  const shifts = getShifts();
  const shiftId = `${furgoId}_${date}`;
  const existingIndex = shifts.findIndex(s => s.id === shiftId);
  const existingShift = existingIndex !== -1 ? shifts[existingIndex] : {};

  const newShift = {
    id: shiftId,
    furgoId,
    date,
    status: 'closed',
    closedAt: new Date().toISOString(),
    routeName: existingShift.routeName || '',
    summary
  };

  if (existingIndex !== -1) {
    shifts[existingIndex] = newShift;
  } else {
    shifts.push(newShift);
  }

  saveShifts(shifts);
  return newShift;
}

// Reabrir un turno
export function reopenShift(furgoId, date) {
  const shifts = getShifts();
  const shiftId = `${furgoId}_${date}`;
  const filtered = shifts.filter(s => s.id !== shiftId);
  saveShifts(filtered);
}

// Resetear turnos mensuales
export function resetMonthlyShifts() {
  saveShifts([]);
}

// Crear nuevo usuario dinámicamente
export function addUser(username, label, password, role = 'repartidor', createdBy = null) {
  const users = getUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'El usuario ya existe' };
  }
  const newUser = {
    id: username.toLowerCase().trim(),
    username: username.trim(),
    label: label.trim(),
    password: password.trim(),
    role,
    createdBy
  };
  users.push(newUser);
  saveUsers(users);
  return { success: true, user: newUser };
}

// Eliminar un usuario
export function deleteUser(userId) {
  const users = getUsers();
  const filtered = users.filter(u => u.id !== userId);
  saveUsers(filtered);
  if (supabase) {
    supabase.from('delivery_users').delete().eq('id', userId).then(({ error }) => {
      if (error) console.error("Error deleting user from Supabase:", error);
    });
  }
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
export function saveAppName(name, userId) {
  if (userId) {
    localStorage.setItem(`delivery_app_name_${userId}`, name.trim());
  }
  localStorage.setItem('delivery_app_name', name.trim());
  if (supabase) {
    const key = userId ? `app_name_${userId}` : 'app_name';
    supabase.from('delivery_settings').upsert({ key, value: name.trim() }).then(({ error }) => {
      if (error) console.error("Error saving app name to Supabase:", error);
    });
  }
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
export function saveKmPrice(price, userId) {
  const pStr = price.toString();
  if (userId) {
    localStorage.setItem(`delivery_km_price_${userId}`, pStr);
  }
  localStorage.setItem('delivery_km_price', pStr);
  if (supabase) {
    const key = userId ? `km_price_${userId}` : 'km_price';
    supabase.from('delivery_settings').upsert({ key, value: pStr }).then(({ error }) => {
      if (error) console.error("Error saving km price to Supabase:", error);
    });
  }
}

// Obtener kms de una ruta
export function getRouteKms(furgoId, date) {
  const key = `delivery_route_kms_${furgoId}_${date}`;
  const kms = localStorage.getItem(key);
  return kms !== null ? (parseFloat(kms) || 0) : 0;
}

// Guardar kms de una ruta
export function saveRouteKms(furgoId, date, kms) {
  const key = `delivery_route_kms_${furgoId}_${date}`;
  const kStr = kms.toString();
  localStorage.setItem(key, kStr);
  if (supabase) {
    const dbKey = `route_kms_${furgoId}_${date}`;
    supabase.from('delivery_settings').upsert({ key: dbKey, value: kStr }).then(({ error }) => {
      if (error) console.error("Error saving route kms to Supabase:", error);
    });
  }
}

// Agregar nueva tarifa
export function addTariff(tariff) {
  const tariffs = getTariffs();
  const id = 'CUSTOM_' + Date.now();
  const newTariff = {
    ...tariff,
    id
  };
  tariffs.push(newTariff);
  saveTariffs(tariffs);
  return { success: true, tariff: newTariff };
}

// Eliminar tarifa
export function deleteTariff(id) {
  const tariffs = getTariffs();
  const filtered = tariffs.filter(t => t.id !== id);
  saveTariffs(filtered);
  if (supabase) {
    supabase.from('delivery_tariffs').delete().eq('id', id).then(({ error }) => {
      if (error) console.error("Error deleting tariff from Supabase:", error);
    });
  }
}

// Guardar ubicación en tiempo real de un repartidor
export function saveDriverLocation(furgoId, lat, lng) {
  try {
    const locations = JSON.parse(localStorage.getItem('delivery_driver_locations')) || {};
    locations[furgoId] = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('delivery_driver_locations', JSON.stringify(locations));
    if (supabase) {
      supabase.from('delivery_settings').upsert({
        key: `loc_${furgoId}`,
        value: JSON.stringify({ lat: parseFloat(lat), lng: parseFloat(lng), updatedAt: new Date().toISOString() })
      }).then(({ error }) => {
        if (error) console.error("Error pushing driver location to Supabase:", error);
      });
    }
  } catch (e) {
    console.error("Error saving driver location:", e);
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
              displayName: `${first.address}, ${first.province}, España`,
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
export function toggleUserSearchPermission(userId) {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (user) {
    user.canSearch = !user.canSearch;
    saveUsers(users);
    return { success: true, user };
  }
  return { success: false, error: 'Usuario no encontrado' };
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
export function saveRouteStartAddr(addr, userId) {
  if (userId) {
    localStorage.setItem(`delivery_start_addr_${userId}`, addr.trim());
  }
  localStorage.setItem('delivery_default_start_addr', addr.trim());
  if (supabase) {
    const key = userId ? `default_start_addr_${userId}` : 'default_start_addr';
    supabase.from('delivery_settings').upsert({ key, value: addr.trim() }).then(({ error }) => {
      if (error) console.error("Error saving start address setting to cloud:", error);
    });
  }
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
export function saveRouteEndAddr(addr, userId) {
  if (userId) {
    localStorage.setItem(`delivery_end_addr_${userId}`, addr.trim());
  }
  localStorage.setItem('delivery_default_end_addr', addr.trim());
  if (supabase) {
    const key = userId ? `default_end_addr_${userId}` : 'default_end_addr';
    supabase.from('delivery_settings').upsert({ key, value: addr.trim() }).then(({ error }) => {
      if (error) console.error("Error saving end address setting to cloud:", error);
    });
  }
}

// Obtener API Keys de mapas
export function getGoogleMapsKey() {
  return localStorage.getItem('delivery_google_maps_api_key') || '';
}
export function saveGoogleMapsKey(key) {
  localStorage.setItem('delivery_google_maps_api_key', key.trim());
  if (supabase) {
    supabase.from('delivery_settings').upsert({ key: 'google_maps_api_key', value: key.trim() }).then(({ error }) => {
      if (error) console.error("Error saving google maps key to cloud:", error);
    });
  }
}

export function getMapboxToken() {
  return localStorage.getItem('delivery_mapbox_access_token') || '';
}
export function saveMapboxToken(token) {
  localStorage.setItem('delivery_mapbox_access_token', token.trim());
  if (supabase) {
    supabase.from('delivery_settings').upsert({ key: 'mapbox_access_token', value: token.trim() }).then(({ error }) => {
      if (error) console.error("Error saving mapbox token to cloud:", error);
    });
  }
}

// Parsear información de franja horaria y duración codificada en las notas
export function parseTicketNotes(notesText) {
  let timeSlot = 'any';
  let estimatedDuration = 10; // 10 minutos por defecto
  let cleanNotes = notesText || '';

  const slotMatch = cleanNotes.match(/^\[Horario:\s*([^\]]+)\]/);
  if (slotMatch) {
    const rawSlot = slotMatch[1].trim().toLowerCase();
    timeSlot = rawSlot === 'mañana' ? 'morning' : rawSlot === 'tarde' ? 'afternoon' : 'any';
    cleanNotes = cleanNotes.replace(/^\[Horario:\s*[^\]]+\]\s*/, '');
  }

  const durationMatch = cleanNotes.match(/^\[Duracion:\s*(\d+)\s*min\]/);
  if (durationMatch) {
    estimatedDuration = parseInt(durationMatch[1], 10);
    cleanNotes = cleanNotes.replace(/^\[Duracion:\s*\d+\s*min\]\s*/, '');
  }

  return { timeSlot, estimatedDuration, cleanNotes };
}

// Codificar franja horaria y duración como prefijo en las notas
export function encodeTicketNotes(timeSlot, estimatedDuration, cleanNotesText) {
  const slotStr = timeSlot === 'morning' ? 'Mañana' : timeSlot === 'afternoon' ? 'Tarde' : 'Cualquiera';
  const prefix = `[Horario: ${slotStr}] [Duracion: ${estimatedDuration || 10} min] `;
  return (prefix + (cleanNotesText || '').trim()).trim();
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
export function saveRouteStartTime(furgoId, date, time) {
  if (furgoId && date) {
    const key = `delivery_route_start_time_${furgoId}_${date}`;
    localStorage.setItem(key, time);
    if (supabase) {
      const dbKey = `route_start_time_${furgoId}_${date}`;
      supabase.from('delivery_settings').upsert({ key: dbKey, value: time }).then(({ error }) => {
        if (error) console.error("Error saving route start time to Supabase:", error);
      });
    }
  }
}




