// db.js - Gestión de base de datos local y lógica de negocio en localStorage

const DEFAULT_USERS = [
  { id: 'admin', username: 'admin', label: 'Administrador', role: 'admin', password: 'admin' },
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
}

export function getModulePrice() {
  initDB();
  return parseFloat(localStorage.getItem('delivery_module_price'));
}

export function saveModulePrice(price) {
  localStorage.setItem('delivery_module_price', JSON.stringify(price));
}

export function getTariffs() {
  initDB();
  return JSON.parse(localStorage.getItem('delivery_tariffs'));
}

export function saveTariffs(tariffs) {
  localStorage.setItem('delivery_tariffs', JSON.stringify(tariffs));
}

export function getTickets() {
  initDB();
  return JSON.parse(localStorage.getItem('delivery_tickets'));
}

export function saveTickets(tickets) {
  localStorage.setItem('delivery_tickets', JSON.stringify(tickets));
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
    const price = calculateTaskPrice(task.tariffId, tariffs, modulePrice);
    const subtotal = price * task.quantity;
    totalCalculado += subtotal;
    const tariff = tariffs.find(t => t.id === task.tariffId);

    return {
      tariffId: task.tariffId,
      name: tariff ? tariff.name : 'Desconocido',
      quantity: task.quantity,
      unitPrice: price,
      subtotal: subtotal
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
    routeName: users.find(u => u.id === ticketData.furgoId)?.label || ticketData.furgoId,
    customerName: ticketData.customerName,
    phone: ticketData.phone || '',
    address: ticketData.address,
    notes: ticketData.notes || '',
    tasks: detailedTasks,
    totalPrice: totalCalculado,
    createdAt: new Date().toISOString()
  };

  tickets.push(newTicket);
  saveTickets(tickets);
  return newTicket;
}

// Actualizar un ticket existente
export function updateTicket(updatedTicket) {
  const tickets = getTickets();
  const tariffs = getTariffs();
  const modulePrice = getModulePrice();

  let totalCalculado = 0;
  const detailedTasks = updatedTicket.tasks.map(task => {
    const price = calculateTaskPrice(task.tariffId, tariffs, modulePrice);
    const subtotal = price * task.quantity;
    totalCalculado += subtotal;
    const tariff = tariffs.find(t => t.id === task.tariffId);

    return {
      tariffId: task.tariffId,
      name: tariff ? tariff.name : 'Desconocido',
      quantity: task.quantity,
      unitPrice: price,
      subtotal: subtotal
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
      routeName: users.find(u => u.id === updatedTicket.furgoId)?.label || updatedTicket.furgoId,
      customerName: updatedTicket.customerName,
      phone: updatedTicket.phone || '',
      address: updatedTicket.address,
      notes: updatedTicket.notes || '',
      tasks: detailedTasks,
      totalPrice: totalCalculado
    };
    saveTickets(tickets);
    return tickets[index];
  }
  return null;
}

// Eliminar un ticket (para el administrador)
export function deleteTicket(ticketId) {
  const tickets = getTickets();
  const filtered = tickets.filter(t => t.id !== ticketId);
  saveTickets(filtered);
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
export function addUser(username, label, password, role = 'repartidor') {
  const users = getUsers();
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'El usuario ya existe' };
  }
  const newUser = {
    id: username.toLowerCase().trim(),
    username: username.trim(),
    label: label.trim(),
    password: password.trim(),
    role
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
}

// Obtener nombre de la aplicación
export function getAppName() {
  return localStorage.getItem('delivery_app_name') || 'LogiEarn';
}

// Guardar nombre de la aplicación
export function saveAppName(name) {
  localStorage.setItem('delivery_app_name', name.trim());
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
}




