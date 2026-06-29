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

export function reinitSupabase() {
  const url = localStorage.getItem('supabase_url');
  const key = localStorage.getItem('supabase_key');
  
  const activeUrl = url === 'none' ? null : (url || defaultUrl);
  const activeKey = url === 'none' ? null : (key || defaultKey);
  
  if (activeUrl && activeKey) {
    try {
      supabase = createClient(activeUrl, activeKey);
      initializeSupabaseTables();
      syncFromCloud();
    } catch (e) {
      console.error("Error re-initializing Supabase client:", e);
      supabase = null;
    }
  } else {
    supabase = null;
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
      const appName = localStorage.getItem('delivery_app_name') || 'LogiEarn';
      await supabase.from('delivery_settings').insert([
        { key: 'module_price', value: mPrice.toString() },
        { key: 'app_name', value: appName }
      ]);
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
      localStorage.setItem('delivery_tariffs', JSON.stringify(localTariffs));
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
      const mPrice = settings.find(s => s.key === 'module_price');
      if (mPrice) localStorage.setItem('delivery_module_price', JSON.stringify(parseFloat(mPrice.value)));
      
      const appNameSetting = settings.find(s => s.key === 'app_name');
      if (appNameSetting) localStorage.setItem('delivery_app_name', appNameSetting.value);
    }

    notifySync();
  } catch (e) {
    console.error("Error pulling database from Supabase:", e);
  }
}

const DEFAULT_USERS = [
  { id: 'admin', username: 'admin', label: 'Super Administrador', role: 'superadmin', password: 'admin' },
  { id: 'furgo1', username: 'furgo1', label: 'Furgoneta 1', role: 'repartidor', password: '1111' },
  { id: 'furgo2', username: 'furgo2', label: 'Furgoneta 2', role: 'repartidor', password: '2222' },
  { id: 'furgo3', username: 'furgo3', label: 'Furgoneta 3', role: 'repartidor', password: '3333' }
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
  { id: 'BSND', name: 'Barra de Sonido', block: 'Otros', type: 'modules', value: 3 },
  { id: 'PM_BSND', name: 'Puesta en Marcha Barra de Sonido', block: 'Otros', type: 'modules', value: 3 },
  { id: 'CUELGUE_BSND', name: 'Cuelgue Barra de Sonido', block: 'Otros', type: 'modules', value: 8 },
  { id: 'MFRA', name: 'Marco Frame', block: 'Otros', type: 'modules', value: 3 },
  { id: 'SPAR', name: 'Soporte de Pared', block: 'Otros', type: 'modules', value: 3 },
  { id: 'SSUE', name: 'Soporte de Suelo', block: 'Otros', type: 'modules', value: 3 },
  { id: 'ALTA', name: 'Altavoces', block: 'Otros', type: 'modules', value: 3 },
  { id: 'TDIC', name: 'Toca discos', block: 'Otros', type: 'modules', value: 3 },
  { id: 'PROY', name: 'Proyector', block: 'Otros', type: 'modules', value: 3 }
];

export const PREDEFINED_TV_INCHES = [32, 40, 43, 48, 49, 50, 55, 58, 65, 70, 74, 75, 77, 83, 85, 98, 100, 115];

// Inicialización de la base de datos
export function initDB() {
  if (!localStorage.getItem('delivery_users')) {
    localStorage.setItem('delivery_users', JSON.stringify(DEFAULT_USERS));
  } else {
    // Migration: make sure 'admin' user has 'superadmin' role
    try {
      let current = JSON.parse(localStorage.getItem('delivery_users'));
      const adminUser = current.find(u => u.id === 'admin');
      if (adminUser && adminUser.role === 'admin') {
        adminUser.role = 'superadmin';
        adminUser.label = 'Super Administrador';
        localStorage.setItem('delivery_users', JSON.stringify(current));
      }
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

export function getModulePrice() {
  initDB();
  return parseFloat(localStorage.getItem('delivery_module_price'));
}

export function saveModulePrice(price) {
  localStorage.setItem('delivery_module_price', JSON.stringify(price));
  if (supabase) {
    supabase.from('delivery_settings').upsert({ key: 'module_price', value: price.toString() }).then(({ error }) => {
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
    const price = isCustom 
      ? (task.price || task.unitPrice || 0) 
      : calculateTaskPrice(task.tariffId, tariffs, modulePrice);
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
      inches: task.inches || null
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
    const price = isCustom 
      ? (task.price || task.unitPrice || 0) 
      : calculateTaskPrice(task.tariffId, tariffs, modulePrice);
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
      inches: task.inches || null
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
    saveTickets(tickets);
    if (supabase) {
      supabase.from('delivery_tickets').update({
        status: status,
        failure_reason: failureReason,
        completed_lat: completedLat,
        completed_lng: completedLng
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
export function getAppName() {
  return localStorage.getItem('delivery_app_name') || 'LogiEarn';
}

// Guardar nombre de la aplicación
export function saveAppName(name) {
  localStorage.setItem('delivery_app_name', name.trim());
  if (supabase) {
    supabase.from('delivery_settings').upsert({ key: 'app_name', value: name.trim() }).then(({ error }) => {
      if (error) console.error("Error saving app name to Supabase:", error);
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

// Convertir texto de dirección a coordenadas mediante Nominatim (OSM)
export async function geocodeAddress(addressText) {
  if (!addressText || !addressText.trim()) return null;
  try {
    const countryCode = localStorage.getItem('search_country_code') || 'es';
    const cityBias = localStorage.getItem('search_city_bias') || 'Barcelona';
    const strictCity = localStorage.getItem('search_strict_city') !== 'false';

    let searchQuery = addressText.trim();
    const hasComma = searchQuery.includes(',');
    const hasPostalCode = /\b\d{5}\b/.test(searchQuery);
    const commonCities = ['sabadell', 'terrassa', 'badalona', 'hospitalet', 'mataro', 'cornella', 'sant cugat', 'girona', 'tarragona', 'lleida', 'vic', 'manresa', 'sitges', 'castelldefels', 'viladecans', 'prat', 'rubi', 'granollers', 'mollet', 'figueres', 'reus', 'santiago', 'sevilla', 'bilbao', 'madrid', 'valencia', 'zaragoza', 'malaga', 'murcia', 'palma', 'las palmas', 'alicante', 'cordoba', 'valladolid', 'vigo', 'gijon'];
    const hasCommonCity = commonCities.some(city => searchQuery.toLowerCase().includes(city));

    const shouldAppendCity = strictCity && cityBias && !hasComma && !hasPostalCode && !hasCommonCity && !searchQuery.toLowerCase().includes(cityBias.toLowerCase());

    if (shouldAppendCity) {
      searchQuery += `, ${cityBias}`;
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=${countryCode}&q=${encodeURIComponent(searchQuery)}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!response.ok) return null;
    let data = await response.json();

    if (!data || data.length === 0) {
      const strippedQuery = searchQuery.replace(/^\s*(carrer\s+(de\s+|d')?|calle\s+(de\s+)?|avinguda\s+(de\s+|d')?|avenida\s+(de\s+)?|paseo\s+(de\s+)?|passeig\s+(de\s+|d')?|plaza\s+(de\s+)?|plaça\s+(de\s+|d')?|ronda\s+(de\s+)?|via\s+|vía\s+|camí\s+(de\s+|d')?|cami\s+(de\s+|d')?|carretera\s+(de\s+)?|ctra\s+|pasaje\s+(de\s+)?|passatge\s+(de\s+|d')?|ptge\s+)/i, '').trim();
      if (strippedQuery && strippedQuery !== searchQuery) {
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=${countryCode}&q=${encodeURIComponent(strippedQuery)}`;
        const fallbackRes = await fetch(fallbackUrl, { headers: { 'Accept': 'application/json' } });
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




