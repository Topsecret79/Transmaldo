import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Settings, 
  TrendingUp, 
  Download, 
  Trash2, 
  Plus, 
  LogOut, 
  Lock, 
  User, 
  FileSpreadsheet, 
  Edit, 
  Search, 
  CheckCircle,
  Package,
  Info,
  Calendar,
  MapPin,
  RefreshCw,
  X,
  Minus,
  Clock
} from 'lucide-react';
import { 
  initDB, 
  getUsers, 
  saveUsers, 
  getModulePrice, 
  saveModulePrice, 
  getTariffs, 
  saveTariffs, 
  getTickets, 
  addTicket, 
  updateTicket, 
  deleteTicket, 
  resetMonthlyTickets,
  getTVRange,
  PREDEFINED_TV_INCHES,
  getShifts,
  getShiftStatus,
  closeShift,
  reopenShift,
  resetMonthlyShifts,
  getShift,
  saveShiftRoute,
  addUser,
  deleteUser,
  getAppName,
  saveAppName,
  addTariff,
  deleteTariff
} from './db';

initDB();

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const [tickets, setTickets] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [modulePrice, setModulePrice] = useState(3.81);
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);

  const [activeTab, setActiveTab] = useState(''); 
  const [ticketFilterFurgo, setTicketFilterFurgo] = useState('all');
  const [ticketFilterDate, setTicketFilterDate] = useState('');
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [alertMsg, setAlertMsg] = useState({ text: '', type: '' });

  // Estado que controla si estamos editando
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editingFurgoId, setEditingFurgoId] = useState('');

  // Estados del Formulario
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [ticketDate, setTicketDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [ticketRoute, setTicketRoute] = useState('');

  // Lista de TVs añadidas al ticket actual
  // Cada TV: { id: string, inches: number, action: 'entrega'|'recogida'|'combinado', pmType: 'none'|'basic'|'complex', cuelgue: boolean, recogidaViejaType: 'none'|'urbantz'|'no_urbantz' }
  const [formTvs, setFormTvs] = useState([]);

  // Estados temporales para añadir una TV nueva al listado
  const [tempTvInches, setTempTvInches] = useState('55');
  const [tempTvAction, setTempTvAction] = useState('entrega');

  // Cantidades de otros artículos no-TV (Paquetería y Otros Elementos)
  // { tariffId: quantity }
  const [otherQuantities, setOtherQuantities] = useState({});

  // Cierre de turno
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftSummaryDate, setShiftSummaryDate] = useState('');
  const [shiftSummaryFurgoId, setShiftSummaryFurgoId] = useState('');

  // Estados de Ruta y Carga Dinámica de Usuarios
  const [routeName, setRouteName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Nombre dinámico de la aplicación
  const [appName, setAppName] = useState(getAppName());
  const [appNameInput, setAppNameInput] = useState(getAppName());
  const [appTheme, setAppTheme] = useState(localStorage.getItem('delivery_app_theme') || 'theme-emerald');
  const [showPassword, setShowPassword] = useState(false);

  // Estados para añadir nueva tarifa
  const [newTariffName, setNewTariffName] = useState('');
  const [newTariffBlock, setNewTariffBlock] = useState('Otros');
  const [newTariffType, setNewTariffType] = useState('fixed');
  const [newTariffValue, setNewTariffValue] = useState('');

  useEffect(() => {
    loadData();
    const savedUser = localStorage.getItem('delivery_session');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setCurrentUser(parsed);
      setActiveTab(parsed.role === 'admin' ? 'dashboard' : 'new_ticket');
    }
  }, []);

  // Aplicar tema en el body
  useEffect(() => {
    document.body.className = appTheme;
    localStorage.setItem('delivery_app_theme', appTheme);
  }, [appTheme]);

  // Actualizar el título de la pestaña del navegador automáticamente
  useEffect(() => {
    document.title = `${appName} - Control de Repartos y Ganancias`;
  }, [appName]);

  // Sincronizar ruta por defecto del ticket
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      const currentDbUser = users.find(u => u.id === currentUser.id);
      setTicketRoute(currentDbUser ? currentDbUser.label : currentUser.label);
    }
  }, [currentUser, ticketDate, users]);



  const loadData = () => {
    setTickets(getTickets());
    setTariffs(getTariffs());
    setModulePrice(getModulePrice());
    setUsers(getUsers());
    setShifts(getShifts());
    setAppName(getAppName());
    setAppNameInput(getAppName());
  };

  const triggerAlert = (text, type = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg({ text: '', type: '' }), 4000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    const dbUsers = getUsers();
    const foundUser = dbUsers.find(
      u => u.username.toLowerCase() === usernameInput.toLowerCase() && u.password === passwordInput
    );

    if (foundUser) {
      setCurrentUser(foundUser);
      localStorage.setItem('delivery_session', JSON.stringify(foundUser));
      setActiveTab(foundUser.role === 'admin' ? 'dashboard' : 'new_ticket');
      setUsernameInput('');
      setPasswordInput('');
      loadData();
      triggerAlert(`¡Bienvenido, ${foundUser.label}!`);
    } else {
      setLoginError('Usuario o contraseña incorrectos');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('delivery_session');
    setCurrentUser(null);
    setActiveTab('');
    setEditingTicketId(null);
    triggerAlert('Sesión cerrada correctamente');
  };

  // Añadir una televisión a la lista del formulario
  const addTvToForm = () => {
    const newTv = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      inches: parseInt(tempTvInches),
      action: tempTvAction,
      pmType: 'none',
      cuelgue: false,
      recogidaViejaType: 'none'
    };
    setFormTvs([...formTvs, newTv]);
  };

  // Quitar una televisión de la lista del formulario
  const removeTvFromForm = (tvId) => {
    setFormTvs(formTvs.filter(tv => tv.id !== tvId));
  };

  // Modificar propiedades de una TV añadida
  const updateTvInForm = (tvId, field, value) => {
    setFormTvs(formTvs.map(tv => {
      if (tv.id === tvId) {
        return { ...tv, [field]: value };
      }
      return tv;
    }));
  };

  // Cambiar cantidades de otros artículos (Paquetería y Otros)
  const handleOtherQtyChange = (tariffId, change) => {
    setOtherQuantities(prev => {
      const cur = prev[tariffId] || 0;
      const newVal = Math.max(0, cur + change);
      return { ...prev, [tariffId]: newVal };
    });
  };

  // Procesar envío del formulario (Nuevo o Edición)
  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!customerName.trim() || !address.trim()) {
      triggerAlert('Por favor, rellena el cliente y dirección', 'error');
      return;
    }

    const checkFurgoId = editingTicketId ? editingFurgoId : currentUser.id;
    const isClosed = getShiftStatus(checkFurgoId, ticketDate) === 'closed';
    if (isClosed && currentUser.role !== 'admin') {
      triggerAlert('El turno para este día ya ha sido cerrado. No puedes guardar ni editar repartos para esta fecha.', 'error');
      return;
    }

    // Agrupar todas las tareas y calcular tarifas locales
    const tasksArray = [];

    // 1. Añadir las TVs y sus servicios vinculados
    formTvs.forEach(tv => {
      const range = getTVRange(tv.inches);
      
      // Artículo principal TV
      const mainTariffId = tv.action === 'combinado' ? `TV_COMB_${range}` : `TV_ENT_${range}`;
      let actionLabel = tv.action === 'entrega' ? 'Entrega' : tv.action === 'recogida' ? 'Recogida' : 'Entrega + Recogida';
      
      tasksArray.push({
        tariffId: mainTariffId,
        quantity: 1
      });

      // PM
      if (tv.pmType !== 'none') {
        const pmId = tv.pmType === 'basic' ? `PM_BAS_${range}` : `PM_COMP_${range}`;
        tasksArray.push({
          tariffId: pmId,
          quantity: 1
        });
      }

      // Cuelgue
      if (tv.cuelgue) {
        const cuelgueId = `CUELGUE_${range}`;
        tasksArray.push({
          tariffId: cuelgueId,
          quantity: 1
        });
      }

      // Recogida vieja
      if (tv.recogidaViejaType !== 'none') {
        const recId = tv.recogidaViejaType === 'urbantz' ? 'TV_VIEJA_URB' : 'TV_VIEJA_NO_URB';
        tasksArray.push({
          tariffId: recId,
          quantity: 1
        });
      }
    });

    // 2. Añadir otros artículos no-TV que tengan cantidad mayor a 0
    Object.entries(otherQuantities).forEach(([tariffId, quantity]) => {
      if (quantity > 0) {
        tasksArray.push({
          tariffId,
          quantity
        });
      }
    });

    if (tasksArray.length === 0) {
      triggerAlert('Debes registrar al menos un artículo o servicio', 'error');
      return;
    }

    // Encontrar el ID de la furgoneta correspondiente a la ruta seleccionada (ticketRoute)
    // Buscamos comparando tanto por etiqueta (label) como por identificador (id) de manera insensible a mayúsculas
    const targetUser = users.find(u => 
      u.label.toLowerCase() === ticketRoute.toLowerCase() || 
      u.id.toLowerCase() === ticketRoute.toLowerCase()
    );
    const assignedFurgoId = targetUser ? targetUser.id : (editingTicketId ? editingFurgoId : currentUser.id);

    // Datos del ticket estructurados
    const ticketData = {
      id: editingTicketId || undefined,
      furgoId: assignedFurgoId,
      date: ticketDate,
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      notes: notes.trim(),
      tasks: tasksArray
    };

    if (editingTicketId) {
      updateTicket(ticketData);
      triggerAlert('Registro modificado con éxito');
      cancelEditing();
    } else {
      addTicket(ticketData);
      triggerAlert('Registro guardado con éxito');
      // Resetear
      setCustomerName('');
      setPhone('');
      setAddress('');
      setFormTvs([]);
      setOtherQuantities({});
      setNotes('');
      setTicketDate(new Date().toISOString().split('T')[0]);
      loadData();
    }
  };

  // Iniciar la edición de un ticket y reconstruir los estados desde el listado de tareas del ticket
  const startEditing = (ticket) => {
    const isClosed = getShiftStatus(ticket.furgoId, ticket.date) === 'closed';
    if (isClosed && currentUser.role !== 'admin') {
      triggerAlert('El turno para la fecha de este reparto está cerrado. No puedes editarlo.', 'error');
      return;
    }

    setEditingTicketId(ticket.id);
    setEditingFurgoId(ticket.furgoId);
    setCustomerName(ticket.customerName);
    setPhone(ticket.phone || '');
    setAddress(ticket.address);
    setTicketDate(ticket.date);
    setNotes(ticket.notes || '');
    setTicketRoute(ticket.furgoLabel || users.find(u => u.id === ticket.furgoId)?.label || ticket.furgoId);

    // Reconstruir TVs y otros artículos a partir de las tareas guardadas en el ticket
    const tempTvs = [];
    const tempOthers = {};

    // Para evitar duplicar TVs al procesar la lista secuencial
    // Agrupamos por patrones de IDs de tareas
    // Buscamos tareas de TV
    const tvMainTasks = ticket.tasks.filter(t => t.tariffId.startsWith('TV_ENT_') || t.tariffId.startsWith('TV_COMB_'));
    const pmTasks = ticket.tasks.filter(t => t.tariffId.startsWith('PM_') && t.tariffId !== 'PM_BSND');
    const cuelgueTasks = ticket.tasks.filter(t => t.tariffId.startsWith('CUELGUE_') && t.tariffId !== 'CUELGUE_BSND');
    const viejaTasks = ticket.tasks.filter(t => t.tariffId === 'TV_VIEJA_URB' || t.tariffId === 'TV_VIEJA_NO_URB');

    // Reconstruir cada TV basándonos en la tarea principal de la TV
    // Nota: Como antes lo simplificamos a una TV por ticket, mapeamos secuencialmente
    tvMainTasks.forEach((mTask, idx) => {
      // Extraer rango e inches aproximadas (o leer de metadatos si existían, si no usamos las del rango)
      const isComb = mTask.tariffId.includes('COMB');
      let range = '49';
      if (mTask.tariffId.includes('74')) range = '74';
      if (mTask.tariffId.includes('115')) range = '115';

      // Intentar extraer pulgadas del nombre de la tarea (ej: "TV 55\" (Entrega)")
      const inchMatch = mTask.name.match(/TV (\d+)"/);
      const inches = inchMatch ? parseInt(inchMatch[1]) : (range === '49' ? 43 : range === '74' ? 55 : 75);

      // Ver si tiene PM asociada
      const pmMatch = pmTasks[idx];
      const pmType = pmMatch ? (pmMatch.tariffId.includes('BAS') ? 'basic' : 'complex') : 'none';

      // Ver si tiene cuelgue asociado
      const cuelgueMatch = cuelgueTasks[idx];
      const cuelgue = !!cuelgueMatch;

      // Ver si tiene recogida vieja asociada
      const viejaMatch = viejaTasks[idx];
      const recogidaViejaType = viejaMatch ? (viejaMatch.tariffId.includes('URB') && !viejaMatch.tariffId.includes('NO_URB') ? 'urbantz' : 'no_urbantz') : 'none';

      tempTvs.push({
        id: 'tv_' + idx + Date.now().toString(),
        inches,
        action: isComb ? 'combinado' : (mTask.name.includes('Recogida') && !mTask.name.includes('Entrega') ? 'recogida' : 'entrega'),
        pmType,
        cuelgue,
        recogidaViejaType
      });
    });

    // Reconstruir otros artículos no-TV
    ticket.tasks.forEach(t => {
      const isTVRelated = (t.tariffId.startsWith('TV_ENT_') || 
                          t.tariffId.startsWith('TV_COMB_') || 
                          t.tariffId.startsWith('PM_') || 
                          t.tariffId.startsWith('CUELGUE_') || 
                          t.tariffId === 'TV_VIEJA_URB' || 
                          t.tariffId === 'TV_VIEJA_NO_URB') &&
                          t.tariffId !== 'PM_BSND' &&
                          t.tariffId !== 'CUELGUE_BSND';

      if (!isTVRelated) {
        tempOthers[t.tariffId] = t.quantity;
      }
    });

    setFormTvs(tempTvs);
    setOtherQuantities(tempOthers);
    setActiveTab('new_ticket');
  };

  const cancelEditing = () => {
    setEditingTicketId(null);
    setEditingFurgoId('');
    setCustomerName('');
    setPhone('');
    setAddress('');
    setFormTvs([]);
    setOtherQuantities({});
    setNotes('');
    setTicketRoute(currentUser ? currentUser.label : '');
    setTicketDate(new Date().toISOString().split('T')[0]);
    setActiveTab(currentUser.role === 'admin' ? 'tickets' : 'history');
  };

  const handleUpdateTariffValue = (id, newValue) => {
    const valueNum = parseFloat(newValue) || 0;
    const updated = tariffs.map(t => (t.id === id ? { ...t, value: valueNum } : t));
    saveTariffs(updated);
    setTariffs(updated);
    recalculateAllTickets(updated, modulePrice);
  };

  const handleCreateTariff = (e) => {
    e.preventDefault();
    if (!newTariffName.trim() || !newTariffValue.trim()) {
      triggerAlert('Por favor rellena el nombre y precio de la tarifa', 'error');
      return;
    }
    const valNum = parseFloat(newTariffValue) || 0;
    const res = addTariff({
      name: newTariffName.trim(),
      block: newTariffBlock,
      type: newTariffType,
      value: valNum
    });
    if (res.success) {
      triggerAlert(`Tarifa "${newTariffName}" añadida correctamente`);
      setNewTariffName('');
      setNewTariffValue('');
      loadData();
    }
  };

  const handleDeleteTariff = (id, name) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la tarifa "${name}"?`)) {
      deleteTariff(id);
      triggerAlert(`Tarifa "${name}" eliminada`);
      loadData();
    }
  };

  const handleUpdateModulePrice = (newPrice) => {
    const val = parseFloat(newPrice) || 0;
    saveModulePrice(val);
    setModulePrice(val);
    recalculateAllTickets(tariffs, val);
  };

  const recalculateAllTickets = (activeTariffs, activeModulePrice) => {
    const allTickets = getTickets();
    const updatedTickets = allTickets.map(ticket => {
      let totalCalculado = 0;
      const tasks = ticket.tasks.map(task => {
        const tariff = activeTariffs.find(t => t.id === task.tariffId);
        if (!tariff) return task;
        const price = tariff.type === 'fixed' ? tariff.value : tariff.value * activeModulePrice;
        return {
          ...task,
          unitPrice: price,
          subtotal: price * task.quantity
        };
      });
      totalCalculado = tasks.reduce((sum, t) => sum + t.subtotal, 0);
      return { ...ticket, tasks, totalPrice: totalCalculado };
    });
    saveTickets(updatedTickets);
    setTickets(updatedTickets);
  };

  const getShiftSummary = (furgoId, date) => {
    const dayTickets = tickets.filter(t => t.furgoId === furgoId && t.date === date);
    
    let totalTvs = 0;
    let totalPV = 0;
    let totalGV = 0;
    let totalPM = 0;
    let totalCuelgues = 0;
    let totalVieja = 0;
    let totalOtros = 0;
    
    dayTickets.forEach(t => {
      t.tasks.forEach(task => {
        const tariff = tariffs.find(tar => tar.id === task.tariffId);
        if (!tariff) return;
        
        if (tariff.block === 'Televisores') {
          if (task.tariffId === 'TV_VIEJA_URB' || task.tariffId === 'TV_VIEJA_NO_URB') {
            totalVieja += task.quantity;
          } else {
            totalTvs += task.quantity;
          }
        } else if (tariff.block === 'Paquetería') {
          if (task.tariffId.includes('PV')) {
            totalPV += task.quantity;
          } else if (task.tariffId.includes('GV')) {
            totalGV += task.quantity;
          }
        } else if (tariff.block === 'Instalaciones' || task.tariffId.startsWith('PM_') || task.tariffId.startsWith('CUELGUE_')) {
          if (task.tariffId.startsWith('PM_')) {
            totalPM += task.quantity;
          } else if (task.tariffId.startsWith('CUELGUE_')) {
            totalCuelgues += task.quantity;
          }
        } else {
          totalOtros += task.quantity;
        }
      });
    });
    
    return {
      ticketsCount: dayTickets.length,
      totalTvs,
      totalPV,
      totalGV,
      totalPM,
      totalCuelgues,
      totalVieja,
      totalOtros
    };
  };

  const handleConfirmCloseShift = (furgoId, date) => {
    if (window.confirm(`¿Estás seguro de que deseas finalizar tu turno del día ${date}? Una vez cerrado, no podrás agregar ni editar más repartos.`)) {
      const summary = getShiftSummary(furgoId, date);
      closeShift(furgoId, date, summary);
      triggerAlert('Turno cerrado y resumen diario generado con éxito');
      setShowShiftModal(false);
      loadData();
    }
  };

  const saveExcelToDisk = async (wb, filename) => {
    try {
      const XLSX = await import('xlsx');
      const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const response = await fetch('/api/save-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filename, base64 })
      });
      const result = await response.json();
      if (result.success) {
        return result.path;
      }
    } catch (e) {
      console.error('Failed to save excel to local disk:', e);
    }
    return null;
  };

  const handleExportCircuit = async () => {
    const targetDate = shiftSummaryDate || new Date().toISOString().split('T')[0];
    const dayTickets = tickets.filter(t => t.furgoId === currentUser.id && t.date === targetDate);
    
    if (dayTickets.length === 0) {
      triggerAlert('No hay repartos registrados para exportar en esta fecha.', 'error');
      return;
    }
    
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    
    const headers = ['Dirección', 'Cliente', 'Teléfono', 'Notas'];
    const rows = dayTickets.map(t => [
      t.address,
      t.customerName,
      t.phone || '',
      t.routeName ? `[Ruta: ${t.routeName}] ${t.notes || ''}`.trim() : (t.notes || '')
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Paradas Circuit');
    
    const filename = `Circuit_${currentUser.id}_${targetDate}.xlsx`;
    XLSX.writeFile(wb, filename);
    const localPath = await saveExcelToDisk(wb, filename);
    if (localPath) {
      triggerAlert(`Archivo guardado en carpeta 'exports' del proyecto`);
    } else {
      triggerAlert('Excel para Circuit generado con éxito');
    }
  };

  const handleReopenShift = (furgoId, date) => {
    if (window.confirm(`¿Estás seguro de que deseas reabrir el turno del día ${date} para esta furgoneta?`)) {
      reopenShift(furgoId, date);
      triggerAlert('Turno reabierto correctamente');
      loadData();
    }
  };

  const handleUpdateUserPassword = (id, newPassword) => {
    if (!newPassword.trim()) {
      triggerAlert('La contraseña no puede estar vacía', 'error');
      return;
    }
    const updated = users.map(u => (u.id === id ? { ...u, password: newPassword.trim() } : u));
    saveUsers(updated);
    setUsers(updated);
    triggerAlert('Contraseña actualizada');
  };

  const handleDeleteTicket = (id) => {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    const isClosed = getShiftStatus(ticket.furgoId, ticket.date) === 'closed';
    if (isClosed && currentUser.role !== 'admin') {
      triggerAlert('El turno para este reparto está cerrado. No puedes eliminarlo.', 'error');
      return;
    }

    if (window.confirm('¿Eliminar este registro de reparto?')) {
      deleteTicket(id);
      loadData();
      triggerAlert('Registro eliminado');
      if (editingTicketId === id) {
        cancelEditing();
      }
    }
  };

  // Exportar Excel
  const handleExportExcel = async () => {
    if (tickets.length === 0) {
      triggerAlert('No hay registros para exportar', 'error');
      return;
    }

    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Resumen General
    const totalEarnings = tickets.reduce((sum, t) => sum + t.totalPrice, 0);
    const furgos = users.filter(u => u.role === 'repartidor').map(u => u.id);
    const totalIVA = totalEarnings * 0.21;
    const totalRetencion = totalEarnings * 0.01;
    const totalNet = totalEarnings + totalIVA - totalRetencion;

    const summaryData = [
      ['CONTROL MENSUAL DE FACTURACIÓN DE REPARTOS'],
      [],
      ['Facturación Total Acumulada (Base Imponible)', `${totalEarnings.toFixed(2)} €`],
      ['IVA Acumulado (+21%)', `${totalIVA.toFixed(2)} €`],
      ['Retención Acumulada (-1%)', `${totalRetencion.toFixed(2)} €`],
      ['Total Neto Facturado', `${totalNet.toFixed(2)} €`],
      ['Total Entregas Realizadas', tickets.length],
      [],
      ['Furgoneta', 'Entregas', 'Base Imponible (€)', 'IVA 21% (€)', 'Retención 1% (€)', 'Total Neto (€)'],
    ];

    furgos.forEach(fid => {
      const fTickets = tickets.filter(t => t.furgoId === fid);
      const label = users.find(u => u.id === fid)?.label || fid;
      const earnings = fTickets.reduce((sum, t) => sum + t.totalPrice, 0);
      const iva = earnings * 0.21;
      const ret = earnings * 0.01;
      const net = earnings + iva - ret;
      summaryData.push([
        label, 
        fTickets.length, 
        `${earnings.toFixed(2)} €`,
        `${iva.toFixed(2)} €`,
        `-${ret.toFixed(2)} €`,
        `${net.toFixed(2)} €`
      ]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen General');

    // Hojas por furgoneta (Desglosando CADA artículo en una fila diferente para el control exacto)
    furgos.forEach(fid => {
      const fTickets = tickets.filter(t => t.furgoId === fid).sort((a,b) => a.date.localeCompare(b.date));
      const label = users.find(u => u.id === fid)?.label || fid;

      const sheetHeaders = ['Fecha', 'Ruta', 'Cliente', 'Teléfono', 'Dirección', 'Artículo / Tarea', 'Cantidad', 'Tarifa Unitaria (€)', 'Subtotal (€)', 'Notas / Observaciones'];
      const sheetRows = [];

      fTickets.forEach(t => {
        t.tasks.forEach(task => {
          sheetRows.push([
            t.date,
            t.routeName || '',
            t.customerName,
            t.phone || '',
            t.address,
            task.name,
            task.quantity,
            task.unitPrice,
            task.subtotal,
            t.notes || ''
          ]);
        });
      });

      const wsFurgo = XLSX.utils.aoa_to_sheet([sheetHeaders, ...sheetRows]);
      XLSX.utils.book_append_sheet(wb, wsFurgo, label);
    });

    const date = new Date();
    const filename = `Repartos_Desglosados_${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}.xlsx`;
    XLSX.writeFile(wb, filename);
    const localPath = await saveExcelToDisk(wb, filename);
    if (localPath) {
      triggerAlert(`Archivo guardado en carpeta 'exports' del proyecto`);
    } else {
      triggerAlert('Excel desglosado generado');
    }
  };

  const handleResetMonth = () => {
    const confirmation = window.confirm(
      '¿Deseas reiniciar la aplicación para el nuevo mes? Se borrarán todos los repartos. Exporta a Excel antes de hacerlo.'
    );
    if (confirmation) {
      resetMonthlyTickets();
      resetMonthlyShifts();
      loadData();
      setEditingTicketId(null);
      triggerAlert('Aplicación reiniciada para el nuevo mes.');
    }
  };

  const getFilteredTickets = () => {
    return tickets.filter(t => {
      if (ticketFilterFurgo !== 'all' && t.furgoId !== ticketFilterFurgo) return false;
      if (ticketFilterDate && t.date !== ticketFilterDate) return false;
      if (ticketSearchQuery.trim()) {
        const query = ticketSearchQuery.toLowerCase();
        const nameMatch = t.customerName ? t.customerName.toLowerCase().includes(query) : false;
        const addressMatch = t.address ? t.address.toLowerCase().includes(query) : false;
        const notesMatch = t.notes ? t.notes.toLowerCase().includes(query) : false;
        const taskMatch = t.tasks ? t.tasks.some(task => (task && task.name) ? task.name.toLowerCase().includes(query) : false) : false;
        if (!nameMatch && !addressMatch && !taskMatch && !notesMatch) return false;
      }
      return true;
    }).sort((a,b) => {
      const dateA = a.createdAt || '';
      const dateB = b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
  };


  // --- RENDERIZADO DEL FORMULARIO ---
  const renderTicketForm = () => {
    const itemsPaqueteria = tariffs.filter(t => t.block === 'Paquetería');
    const itemsOtros = tariffs.filter(t => t.block === 'Otros');

    const activeCheckFurgo = editingTicketId ? editingFurgoId : currentUser.id;
    const isClosed = getShiftStatus(activeCheckFurgo, ticketDate) === 'closed' && currentUser.role !== 'admin';

    return (
      <form onSubmit={handleFormSubmit} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Plus size={24} color="var(--primary)" /> 
            {editingTicketId ? 'Editar Hoja de Reparto' : 'Nuevo Registro de Reparto'}
          </h2>
          {editingTicketId && (
            <button type="button" onClick={cancelEditing} className="btn btn-secondary btn-small" style={{ width: 'auto', display: 'flex', padding: '6px' }}>
              <X size={16} /> Cancelar Edición
            </button>
          )}
        </div>

        {isClosed && (
          <div style={{
            color: 'var(--warning)',
            background: 'var(--warning-light)',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid var(--warning)',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'left'
          }}>
            <Lock size={18} />
            <span>El turno para la fecha seleccionada (<strong>{ticketDate}</strong>) ya ha sido cerrado. No puedes añadir ni editar repartos.</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
          {editingTicketId && currentUser.role === 'admin' && (
            <div className="input-group">
              <span className="input-label">Furgoneta asignada</span>
              <select className="form-input" value={editingFurgoId} onChange={(e) => setEditingFurgoId(e.target.value)} required disabled={isClosed}>
                {users.filter(u => u.role === 'repartidor').map(u => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <span className="input-label">Fecha</span>
              <input type="date" className="form-input" value={ticketDate} onChange={(e) => setTicketDate(e.target.value)} required disabled={isClosed || !!editingTicketId} />
            </div>

            {currentUser.role !== 'admin' && (
              <div className="input-group" style={{ marginBottom: 0 }}>
                <span className="input-label">Adjudicar a la Ruta / Furgoneta de</span>
                <select 
                  className="form-input" 
                  value={ticketRoute} 
                  onChange={(e) => setTicketRoute(e.target.value)} 
                  disabled={isClosed}
                  required
                >
                  {users.filter(u => u.role === 'repartidor').map(u => (
                    <option key={u.id} value={u.label}>{u.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div className="input-group">
              <span className="input-label">Cliente</span>
              <input type="text" className="form-input" placeholder="Ej. Jaime Rodríguez" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required disabled={isClosed} />
            </div>
            <div className="input-group">
              <span className="input-label">Teléfono</span>
              <input type="tel" className="form-input" placeholder="Ej. 612345678" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isClosed} />
            </div>
            <div className="input-group">
              <span className="input-label">Dirección</span>
              <input type="text" className="form-input" placeholder="Dirección de entrega" value={address} onChange={(e) => setAddress(e.target.value)} required disabled={isClosed} />
            </div>
          </div>

        {/* SECCIÓN A: AGREGAR TELEVISORES */}
        <div className="block-section" style={{ textAlign: 'left' }}>
          <div className="block-title">📺 Sección de Televisores</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Agrega las televisiones que transporte el cliente. Podrás configurar los servicios vinculados de cada una.
          </p>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--panel-border)' }}>
            <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '130px' }}>
              <span className="input-label">Pulgadas</span>
              <select 
                className="form-input" 
                value={PREDEFINED_TV_INCHES.includes(parseInt(tempTvInches)) ? tempTvInches : 'manual'} 
                onChange={(e) => {
                  if (e.target.value === 'manual') {
                    setTempTvInches('');
                  } else {
                    setTempTvInches(e.target.value);
                  }
                }} 
                disabled={isClosed}
              >
                {PREDEFINED_TV_INCHES.map(inch => <option key={inch} value={inch}>{inch}"</option>)}
                <option value="manual">Otra pulgada (Manual)...</option>
              </select>
            </div>
            
            {!PREDEFINED_TV_INCHES.includes(parseInt(tempTvInches)) && (
              <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '110px' }}>
                <span className="input-label">Escribe Pulgadas</span>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="Ej. 60" 
                  value={tempTvInches} 
                  onChange={(e) => setTempTvInches(e.target.value)}
                  disabled={isClosed}
                  min="1"
                />
              </div>
            )}

            <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '150px' }}>
              <span className="input-label">Acción</span>
              <select className="form-input" value={tempTvAction} onChange={(e) => setTempTvAction(e.target.value)} disabled={isClosed}>
                <option value="entrega">Entrega</option>
                <option value="recogida">Recogida</option>
                <option value="combinado">Entrega + Recogida</option>
              </select>
            </div>
            <button type="button" onClick={addTvToForm} className="btn btn-primary" style={{ width: 'auto', height: '45px' }} disabled={isClosed}>
              <Plus size={16} /> Añadir TV
            </button>
          </div>

          {/* Listado de TVs Añadidas */}
          {formTvs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {formTvs.map((tv, idx) => {
                const actionText = tv.action === 'entrega' ? 'Entrega' : tv.action === 'recogida' ? 'Recogida' : 'Entrega + Recogida';
                return (
                  <div key={tv.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--panel-border)', paddingBottom: '8px', marginBottom: '12px' }}>
                      <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--primary)' }}>
                        📺 TV {tv.inches}" ({actionText})
                      </span>
                      <button type="button" onClick={() => removeTvFromForm(tv.id)} className="btn btn-danger btn-small" style={{ display: 'flex', padding: '4px 8px', gap: '4px' }} disabled={isClosed}>
                        <Trash2 size={12} /> Quitar
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <span className="input-label">Puesta en Marcha (PM)</span>
                        <select className="form-input" value={tv.pmType} onChange={(e) => updateTvInForm(tv.id, 'pmType', e.target.value)} disabled={isClosed}>
                          <option value="none">No requiere</option>
                          <option value="basic">Puesta en Marcha Básica (3 Módulos)</option>
                          <option value="complex">Puesta en Marcha Compleja (5 Módulos)</option>
                        </select>
                      </div>

                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <span className="input-label">Retirada TV Vieja</span>
                        <select className="form-input" value={tv.recogidaViejaType} onChange={(e) => updateTvInForm(tv.id, 'recogidaViejaType', e.target.value)} disabled={isClosed}>
                          <option value="none">No requiere retirada</option>
                          <option value="urbantz">Retirada Vieja Urbantz</option>
                          <option value="no_urbantz">Retirada Vieja NO Urbantz</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '18px' }}>
                        <input 
                          type="checkbox" 
                          id={`cuelgue_${tv.id}`} 
                          checked={tv.cuelgue} 
                          onChange={(e) => updateTvInForm(tv.id, 'cuelgue', e.target.checked)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          disabled={isClosed}
                        />
                        <label htmlFor={`cuelgue_${tv.id}`} style={{ fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}>
                          Cuelgue en Pared (8 o 10 Mód.)
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '15px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--panel-border)', borderRadius: '10px', textAlign: 'center', fontSize: '0.9rem' }}>
              No has añadido ninguna televisión a este ticket todavía.
            </div>
          )}
        </div>

        {/* SECCIÓN B: PAQUETERÍA Y OTROS ARTÍCULOS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          
          <div className="block-section">
            <div className="block-title">📦 Bloque Paquetería (Cantidades)</div>
            {itemsPaqueteria.map(t => (
              <div key={t.id} className="task-item-row">
                <span className="task-item-label">{t.name}</span>
                <div className="qty-counter">
                  <button type="button" className="qty-btn" onClick={() => handleOtherQtyChange(t.id, -1)} disabled={isClosed}><Minus size={14} /></button>
                  <span className="qty-val">{otherQuantities[t.id] || 0}</span>
                  <button type="button" className="qty-btn" onClick={() => handleOtherQtyChange(t.id, 1)} disabled={isClosed}><Plus size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="block-section">
            <div className="block-title">🎙️ Otros Elementos (Cantidades)</div>
            {(() => {
              // Primero las barras de sonido juntas en orden: Barra de sonido, PM barra de sonido, Cuelgue barra de sonido
              const soundbarIds = ['BSND', 'PM_BSND', 'CUELGUE_BSND'];
              const soundbarItems = soundbarIds.map(id => itemsOtros.find(item => item.id === id)).filter(Boolean);
              const otherItems = itemsOtros.filter(item => !soundbarIds.includes(item.id));
              const sortedOtros = [...soundbarItems, ...otherItems];
              
              return sortedOtros.map(t => (
                <div key={t.id} className="task-item-row" style={{ borderBottom: t.id === 'CUELGUE_BSND' ? '2px dashed var(--panel-border)' : '1px solid rgba(255,255,255,0.05)', paddingBottom: t.id === 'CUELGUE_BSND' ? '12px' : '8px', marginBottom: t.id === 'CUELGUE_BSND' ? '12px' : '0px' }}>
                  <span className="task-item-label" style={{ fontWeight: soundbarIds.includes(t.id) ? '600' : 'normal' }}>{t.name}</span>
                  <div className="qty-counter">
                    <button type="button" className="qty-btn" onClick={() => handleOtherQtyChange(t.id, -1)} disabled={isClosed}><Minus size={14} /></button>
                    <span className="qty-val">{otherQuantities[t.id] || 0}</span>
                    <button type="button" className="qty-btn" onClick={() => handleOtherQtyChange(t.id, 1)} disabled={isClosed}><Plus size={14} /></button>
                  </div>
                </div>
              ));
            })()}
          </div>

        </div>

        {/* CAMPO DE NOTAS */}
        <div className="input-group">
          <span className="input-label">Notas / Observaciones del Reparto</span>
          <textarea className="form-input" placeholder="Escribe alguna nota relevante (opcional)..." value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" style={{ resize: 'vertical' }} disabled={isClosed} />
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '15px', opacity: isClosed ? 0.5 : 1, cursor: isClosed ? 'not-allowed' : 'pointer' }} disabled={isClosed}>
          {editingTicketId ? 'Guardar Cambios y Recalcular Ganancias' : 'Registrar Hoja de Reparto'}
        </button>
      </form>
    );
  };

  // --- RENDERIZADO DEL PORTAL DEL CHOFER (REPARTIDOR) ---
  const renderDriverPortal = () => {
    const userTickets = tickets.filter(t => t.furgoId === currentUser.id);

    return (
      <div>
        <div className="tab-container">
          <button className={`tab-btn ${activeTab === 'new_ticket' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('new_ticket'); }}>
            {editingTicketId ? '✏️ Editando...' : 'Nuevo Registro'}
          </button>
          <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            Historial del Día ({userTickets.filter(t => t.date === new Date().toISOString().split('T')[0]).length})
          </button>
        </div>

        {activeTab === 'new_ticket' && renderTicketForm()}


        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Gestión del Turno Diario */}
            <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--panel-border)', textAlign: 'left' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} /> Cierre y Control del Turno Diario
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '15px' }}>
                Selecciona una fecha para ver su estado, ver el resumen de actividades o finalizar tu turno de ese día.
              </p>
              
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="input-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                  <span className="input-label" style={{ margin: 0, fontWeight: '700' }}>Fecha:</span>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={shiftSummaryDate || new Date().toISOString().split('T')[0]} 
                    onChange={(e) => setShiftSummaryDate(e.target.value)} 
                    style={{ width: '160px', padding: '8px 12px' }}
                  />
                </div>
                
                {(() => {
                  const targetDate = shiftSummaryDate || new Date().toISOString().split('T')[0];
                  const isClosed = getShiftStatus(currentUser.id, targetDate) === 'closed';
                  const dayTickets = tickets.filter(t => t.furgoId === currentUser.id && t.date === targetDate);
                  
                  if (isClosed) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span className="badge badge-success" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>🔒 Turno Cerrado</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            setShiftSummaryDate(targetDate);
                            setShiftSummaryFurgoId(currentUser.id);
                            setShowShiftModal(true);
                          }} 
                          className="btn btn-secondary btn-small"
                          style={{ margin: 0, padding: '8px 14px' }}
                        >
                          Ver Resumen Guardado
                        </button>
                        {dayTickets.length > 0 && (
                          <button 
                            type="button" 
                            onClick={handleExportCircuit} 
                            className="btn btn-secondary btn-small"
                            style={{ margin: 0, padding: '8px 14px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'rgba(79, 70, 229, 0.05)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <FileSpreadsheet size={14} /> Exportar a Circuit
                          </button>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span className="badge badge-warning" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>🔓 Turno Abierto</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            if (dayTickets.length === 0) {
                              triggerAlert('No puedes cerrar un turno sin registrar entregas para ese día.', 'error');
                              return;
                            }
                            handleConfirmCloseShift(currentUser.id, targetDate);
                          }} 
                          className="btn btn-primary btn-small"
                          style={{ margin: 0, padding: '8px 14px', background: 'var(--warning)', color: '#000', fontWeight: '700' }}
                        >
                          Finalizar Turno
                        </button>
                        {dayTickets.length > 0 && (
                          <button 
                            type="button" 
                            onClick={handleExportCircuit} 
                            className="btn btn-secondary btn-small"
                            style={{ margin: 0, padding: '8px 14px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'rgba(79, 70, 229, 0.05)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <FileSpreadsheet size={14} /> Exportar a Circuit
                          </button>
                        )}
                      </div>
                    );
                  }
                })()}
              </div>
            </div>

            <div className="glass-panel" style={{ textAlign: 'left' }}>
              <h2>Historial Completo del Mes</h2>
              <p style={{ marginBottom: '15px' }}>Lista de todos los repartos introducidos por ti en este periodo mensual.</p>
              {userTickets.length === 0 ? (
                <div style={{ padding: '30px', color: 'var(--text-muted)', textAlign: 'center' }}>No has registrado entregas aún este mes.</div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Dirección</th>
                        <th>Notas</th>
                        <th>Artículos Transportados</th>
                        <th style={{ textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userTickets.map(t => {
                        const isClosed = getShiftStatus(t.furgoId, t.date) === 'closed';
                        return (
                          <tr key={t.id}>
                            <td style={{ fontWeight: '600' }}>
                              <div>{t.date}</div>
                              {t.routeName && <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '2.5px' }}>📍 {t.routeName}</div>}
                            </td>
                            <td style={{ fontWeight: '500' }}>
                              <div>{t.customerName}</div>
                              {t.phone && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>📞 {t.phone}</div>}
                            </td>
                             <td>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                 <span>{t.address}</span>
                                 <a 
                                   href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.address)}`} 
                                   target="_blank" 
                                   rel="noopener noreferrer" 
                                   title="Abrir en GPS"
                                   className="btn btn-secondary btn-small"
                                   style={{ display: 'inline-flex', padding: '4px', margin: 0, width: 'auto', borderRadius: '50%' }}
                                 >
                                   <MapPin size={14} color="var(--primary)" />
                                 </a>
                                </div>
                             </td>
                            <td style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>{t.notes || '-'}</td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {t.tasks.map((task, idx) => (
                                  <span key={idx} className="badge badge-primary">{task.name} (x{task.quantity})</span>
                                ))}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {isClosed ? (
                                <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>🔒 Turno Cerrado</span>
                              ) : (
                                <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                                  <button type="button" onClick={() => startEditing(t)} className="btn btn-secondary btn-small" title="Editar registro">
                                    <Edit size={14} />
                                  </button>
                                  <button type="button" onClick={() => handleDeleteTicket(t.id)} className="btn btn-danger btn-small" title="Eliminar registro">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- RENDERIZADO DEL PORTAL DE ADMINISTRADOR ---
  const renderAdminPortal = () => {
    const totalEarnings = tickets.reduce((sum, t) => sum + t.totalPrice, 0);
    const furgos = users.filter(u => u.role === 'repartidor').map(u => u.id);
    
    const furgoData = furgos.reduce((acc, fid) => {
      const fTickets = tickets.filter(t => t.furgoId === fid);
      acc[fid] = {
        count: fTickets.length,
        earnings: fTickets.reduce((sum, t) => sum + t.totalPrice, 0)
      };
      return acc;
    }, {});

    const maxEarnings = Math.max(...Object.values(furgoData).map(d => d.earnings), 1);

    // Contadores
    let totalTvs = 0;
    let totalPackages = 0;
    tickets.forEach(t => {
      t.tasks.forEach(task => {
        const tar = tariffs.find(x => x.id === task.tariffId);
        if (tar?.block === 'Televisores') totalTvs += task.quantity;
        if (tar?.block === 'Paquetería') totalPackages += task.quantity;
      });
    });

    return (
      <div>
        <div className="tab-container">
          <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('dashboard'); }}>Dashboard</button>
          <button className={`tab-btn ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>Repartos del Mes ({tickets.length})</button>
          {editingTicketId && (
            <button className={`tab-btn active`} onClick={() => setActiveTab('new_ticket')}>✏️ Editando...</button>
          )}
          <button className={`tab-btn ${activeTab === 'tariffs' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('tariffs'); }}>Ajustar Precios</button>
          <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('users'); }}>Furgonetas y Seguridad</button>
        </div>

        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="dashboard-grid">
              <div className="stat-card success">
                <p>Ganancias del Mes</p>
                <div className="stat-val">{totalEarnings.toFixed(2)} €</div>
              </div>
              <div className="stat-card info">
                <p>Total Clientes</p>
                <div className="stat-val">{tickets.length}</div>
              </div>
              <div className="stat-card warning">
                <p>Televisores Entregados</p>
                <div className="stat-val">{totalTvs}</div>
              </div>
              <div className="stat-card danger">
                <p>Paquetes PV / GV</p>
                <div className="stat-val">{totalPackages}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
              <div className="glass-panel" style={{ textAlign: 'left' }}>
                <h2>Ganancias Acumuladas por Furgoneta</h2>
                <div className="chart-bar-container">
                  {furgos.map(fid => {
                    const data = furgoData[fid];
                    const percent = (data.earnings / maxEarnings) * 80;
                    const uIdx = users.findIndex(u => u.id === fid);
                    const barColor = uIdx % 3 === 0 ? 'var(--primary)' : uIdx % 3 === 1 ? 'var(--warning)' : 'var(--success)';
                    return (
                      <div className="chart-bar-column" key={fid}>
                        <span className="chart-val-label">{data.earnings.toFixed(2)} €</span>
                        <div className="chart-bar" style={{ height: `${percent || 2}%`, backgroundColor: barColor }}></div>
                        <span className="chart-label">{(users.find(u => u.id === fid)?.label) || fid} ({data.count} cli.)</span>
                      </div>
                    );
                  })}
                </div>

                <div className="table-container" style={{ marginTop: '30px' }}>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Furgoneta</th>
                        <th style={{ textAlign: 'center' }}>Entregas</th>
                        <th style={{ textAlign: 'right' }}>Base Imponible</th>
                        <th style={{ textAlign: 'right' }}>IVA (+21%)</th>
                        <th style={{ textAlign: 'right' }}>Retención (-1%)</th>
                        <th style={{ textAlign: 'right' }}>Total Neto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {furgos.map(fid => {
                        const data = furgoData[fid] || { count: 0, earnings: 0 };
                        const base = data.earnings;
                        const iva = base * 0.21;
                        const retencion = base * 0.01;
                        const totalNeto = base + iva - retencion;
                        const label = users.find(u => u.id === fid)?.label || fid;
                        return (
                          <tr key={fid}>
                            <td style={{ fontWeight: '600' }}>{label}</td>
                            <td style={{ textAlign: 'center' }}>{data.count}</td>
                            <td style={{ textAlign: 'right', fontWeight: '500' }}>{base.toFixed(2)} €</td>
                            <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: '500' }}>+{iva.toFixed(2)} €</td>
                            <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: '500' }}>-{retencion.toFixed(2)} €</td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>{totalNeto.toFixed(2)} €</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="glass-panel" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <h2>Gestión de Cierre Mensual</h2>
                <p>Descarga el informe completo a un Excel detallado y limpia la base de datos para comenzar el nuevo mes sin registros anteriores.</p>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  <button onClick={handleExportExcel} className="btn btn-success" style={{ width: 'auto', flex: 1, minWidth: '200px' }}>
                    <FileSpreadsheet size={18} /> Exportar Excel Completo
                  </button>
                  <button onClick={handleResetMonth} className="btn btn-danger" style={{ width: 'auto', flex: 1, minWidth: '200px' }}>
                    <RefreshCw size={18} /> Reiniciar Periodo Mensual
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'new_ticket' && renderTicketForm()}

        {activeTab === 'tickets' && (
          <div className="glass-panel">
            <h2 style={{ textAlign: 'left' }}>Historial y Registro de Clientes</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div className="input-group">
                <span className="input-label">Furgoneta</span>
                <select className="form-input" value={ticketFilterFurgo} onChange={(e) => setTicketFilterFurgo(e.target.value)}>
                  <option value="all">Todas las Furgonetas</option>
                  {users.filter(u => u.role === 'repartidor').map(u => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <span className="input-label">Fecha</span>
                <input type="date" className="form-input" value={ticketFilterDate} onChange={(e) => setTicketFilterDate(e.target.value)} />
              </div>
              <div className="input-group">
                <span className="input-label">Buscador</span>
                <input type="text" className="form-input" placeholder="Buscar cliente, dirección, TV o nota..." value={ticketSearchQuery} onChange={(e) => setTicketSearchQuery(e.target.value)} />
              </div>
            </div>

            {getFilteredTickets().length === 0 ? (
              <div style={{ padding: '30px', color: 'var(--text-muted)' }}>No se encontraron registros.</div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Furgoneta</th>
                      <th>Cliente</th>
                      <th>Dirección</th>
                      <th>Notas</th>
                      <th>Conceptos Facturados</th>
                      <th>Precio Final</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredTickets().map(t => (
                      <tr key={t.id}>
                        <td>
                          <div>{t.date || ''}</div>
                          {t.routeName && <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '2.5px' }}>📍 {t.routeName}</div>}
                        </td>
                        <td>
                          {(() => {
                            const uIdx = users.findIndex(u => u.id === t.furgoId);
                            const badgeClass = uIdx % 3 === 0 ? 'badge-primary' : uIdx % 3 === 1 ? 'badge-warning' : 'badge-success';
                            return <span className={`badge ${badgeClass}`}>{t.furgoLabel || t.furgoId || ''}</span>;
                          })()}
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          <div>{t.customerName || ''}</div>
                          {t.phone && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>📞 {t.phone}</div>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <span>{t.address || ''}</span>
                             {t.address && (
                               <a 
                                 href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.address)}`} 
                                 target="_blank" 
                                 rel="noopener noreferrer" 
                                 title="Abrir en GPS"
                                 className="btn btn-secondary btn-small"
                                 style={{ display: 'inline-flex', padding: '4px', margin: 0, width: 'auto', borderRadius: '50%' }}
                               >
                                 <MapPin size={14} color="var(--primary)" />
                               </a>
                             )}
                          </div>
                        </td>
                        <td style={{ fontStyle: 'italic', fontSize: '0.85rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.notes}>{t.notes || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {t.tasks && t.tasks.map((task, idx) => (
                              <span key={idx} className="badge badge-secondary" style={{ border: '1px solid var(--panel-border)', fontSize: '0.7rem' }}>{(task && task.name) || ''} (x{(task && task.quantity) || 1})</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ fontWeight: '700', color: 'var(--success)' }}>{((t.totalPrice || 0)).toFixed(2)} €</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                            <button onClick={() => startEditing(t)} className="btn btn-secondary btn-small" title="Editar registro"><Edit size={14} /></button>
                            <button onClick={() => handleDeleteTicket(t.id)} className="btn btn-danger btn-small" title="Eliminar registro"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Control de Cierre de Turnos Diarios */}
            <div style={{ marginTop: '30px', borderTop: '1px solid var(--panel-border)', paddingTop: '20px', textAlign: 'left' }}>
              <h3>Turnos Diarios Cerrados (Repartidores)</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                Aquí se muestran los cierres de turno realizados por los choferes. Si un chofer se equivocó o necesita registrar algo más, puedes "Reabrir Turno".
              </p>
              
              {shifts.length === 0 ? (
                <div style={{ padding: '20px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--panel-border)', borderRadius: '8px', textAlign: 'center' }}>
                  No se ha registrado ningún cierre de turno todavía.
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Furgoneta</th>
                        <th>Hora de Cierre</th>
                        <th>Resumen de Entregas</th>
                        <th style={{ textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shifts.map(s => {
                        const furgoLabel = users.find(u => u.id === s.furgoId)?.label || s.furgoId;
                        return (
                          <tr key={s.id}>
                            <td style={{ fontWeight: '600' }}>
                              <div>{s.date}</div>
                              {s.routeName && <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '2.5px' }}>📍 {s.routeName}</div>}
                            </td>
                            <td>
                              {(() => {
                                const uIdx = users.findIndex(u => u.id === s.furgoId);
                                const badgeClass = uIdx % 3 === 0 ? 'badge-primary' : uIdx % 3 === 1 ? 'badge-warning' : 'badge-success';
                                return <span className={`badge ${badgeClass}`}>{furgoLabel}</span>;
                              })()}
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>{new Date(s.closedAt).toLocaleString()}</td>
                            <td style={{ fontSize: '0.85rem' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                <span>Cli: <strong>{s.summary ? s.summary.ticketsCount : 0}</strong></span> |
                                <span>TV: <strong>{s.summary ? s.summary.totalTvs : 0}</strong></span> |
                                <span>PV/GV: <strong>{s.summary ? s.summary.totalPV : 0}/{s.summary ? s.summary.totalGV : 0}</strong></span> |
                                <span>PM/Cuelgues: <strong>{s.summary ? s.summary.totalPM : 0}/{s.summary ? s.summary.totalCuelgues : 0}</strong></span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button 
                                onClick={() => {
                                  setShiftSummaryDate(s.date);
                                  setShiftSummaryFurgoId(s.furgoId);
                                  setShowShiftModal(true);
                                }} 
                                className="btn btn-primary btn-small"
                                style={{ margin: 0 }}
                              >
                                Ver Resumen
                              </button>
                              <button 
                                onClick={() => handleReopenShift(s.furgoId, s.date)} 
                                className="btn btn-secondary btn-small"
                                style={{ margin: 0, border: '1px solid var(--danger)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}
                              >
                                Reabrir Turno
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {activeTab === 'tariffs' && (
          <div className="glass-panel" style={{ textAlign: 'left' }}>
            <h2>Catálogo de Tarifas y Precios</h2>
            <p style={{ marginBottom: '20px' }}>Edita los valores del sistema o añade nuevos artículos. Al cambiarlos, todas las ganancias del mes se recalculan automáticamente.</p>
            
            <div className="settings-grid">
              <div>
                {['Paquetería', 'Televisores', 'Instalaciones', 'Otros'].map(block => {
                  const blockTariffs = tariffs.filter(t => t.block === block);
                  if (blockTariffs.length === 0) return null;
                  return (
                    <div key={block} style={{ marginBottom: '20px' }}>
                      <h3 style={{ color: 'var(--primary)', borderBottom: '1px solid var(--panel-border)', paddingBottom: '5px', textTransform: 'uppercase', fontSize: '0.9rem' }}>Bloque {block}</h3>
                      {blockTariffs.map(t => (
                        <div className="tariff-edit-card" key={t.id}>
                          <div>
                            <div style={{ fontWeight: '600' }}>{t.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.type === 'fixed' ? 'Precio Fijo' : `Multiplicador Módulo: ${t.value} módulos`}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input type="number" step="0.01" className="form-input" value={t.value} onChange={(e) => handleUpdateTariffValue(t.id, e.target.value)} style={{ width: '80px', padding: '5px', textAlign: 'right' }} />
                            <span>{t.type === 'fixed' ? '€' : 'mód.'}</span>
                            {t.id.startsWith('CUSTOM_') && (
                              <button 
                                type="button" 
                                onClick={() => handleDeleteTariff(t.id, t.name)}
                                className="btn btn-danger btn-small"
                                style={{ padding: '6px 8px', margin: 0, display: 'inline-flex', alignItems: 'center', width: 'auto' }}
                                title="Eliminar tarifa"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              <div>
                <div className="block-section" style={{ marginBottom: '20px' }}>
                  <div className="block-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={18} color="var(--primary)" /> Añadir Nueva Tarifa / Artículo
                  </div>
                  <form onSubmit={handleCreateTariff} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <span className="input-label">Nombre del Artículo / Servicio</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ej. Lavadora" 
                        value={newTariffName} 
                        onChange={(e) => setNewTariffName(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <span className="input-label">Bloque / Categoría</span>
                      <select 
                        className="form-input" 
                        value={newTariffBlock} 
                        onChange={(e) => setNewTariffBlock(e.target.value)}
                      >
                        <option value="Otros">Otros Elementos</option>
                        <option value="Paquetería">Paquetería</option>
                        <option value="Televisores">Televisores</option>
                        <option value="Instalaciones">Instalaciones</option>
                      </select>
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <span className="input-label">Tipo de Tarifa</span>
                      <select 
                        className="form-input" 
                        value={newTariffType} 
                        onChange={(e) => setNewTariffType(e.target.value)}
                      >
                        <option value="fixed">Precio Fijo (Euros)</option>
                        <option value="modules">Por Módulos (Multiplica precio del módulo)</option>
                      </select>
                    </div>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <span className="input-label">
                        {newTariffType === 'fixed' ? 'Valor en Euros (€)' : 'Cantidad de Módulos'}
                      </span>
                      <input 
                        type="number" 
                        step="0.01" 
                        className="form-input" 
                        placeholder={newTariffType === 'fixed' ? 'Ej. 25.00' : 'Ej. 3'} 
                        value={newTariffValue} 
                        onChange={(e) => setNewTariffValue(e.target.value)} 
                        required 
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '5px' }}>
                      <Plus size={16} /> Crear Tarifa
                    </button>
                  </form>
                </div>

                <div className="block-section" style={{ position: 'sticky', top: '20px' }}>
                  <div className="block-title">Valor Unitario del Módulo</div>
                  <input type="number" step="0.01" className="form-input" value={modulePrice} onChange={(e) => handleUpdateModulePrice(e.target.value)} style={{ fontWeight: '700', fontSize: '1.2rem', color: 'var(--primary)', textAlign: 'center' }} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>Actualmente, cada módulo equivale a {modulePrice.toFixed(2)} €.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="glass-panel" style={{ textAlign: 'left' }}>
            <h2>Configuración General y Furgonetas</h2>
            <p style={{ marginBottom: '20px' }}>Personaliza el nombre de tu aplicación y gestiona las cuentas de tus repartidores.</p>

            {/* Ajuste de Nombre de la Aplicación */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', marginBottom: '30px' }}>
              <div className="block-section" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div className="block-title">🏷️ Nombre Personalizado de la Aplicación</div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!appNameInput.trim()) {
                      triggerAlert('El nombre de la aplicación no puede estar vacío', 'error');
                      return;
                    }
                    saveAppName(appNameInput);
                    setAppName(appNameInput.trim());
                    triggerAlert('Nombre de la aplicación actualizado con éxito');
                  }} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '15px' }}>
                    <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
                      <span className="input-label">Nombre de tu App / Negocio</span>
                      <input type="text" className="form-input" value={appNameInput} onChange={(e) => setAppNameInput(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: 'auto', height: '45px' }}>Guardar</button>
                  </form>
                </div>
              </div>

              <div className="block-section" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)' }}>
                <div className="block-title">🎨 Personalización del Tema Visual</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Elige el estilo visual y fondo para la aplicación:</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
                  <button 
                    onClick={() => { setAppTheme('theme-emerald'); triggerAlert('Tema Esmeralda / Naturaleza seleccionado'); }}
                    className={`btn ${appTheme === 'theme-emerald' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px', fontSize: '0.8rem' }}
                  >
                    🌲 Esmeralda
                  </button>
                  <button 
                    onClick={() => { setAppTheme('theme-neon'); triggerAlert('Tema Neón Aurora seleccionado'); }}
                    className={`btn ${appTheme === 'theme-neon' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px', fontSize: '0.8rem' }}
                  >
                    🔮 Neón Aurora
                  </button>
                  <button 
                    onClick={() => { setAppTheme('theme-corporate' ); triggerAlert('Tema Corporativo Moderno seleccionado'); }}
                    className={`btn ${appTheme === 'theme-corporate' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px', fontSize: '0.8rem' }}
                  >
                    💼 Corporativo
                  </button>
                  <button 
                    onClick={() => { setAppTheme('theme-cyberpunk' ); triggerAlert('Tema Atardecer Cyberpunk seleccionado'); }}
                    className={`btn ${appTheme === 'theme-cyberpunk' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px', fontSize: '0.8rem' }}
                  >
                    🌇 Cyberpunk
                  </button>
                  <button 
                    onClick={() => { setAppTheme('theme-sakura' ); triggerAlert('Tema Sakura Rose seleccionado'); }}
                    className={`btn ${appTheme === 'theme-sakura' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px', fontSize: '0.8rem' }}
                  >
                    🌸 Sakura Rose
                  </button>
                  <button 
                    onClick={() => { setAppTheme('theme-arctic' ); triggerAlert('Tema Océano Ártico seleccionado'); }}
                    className={`btn ${appTheme === 'theme-arctic' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '8px', fontSize: '0.8rem' }}
                  >
                    ❄️ Ártico
                  </button>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
              {/* Crear nueva furgoneta */}
              <div className="block-section" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)' }}>
                <div className="block-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={18} color="var(--primary)" /> Añadir Nueva Furgoneta
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!newUsername.trim() || !newLabel.trim() || !newPassword.trim()) {
                    triggerAlert('Por favor rellena todos los campos', 'error');
                    return;
                  }
                  const res = addUser(newUsername, newLabel, newPassword, 'repartidor');
                  if (res.success) {
                    triggerAlert(`Usuario "${newLabel}" creado correctamente`);
                    setNewUsername('');
                    setNewLabel('');
                    setNewPassword('');
                    loadData();
                  } else {
                    triggerAlert(res.error, 'error');
                  }
                }} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                  <div className="input-group">
                    <span className="input-label">Usuario (para Login)</span>
                    <input type="text" className="form-input" placeholder="Ej. furgo4" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <span className="input-label">Nombre Visible / Furgoneta</span>
                    <input type="text" className="form-input" placeholder="Ej. Furgoneta 4" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <span className="input-label">Contraseña / PIN</span>
                    <input type="text" className="form-input" placeholder="Ej. 4444" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    <Plus size={16} /> Crear Nueva Furgoneta
                  </button>
                </form>
              </div>

              {/* Lista y edición */}
              <div className="block-section" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)' }}>
                <div className="block-title">Usuarios y Furgonetas Activas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                  {users.map(u => (
                    <div key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--primary)' }}>{u.label}</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span className="badge badge-primary">{u.role}</span>
                          {u.id !== 'admin' && u.id !== currentUser.id && (
                            <button 
                              type="button" 
                              onClick={() => {
                                if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${u.label}?`)) {
                                  deleteUser(u.id);
                                  triggerAlert('Usuario eliminado correctamente');
                                  loadData();
                                }
                              }} 
                              className="btn btn-danger btn-small" 
                              style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', margin: 0, width: 'auto' }}
                            >
                              <Trash2 size={12} /> Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Contraseña / PIN:</span>
                        <input 
                          type="text" 
                          className="form-input" 
                          defaultValue={u.password} 
                          onBlur={(e) => handleUpdateUserPassword(u.id, e.target.value)} 
                          style={{ padding: '4px 8px', flex: 1, fontSize: '0.85rem' }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!currentUser) {
    return (
      <>
        {alertMsg.text && (
          <div style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 1100,
            background: alertMsg.type === 'error' ? 'var(--danger)' : 'var(--success)',
            color: '#fff', padding: '10px 20px', borderRadius: '8px',
            fontWeight: '600', animation: 'fadeIn 0.3s ease', display: 'flex', gap: '8px'
          }}>
            <CheckCircle size={18} /> {alertMsg.text}
          </div>
        )}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          padding: '20px'
        }}>
          <form onSubmit={handleLogin} className="glass-panel login-form-panel" style={{ maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <TrendingUp size={40} color="var(--primary)" style={{ marginBottom: '10px', display: 'inline-block' }} />
              <h1 className="login-title" style={{ fontWeight: '800', letterSpacing: '-0.03em', margin: 0 }}>{appName}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px' }}>Inicia sesión para gestionar tus repartos y ganancias</p>
            </div>

            {loginError && (
              <div style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={16} /> {loginError}
              </div>
            )}

            <div className="input-group">
              <span className="input-label">Usuario</span>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ej. furgo1" 
                value={usernameInput} 
                onChange={(e) => setUsernameInput(e.target.value)} 
                required 
              />
            </div>

            <div className="input-group" style={{ position: 'relative' }}>
              <span className="input-label">Contraseña</span>
              <div style={{ position: 'relative', width: '100%' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="form-input" 
                  placeholder="••••" 
                  value={passwordInput} 
                  onChange={(e) => setPasswordInput(e.target.value)} 
                  required 
                  style={{ paddingRight: '45px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px'
                  }}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
              <Lock size={16} /> Iniciar Sesión
            </button>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      {alertMsg.text && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 1100,
          background: alertMsg.type === 'error' ? 'var(--danger)' : 'var(--success)',
          color: '#fff', padding: '10px 20px', borderRadius: '8px',
          fontWeight: '600', animation: 'fadeIn 0.3s ease', display: 'flex', gap: '8px'
        }}>
          <CheckCircle size={18} /> {alertMsg.text}
        </div>
      )}


      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <TrendingUp size={32} color="var(--primary)" />
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', background: 'none', webkitTextFillColor: 'var(--text-main)', letterSpacing: '-0.02em' }}>{appName}</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="user-badge"><User size={14} />{currentUser.label}</div>
          <button onClick={handleLogout} className="btn btn-secondary btn-small" style={{ width: 'auto', padding: '6px' }}><LogOut size={14} /></button>
        </div>
      </header>

      {currentUser.role === 'admin' ? renderAdminPortal() : renderDriverPortal()}

      {showShiftModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '450px', padding: '25px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '10px', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>Resumen Diario de Cierre</h3>
              <button onClick={() => setShowShiftModal(false)} className="btn btn-secondary btn-small" style={{ padding: '4px', width: 'auto' }}><X size={16} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.95rem' }}>
              {(() => {
                const targetFurgoId = shiftSummaryFurgoId || (currentUser ? currentUser.id : '');
                const targetDate = shiftSummaryDate || new Date().toISOString().split('T')[0];
                
                const furgoLabel = users.find(u => u.id === targetFurgoId)?.label || targetFurgoId;
                const existingShift = shifts.find(s => s.furgoId === targetFurgoId && s.date === targetDate);
                
                const rawSummary = existingShift ? existingShift.summary : getShiftSummary(targetFurgoId, targetDate);
                const summary = rawSummary || {
                  ticketsCount: 0,
                  totalTvs: 0,
                  totalPV: 0,
                  totalGV: 0,
                  totalPM: 0,
                  totalCuelgues: 0,
                  totalVieja: 0,
                  totalOtros: 0
                };
                
                const dayTickets = tickets.filter(t => t.furgoId === targetFurgoId && t.date === targetDate);
                const routeNameText = existingShift?.routeName || (dayTickets.length > 0 ? dayTickets[0].routeName : '');
                
                return (
                  <>
                    <div><strong>Furgoneta:</strong> {furgoLabel}</div>
                    <div><strong>Fecha:</strong> {targetDate}</div>
                    {routeNameText && <div><strong>Ruta:</strong> <span style={{ color: 'var(--primary)', fontWeight: '600' }}>📍 {routeNameText}</span></div>}
                    <div style={{ borderBottom: '1px dashed var(--panel-border)', margin: '5px 0' }}></div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                       <span>Clientes Atendidos:</span>
                       <strong style={{ color: 'var(--primary)' }}>{summary.ticketsCount}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                       <span>TVs Entregadas:</span>
                       <strong>{summary.totalTvs}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                       <span>Pequeño Volumen (PV):</span>
                       <strong>{summary.totalPV}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                       <span>Gran Volumen (GV):</span>
                       <strong>{summary.totalGV}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                       <span>Puestas en Marcha (PM):</span>
                       <strong>{summary.totalPM}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                       <span>Cuelgues en Pared:</span>
                       <strong>{summary.totalCuelgues}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                       <span>Retiradas de TV Vieja:</span>
                       <strong>{summary.totalVieja}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                       <span>Otros Accesorios:</span>
                       <strong>{summary.totalOtros}</strong>
                    </div>
                    
                    <div style={{ borderBottom: '1px dashed var(--panel-border)', margin: '10px 0' }}></div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '5px' }}>Clientes y Servicios Realizados:</div>
                    {dayTickets.length === 0 ? (
                      <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay repartos registrados.</div>
                    ) : (
                      <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {dayTickets.map((t, idx) => (
                          <div key={t.id} style={{ fontSize: '0.85rem', borderBottom: idx < dayTickets.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: idx < dayTickets.length - 1 ? '6px' : '0' }}>
                            <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{idx + 1}. {t.customerName}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', marginBottom: '4px' }}>
                              <MapPin size={11} /> {t.address}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                              {t.tasks && t.tasks.map((task, sIdx) => (
                                <span key={sIdx} className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '2px 6px', background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)', border: '1px solid rgba(79, 70, 229, 0.15)' }}>
                                  {task.name} (x{task.quantity})
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {existingShift && (
                      <div style={{ marginTop: '15px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px' }}>
                        🔒 Cierre realizado el: {new Date(existingShift.closedAt).toLocaleString()}
                      </div>
                    )}

                    {!existingShift && currentUser.role !== 'admin' && (
                      <div style={{ marginTop: '20px' }}>
                        <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '12px', lineHeight: '1.4', background: 'rgba(239, 68, 68, 0.05)', padding: '10px', borderRadius: '6px', border: '1px dashed var(--danger)' }}>
                          ⚠️ <strong>¡Atención!</strong> Al finalizar el turno se bloqueará el registro de entregas para esta fecha. No podrás editar ni añadir más repartos de este día.
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleConfirmCloseShift(targetFurgoId, targetDate)} 
                          className="btn btn-primary"
                          style={{ width: '100%', background: 'var(--success)', fontWeight: '700' }}
                        >
                          Confirmar Fin de Turno
                        </button>
                      </div>
                    )}

                    {currentUser.role === 'admin' && (
                      <button 
                        type="button" 
                        onClick={() => setShowShiftModal(false)} 
                        className="btn btn-secondary"
                        style={{ width: '100%', marginTop: '15px' }}
                      >
                        Cerrar Resumen
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
