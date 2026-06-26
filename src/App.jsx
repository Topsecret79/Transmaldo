import React, { useState, useEffect, useRef } from 'react';
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
  updateTicketStatus,
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
  deleteTariff,
  geocodeAddress,
  saveDriverLocation,
  getDriverLocations
} from './db';

initDB();

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const isAdminOrSuper = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
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

  // Rango de fechas para cortes de facturación del Administrador
  const getFirstDayOfMonth = () => {
    const date = new Date();
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-01`;
  };
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [adminStartDate, setAdminStartDate] = useState(getFirstDayOfMonth());
  const [adminEndDate, setAdminEndDate] = useState(getTodayDate());

  // Estado que controla si estamos editando
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editingFurgoId, setEditingFurgoId] = useState('');

  // Estados del Formulario
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [addressVerification, setAddressVerification] = useState({ status: 'idle', message: '' });
  const [lastVerifiedAddress, setLastVerifiedAddress] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const debounceTimerRef = useRef(null);
  const [ticketDate, setTicketDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [ticketRoute, setTicketRoute] = useState('');
  const [codAmount, setCodAmount] = useState('');

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
  const [newRole, setNewRole] = useState('repartidor');
  const [isTrackingActive, setIsTrackingActive] = useState(localStorage.getItem('delivery_tracking_active') === 'true');
  const watchIdRef = useRef(null);
  const [mapFilterDate, setMapFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [mapFilterFurgo, setMapFilterFurgo] = useState('all');
  const mapInstanceRef = useRef(null);

  // Derived state for role-based data partitioning (independent invoicing per administrator)
  const activeRepartidores = users.filter(u => {
    if (u.role !== 'repartidor') return false;
    if (!currentUser) return false;
    if (currentUser.role === 'superadmin') return true;
    if (currentUser.role === 'repartidor') return u.id === currentUser.id;
    // admin role
    return u.createdBy === currentUser.id;
  });

  const visibleUsers = users.filter(u => {
    if (!currentUser) return false;
    if (currentUser.role === 'superadmin') return true;
    // Admins only see the repartidores they created
    return u.role === 'repartidor' && u.createdBy === currentUser.id;
  });

  const visibleTickets = tickets.filter(t => {
    if (!currentUser) return false;
    if (currentUser.role === 'superadmin') return true;
    if (currentUser.role === 'repartidor') {
      return t.furgoId === currentUser.id;
    }
    // Admin role: see tickets of their own repartidores
    const allowedFurgoIds = activeRepartidores.map(r => r.id);
    return allowedFurgoIds.includes(t.furgoId);
  });

  const visibleShifts = shifts.filter(s => {
    if (!currentUser) return false;
    if (currentUser.role === 'superadmin') return true;
    if (currentUser.role === 'repartidor') {
      return s.furgoId === currentUser.id;
    }
    // Admin role: see shifts of their own repartidores
    const allowedFurgoIds = activeRepartidores.map(r => r.id);
    return allowedFurgoIds.includes(s.furgoId);
  });

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
      setActiveTab((parsed.role === 'admin' || parsed.role === 'superadmin') ? 'dashboard' : 'new_ticket');
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

  // Limpiar temporizador de autocompletado al desmontar componente
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Lógica de rastreo GPS en tiempo real para choferes
  useEffect(() => {
    if (isTrackingActive && currentUser && currentUser.role === 'repartidor') {
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            saveDriverLocation(currentUser.id, latitude, longitude);
          },
          (error) => {
            console.error("GPS Tracking Error:", error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      } else {
        console.error("Geolocation not supported by this browser.");
      }
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isTrackingActive, currentUser]);

  // Sincronizar ruta por defecto del ticket
  useEffect(() => {
    if (currentUser && !isAdminOrSuper) {
      const currentDbUser = users.find(u => u.id === currentUser.id);
      setTicketRoute(currentDbUser ? currentDbUser.label : currentUser.label);
    }
  }, [currentUser, ticketDate, users]);

  // Inicialización y actualización del Mapa Leaflet
  useEffect(() => {
    if (activeTab === 'map' && window.L && document.getElementById('admin-map')) {
      // 1. Destruir mapa previo si existe
      if (mapInstanceRef.current !== null) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // 2. Inicializar nuevo mapa (centrado en Madrid por defecto)
      const map = window.L.map('admin-map', {
        zoomControl: true,
        attributionControl: true
      }).setView([40.416775, -3.703790], 12);
      mapInstanceRef.current = map;

      // 3. Cargar capa de mapa oscuro (CartoDB Dark Matter)
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      // 4. Filtrar y ordenar los tickets geocodificados del periodo seleccionado
      const dayTickets = visibleTickets.filter(t => {
        if (t.date !== mapFilterDate) return false;
        if (mapFilterFurgo !== 'all' && t.furgoId !== mapFilterFurgo) return false;
        return t.lat && t.lng;
      });

      // Ordenar por hora de creación para visualizar la secuencia lógica
      const sortedDayTickets = [...dayTickets].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

      // Agrupar tickets por repartidor
      const ticketsByDriver = {};
      sortedDayTickets.forEach(t => {
        if (!ticketsByDriver[t.furgoId]) ticketsByDriver[t.furgoId] = [];
        ticketsByDriver[t.furgoId].push(t);
      });

      const bounds = [];
      const COLORS = ['#a78bfa', '#38bdf8', '#34d399', '#f472b6', '#fbbf24', '#f43f5e'];

      // 5. Dibujar marcadores de paradas y líneas de ruta (polilíneas)
      Object.keys(ticketsByDriver).forEach((fid, idx) => {
        const driverTickets = ticketsByDriver[fid];
        const driverColor = COLORS[idx % COLORS.length];
        const furgoLabel = users.find(u => u.id === fid)?.label || fid;

        driverTickets.forEach((t, seqIndex) => {
          const latLng = [t.lat, t.lng];
          bounds.push(latLng);

          const isSuccess = t.status === 'success' || !t.status;
          const isFailed = t.status === 'failed';
          const statusColor = isSuccess ? '#10b981' : isFailed ? '#ef4444' : '#fbbf24';

          const markerHtml = `
            <div style="
              width: 24px; 
              height: 24px; 
              border-radius: 50%; 
              background-color: ${statusColor}; 
              color: #000; 
              font-weight: 800; 
              font-size: 11px; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              border: 2px solid #fff;
              box-shadow: 0 0 10px rgba(0,0,0,0.5);
            ">
              ${seqIndex + 1}
            </div>
          `;

          const markerIcon = window.L.divIcon({
            html: markerHtml,
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          const popupContent = `
            <div style="font-family: 'Inter', sans-serif; font-size: 0.85rem; color: #fff; padding: 4px;">
              <strong style="color: #a78bfa; font-size: 0.95rem;">${t.customerName}</strong>
              <div style="margin-top: 5px;">📍 <strong>Parada #${seqIndex + 1}</strong></div>
              <div style="margin-top: 2px;">🚚 Chofer: <strong>${furgoLabel}</strong></div>
              <div style="margin-top: 2px;">🏠 Dir: ${t.address}</div>
              <div style="margin-top: 5px; font-weight: 700; color: ${statusColor};">
                Estado: ${t.status === 'success' ? '🟢 Éxito' : t.status === 'failed' ? `🔴 Fallido (${t.failureReason || 'Sin motivo'})` : '🟡 Pendiente'}
              </div>
              ${t.completedLat ? `
                <div style="margin-top: 6px; font-size: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px; color: #9ca3af;">
                  🎯 Completado en GPS: ${t.completedLat.toFixed(5)}, ${t.completedLng.toFixed(5)}
                </div>
              ` : ''}
            </div>
          `;

          window.L.marker(latLng, { icon: markerIcon })
            .addTo(map)
            .bindPopup(popupContent, { maxWidth: 220 });
        });

        // Trazar línea de ruta conectando las paradas en orden
        if (driverTickets.length > 1) {
          const routeCoords = driverTickets.map(t => [t.lat, t.lng]);
          window.L.polyline(routeCoords, {
            color: driverColor,
            weight: 3,
            opacity: 0.75,
            dashArray: '8, 8'
          }).addTo(map);
        }
      });

      // 6. Dibujar repartidores en tiempo real (si reportaron en las últimas 6 horas)
      const liveLocations = getDriverLocations();
      Object.entries(liveLocations).forEach(([fid, loc]) => {
        if (mapFilterFurgo !== 'all' && fid !== mapFilterFurgo) return;
        if (!activeRepartidores.map(r => r.id).includes(fid)) return;

        const timeDiff = Date.now() - new Date(loc.updatedAt).getTime();
        if (timeDiff > 6 * 60 * 60 * 1000) return; // Filtro de inactividad de 6 horas

        const latLng = [loc.lat, loc.lng];
        bounds.push(latLng);
        const furgoLabel = users.find(u => u.id === fid)?.label || fid;

        const liveHtml = `
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(139, 92, 246, 0.2);
            border: 2px solid #a78bfa;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 15px #a78bfa;
            animation: gpsPulse 2s infinite ease-in-out;
            font-size: 16px;
          ">
            🚚
          </div>
        `;

        const liveIcon = window.L.divIcon({
          html: liveHtml,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const popupContent = `
          <div style="font-family: 'Inter', sans-serif; font-size: 0.85rem; color: #fff; padding: 4px;">
            <strong style="color: #a78bfa; font-size: 0.95rem;">🚚 ${furgoLabel} (En Vivo)</strong>
            <div style="margin-top: 5px;">Última señal: <strong>${new Date(loc.updatedAt).toLocaleTimeString()}</strong></div>
            <div style="margin-top: 2px; font-size: 0.75rem; color: #9ca3af;">GPS: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</div>
          </div>
        `;

        window.L.marker(latLng, { icon: liveIcon })
          .addTo(map)
          .bindPopup(popupContent);
      });

      // 7. Auto-ajustar el zoom del mapa para mostrar todos los puntos
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }

    return () => {
      if (mapInstanceRef.current !== null) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [activeTab, mapFilterDate, mapFilterFurgo, tickets, users]);



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
      setActiveTab((foundUser.role === 'admin' || foundUser.role === 'superadmin') ? 'dashboard' : 'new_ticket');
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

  // Buscar sugerencias de direcciones usando Nominatim (OSM)
  const fetchAddressSuggestions = async (queryText) => {
    if (!queryText.trim() || queryText.trim().length < 4) {
      setSuggestions([]);
      return;
    }
    setIsSearchingSuggestions(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(queryText)}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data || []);
      }
    } catch (err) {
      console.error("Error fetching address suggestions:", err);
    } finally {
      setIsSearchingSuggestions(false);
    }
  };

  // Seleccionar una dirección sugerida
  const handleSelectSuggestion = (sug) => {
    const lat = parseFloat(sug.lat);
    const lng = parseFloat(sug.lon);
    setAddress(sug.display_name);
    setAddressVerification({
      status: 'success',
      message: `🟢 Dirección verificada correctamente (GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      coords: { lat, lng }
    });
    setLastVerifiedAddress(sug.display_name);
    setSuggestions([]);
  };

  // Verificar validez de la dirección por geocodificación
  const handleVerifyAddress = async () => {
    const trimmed = address.trim();
    if (!trimmed) {
      setAddressVerification({ status: 'idle', message: '' });
      setLastVerifiedAddress('');
      return;
    }
    // Evitar llamadas duplicadas o innecesarias
    if (addressVerification.status === 'verifying') return;
    if (addressVerification.status === 'success' && trimmed === lastVerifiedAddress) return;

    setAddressVerification({ status: 'verifying', message: '🛰️ Verificando dirección en el mapa...' });
    try {
      const coords = await geocodeAddress(trimmed);
      if (coords) {
        setAddressVerification({ 
          status: 'success', 
          message: `🟢 Dirección verificada correctamente (GPS: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`,
          coords
        });
        setLastVerifiedAddress(trimmed);
      } else {
        setAddressVerification({ 
          status: 'error', 
          message: '🔴 Dirección no localizada. Revisa la ortografía o añade la ciudad (ej: Calle Mayor 10, Madrid).' 
        });
        setLastVerifiedAddress('');
      }
    } catch (err) {
      setAddressVerification({ 
        status: 'error', 
        message: '🔴 Error al conectar con el servicio de verificación de mapas.' 
      });
      setLastVerifiedAddress('');
    }
  };

  // Procesar envío del formulario (Nuevo o Edición)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || !address.trim()) {
      triggerAlert('Por favor, rellena el cliente y dirección', 'error');
      return;
    }

    const checkFurgoId = editingTicketId ? editingFurgoId : currentUser.id;
    const isClosed = getShiftStatus(checkFurgoId, ticketDate) === 'closed';
    if (isClosed && !isAdminOrSuper) {
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
      codAmount: parseFloat(codAmount) || 0,
      tasks: tasksArray
    };

    // Intentar obtener las coordenadas desde la verificación previa, o geocodificar en el momento
    let coords = null;
    if (addressVerification.status === 'success' && addressVerification.coords) {
      coords = addressVerification.coords;
    } else {
      try {
        coords = await geocodeAddress(address.trim());
      } catch (err) {
        console.error("Error geocodificando la dirección:", err);
      }
    }

    if (coords) {
      ticketData.lat = coords.lat;
      ticketData.lng = coords.lng;
    }

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
      setAddressVerification({ status: 'idle', message: '' });
      setLastVerifiedAddress('');
      setFormTvs([]);
      setOtherQuantities({});
      setNotes('');
      setCodAmount('');
      setTicketDate(new Date().toISOString().split('T')[0]);
      loadData();
    }
  };

  // Iniciar la edición de un ticket y reconstruir los estados desde el listado de tareas del ticket
  const startEditing = (ticket) => {
    const isClosed = getShiftStatus(ticket.furgoId, ticket.date) === 'closed';
    if (isClosed && !isAdminOrSuper) {
      triggerAlert('El turno para la fecha de este reparto está cerrado. No puedes editarlo.', 'error');
      return;
    }

    setEditingTicketId(ticket.id);
    setEditingFurgoId(ticket.furgoId);
    setCustomerName(ticket.customerName);
    setPhone(ticket.phone || '');
    setAddress(ticket.address);
    setAddressVerification(ticket.lat ? { 
      status: 'success', 
      message: '🟢 Dirección verificada en el mapa',
      coords: { lat: ticket.lat, lng: ticket.lng }
    } : { status: 'idle', message: '' });
    setLastVerifiedAddress(ticket.lat ? ticket.address : '');
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
    setCodAmount(ticket.codAmount ? ticket.codAmount.toString() : '');
    setActiveTab('new_ticket');
  };

  const cancelEditing = () => {
    setEditingTicketId(null);
    setEditingFurgoId('');
    setCustomerName('');
    setPhone('');
    setAddress('');
    setAddressVerification({ status: 'idle', message: '' });
    setLastVerifiedAddress('');
    setFormTvs([]);
    setOtherQuantities({});
    setNotes('');
    setCodAmount('');
    setTicketRoute(currentUser ? currentUser.label : '');
    setTicketDate(new Date().toISOString().split('T')[0]);
    setActiveTab(isAdminOrSuper ? 'tickets' : 'history');
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
    const dayTickets = tickets.filter(t => t.furgoId === furgoId && t.date === date && (t.status === 'success' || !t.status));
    
    let totalTvs = 0;
    let totalPV = 0;
    let totalGV = 0;
    let totalPM = 0;
    let totalCuelgues = 0;
    let totalVieja = 0;
    let totalOtros = 0;
    let totalCODAmount = 0;
    
    dayTickets.forEach(t => {
      totalCODAmount += t.codAmount || 0;
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
      totalOtros,
      totalCODAmount
    };
  };

  const handleConfirmCloseShift = (furgoId, date) => {
    const dayTickets = tickets.filter(t => t.furgoId === furgoId && t.date === date);
    const pendingTickets = dayTickets.filter(t => t.status === 'pending' || !t.status);
    
    let confirmMsg = `¿Estás seguro de que deseas finalizar tu turno del día ${date}? Una vez cerrado, no podrás agregar ni editar más repartos.`;
    
    if (pendingTickets.length > 0) {
      confirmMsg = `⚠️ Tienes ${pendingTickets.length} parada(s) PENDIENTE(S) de realizar. Si cierras el turno ahora, estas paradas NO se sumarán a tu facturación diaria (se calculan como 0 €).\n\n¿Estás seguro de que deseas finalizar tu turno de todas formas?`;
    }

    if (window.confirm(confirmMsg)) {
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
    if (isClosed && !isAdminOrSuper) {
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

  const handleUpdateTicketStatus = (id, status) => {
    let failureReason = '';
    if (status === 'failed') {
      const reason = window.prompt("Introduce el motivo del fallo (ej. Cliente ausente, Dirección incorrecta, Rechazado):");
      if (reason === null) return; // User cancelled
      failureReason = reason.trim() || 'No especificado';
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          updateTicketStatus(id, status, failureReason, latitude, longitude);
          loadData();
          triggerAlert(`Reparto marcado como: ${status === 'success' ? 'Éxito' : status === 'failed' ? 'Fallido' : 'Pendiente'} (GPS registrado)`);
        },
        (error) => {
          console.warn("GPS Location capture failed:", error);
          updateTicketStatus(id, status, failureReason);
          loadData();
          triggerAlert(`Reparto marcado como: ${status === 'success' ? 'Éxito' : status === 'failed' ? 'Fallido' : 'Pendiente'}`);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      updateTicketStatus(id, status, failureReason);
      loadData();
      triggerAlert(`Reparto marcado como: ${status === 'success' ? 'Éxito' : status === 'failed' ? 'Fallido' : 'Pendiente'}`);
    }
  };

  // Exportar Excel del Periodo seleccionado
  const handleExportExcel = async () => {
    const filteredTickets = visibleTickets.filter(t => {
      if (adminStartDate && t.date < adminStartDate) return false;
      if (adminEndDate && t.date > adminEndDate) return false;
      return true;
    });

    if (filteredTickets.length === 0) {
      triggerAlert('No hay registros para exportar en este periodo', 'error');
      return;
    }

    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Resumen General (Solo suma ganancias de repartos con Éxito)
    const successTickets = filteredTickets.filter(t => t.status === 'success' || !t.status);
    const totalEarnings = successTickets.reduce((sum, t) => sum + t.totalPrice, 0);
    const furgos = activeRepartidores.map(u => u.id);
    const totalIVA = totalEarnings * 0.21;
    const totalRetencion = totalEarnings * 0.01;
    const totalNet = totalEarnings + totalIVA - totalRetencion;
    const totalCOD = successTickets.reduce((sum, t) => sum + (t.codAmount || 0), 0);

    const summaryData = [
      [`CONTROL DE FACTURACIÓN DE REPARTOS (Periodo: ${adminStartDate || 'inicio'} a ${adminEndDate || 'hoy'})`],
      [],
      ['Facturación Total Acumulada (Base Imponible)', `${totalEarnings.toFixed(2)} €`],
      ['IVA Acumulado (+21%)', `${totalIVA.toFixed(2)} €`],
      ['Retención Acumulada (-1%)', `${totalRetencion.toFixed(2)} €`],
      ['Total Neto Facturado', `${totalNet.toFixed(2)} €`],
      ['Total Paradas Planificadas', filteredTickets.length],
      ['Total Entregas con Éxito (Facturadas)', successTickets.length],
      ['Total Reembolsos Cobrados', `${totalCOD.toFixed(2)} €`],
      [],
      ['Furgoneta', 'Paradas Planificadas', 'Entregas Éxito', 'Base Imponible (€)', 'IVA 21% (€)', 'Retención 1% (€)', 'Total Neto (€)', 'Reembolsos Cobrados (€)'],
    ];

    furgos.forEach(fid => {
      const fTickets = filteredTickets.filter(t => t.furgoId === fid);
      const fSuccess = fTickets.filter(t => t.status === 'success' || !t.status);
      const label = users.find(u => u.id === fid)?.label || fid;
      const earnings = fSuccess.reduce((sum, t) => sum + t.totalPrice, 0);
      const iva = earnings * 0.21;
      const ret = earnings * 0.01;
      const net = earnings + iva - ret;
      const fCod = fSuccess.reduce((sum, t) => sum + (t.codAmount || 0), 0);
      summaryData.push([
        label, 
        fTickets.length, 
        fSuccess.length,
        `${earnings.toFixed(2)} €`,
        `${iva.toFixed(2)} €`,
        `-${ret.toFixed(2)} €`,
        `${net.toFixed(2)} €`,
        `${fCod.toFixed(2)} €`
      ]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen General');

    // Hojas por furgoneta (Desglosando CADA artículo en una fila diferente para el control exacto)
    furgos.forEach(fid => {
      const fTickets = filteredTickets.filter(t => t.furgoId === fid).sort((a,b) => a.date.localeCompare(b.date));
      const label = users.find(u => u.id === fid)?.label || fid;

      const sheetHeaders = ['Fecha', 'Ruta', 'Cliente', 'Teléfono', 'Dirección', 'Cobro Reembolso (€)', 'Artículo / Tarea', 'Cantidad', 'Tarifa Unitaria (€)', 'Subtotal (€)', 'Estado', 'Notas / Observaciones'];
      const sheetRows = [];

      fTickets.forEach(t => {
        const isSuccess = t.status === 'success' || !t.status;
        const statusLabel = t.status === 'success' || !t.status 
          ? 'Éxito' 
          : t.status === 'failed' 
            ? `Fallido${t.failureReason ? ` (${t.failureReason})` : ''}` 
            : 'Pendiente';
        t.tasks.forEach(task => {
          sheetRows.push([
            t.date,
            t.routeName || '',
            t.customerName,
            t.phone || '',
            t.address,
            t.codAmount || 0,
            task.name,
            task.quantity,
            task.unitPrice,
            isSuccess ? task.subtotal : 0, // Fallido se calcula como 0 €
            statusLabel,
            t.notes || ''
          ]);
        });
      });

      const wsFurgo = XLSX.utils.aoa_to_sheet([sheetHeaders, ...sheetRows]);
      XLSX.utils.book_append_sheet(wb, wsFurgo, label);
    });

    const filename = `Facturacion_${adminStartDate || 'inicio'}_a_${adminEndDate || 'hoy'}.xlsx`;
    XLSX.writeFile(wb, filename);
    const localPath = await saveExcelToDisk(wb, filename);
    if (localPath) {
      triggerAlert(`Archivo guardado en carpeta 'exports' del proyecto`);
    } else {
      triggerAlert('Excel desglosado generado');
    }
  };

  const getFilteredTickets = () => {
    return visibleTickets.filter(t => {
      if (currentUser && isAdminOrSuper) {
        if (adminStartDate && t.date < adminStartDate) return false;
        if (adminEndDate && t.date > adminEndDate) return false;
      }
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
    const isClosed = getShiftStatus(activeCheckFurgo, ticketDate) === 'closed' && !isAdminOrSuper;

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
          {editingTicketId && isAdminOrSuper && (
            <div className="input-group">
              <span className="input-label">Furgoneta asignada</span>
              <select className="form-input" value={editingFurgoId} onChange={(e) => setEditingFurgoId(e.target.value)} required disabled={isClosed}>
                {activeRepartidores.map(u => (
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

            {!isAdminOrSuper && (
              <div className="input-group" style={{ marginBottom: 0 }}>
                <span className="input-label">Adjudicar a la Ruta / Furgoneta de</span>
                <select 
                  className="form-input" 
                  value={ticketRoute} 
                  onChange={(e) => setTicketRoute(e.target.value)} 
                  disabled={isClosed}
                  required
                >
                  {activeRepartidores.map(u => (
                    <option key={u.id} value={u.label}>{u.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
            <div className="input-group">
              <span className="input-label">Cliente</span>
              <input type="text" className="form-input" placeholder="Ej. Jaime Rodríguez" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required disabled={isClosed} />
            </div>
            <div className="input-group">
              <span className="input-label">Teléfono</span>
              <input type="tel" className="form-input" placeholder="Ej. 612345678" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isClosed} />
            </div>
             <div className="input-group" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="input-label">Dirección</span>
                {address.trim() && (
                  <button 
                    type="button" 
                    onClick={handleVerifyAddress}
                    className="btn btn-secondary btn-small"
                    style={{ width: 'auto', margin: 0, padding: '2px 8px', fontSize: '0.7rem', height: '20px', display: 'flex', alignItems: 'center', gap: '3px' }}
                    disabled={isClosed}
                  >
                    🔍 Verificar
                  </button>
                )}
              </div>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Dirección de entrega" 
                value={address} 
                onChange={(e) => {
                  const val = e.target.value;
                  setAddress(val);
                  setAddressVerification({ status: 'idle', message: '' });
                  
                  // Limpiar timer de autocompletado
                  if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                  }
                  
                  if (val.trim().length >= 4) {
                    debounceTimerRef.current = setTimeout(() => {
                      fetchAddressSuggestions(val);
                    }, 400);
                  } else {
                    setSuggestions([]);
                  }
                }} 
                onBlur={() => {
                  // Retraso para que el clic en sugerencia se registre antes de cerrar la lista
                  setTimeout(() => {
                    setSuggestions([]);
                    if (address.trim() && addressVerification.status === 'idle') {
                      handleVerifyAddress();
                    }
                  }, 250);
                }}
                required 
                disabled={isClosed} 
                style={{
                  borderColor: addressVerification.status === 'success' 
                    ? '#34d399' 
                    : addressVerification.status === 'error' 
                      ? '#f87171' 
                      : addressVerification.status === 'verifying' 
                        ? '#c084fc' 
                        : 'var(--input-border)',
                  boxShadow: addressVerification.status === 'success' 
                    ? '0 0 0 3px rgba(52, 211, 153, 0.2)' 
                    : addressVerification.status === 'error' 
                      ? '0 0 0 3px rgba(248, 113, 113, 0.2)' 
                      : addressVerification.status === 'verifying' 
                        ? '0 0 0 3px rgba(192, 132, 252, 0.2)' 
                        : 'none'
                }}
              />
              
              {/* SUGERENCIAS DE DIRECCIÓN */}
              {isSearchingSuggestions && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 999,
                  background: 'rgba(20, 16, 38, 0.98)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  color: '#e9d5ff',
                  marginTop: '4px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid rgba(255,255,255,0.1)',
                    borderTopColor: '#c084fc',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }}></div>
                  <span>Buscando sugerencias...</span>
                </div>
              )}

              {!isSearchingSuggestions && suggestions.length > 0 && (
                <ul style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 999,
                  background: 'rgba(20, 16, 38, 0.98)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '4px 0',
                  margin: '4px 0 0 0',
                  listStyle: 'none',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.6)'
                }}>
                  {suggestions.map((sug, index) => (
                    <li 
                      key={index}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Evita perder foco
                        handleSelectSuggestion(sug);
                      }}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        color: '#ffffff',
                        borderBottom: index < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        transition: 'background 0.2s',
                        lineHeight: '1.4',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.35)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      📍 {sug.display_name}
                    </li>
                  ))}
                </ul>
              )}

              {addressVerification.message && (
                <div style={{ 
                  fontSize: '0.78rem', 
                  marginTop: '6px', 
                  color: addressVerification.status === 'success' ? '#34d399' : addressVerification.status === 'verifying' ? '#a78bfa' : '#f87171',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {addressVerification.message}
                </div>
              )}
            </div>
            <div className="input-group">
              <span className="input-label">Importe a Cobrar / Reembolso (€)</span>
              <input type="number" step="0.01" min="0" className="form-input" placeholder="Ej. 150.00 (0 si no requiere)" value={codAmount} onChange={(e) => setCodAmount(e.target.value)} disabled={isClosed} />
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
    const targetDate = shiftSummaryDate || new Date().toISOString().split('T')[0];
    const dateTickets = userTickets.filter(t => t.date === targetDate);

    return (
      <div>
        <div className="tab-container">
          <button className={`tab-btn ${activeTab === 'new_ticket' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('new_ticket'); }}>
            {editingTicketId ? '✏️ Editando Parada' : '📋 Planificar Ruta'}
          </button>
          <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            🚚 Mi Ruta ({dateTickets.length})
          </button>
        </div>

        {/* Control de Geolocalización / Compartir Ubicación */}
        <div className="glass-panel" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px 20px', 
          borderRadius: '12px', 
          marginBottom: '20px', 
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--panel-border)',
          textAlign: 'left'
        }}>
          <style>{`
            @keyframes gpsPulse {
              0% { transform: scale(0.9); opacity: 0.6; }
              50% { transform: scale(1.1); opacity: 1; }
              100% { transform: scale(0.9); opacity: 0.6; }
            }
          `}</style>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              display: 'inline-block', 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: isTrackingActive ? 'var(--success)' : 'var(--text-muted)',
              boxShadow: isTrackingActive ? '0 0 10px var(--success)' : 'none',
              animation: isTrackingActive ? 'gpsPulse 2s infinite ease-in-out' : 'none'
            }}></span>
            <div>
              <span style={{ fontWeight: '700', fontSize: '0.9rem', color: isTrackingActive ? 'var(--success)' : 'var(--text)' }}>
                {isTrackingActive ? '🛰️ Compartiendo GPS en Vivo' : '🛰️ GPS Inactivo'}
              </span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isTrackingActive ? 'Tu posición se actualiza automáticamente con la oficina' : 'Habilita para compartir tu avance en tiempo real'}
              </div>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => {
              const newVal = !isTrackingActive;
              setIsTrackingActive(newVal);
              localStorage.setItem('delivery_tracking_active', newVal ? 'true' : 'false');
              triggerAlert(newVal ? 'Se ha activado el rastreo de ubicación' : 'Rastreo desactivado');
            }} 
            className={`btn btn-small ${isTrackingActive ? 'btn-danger' : 'btn-primary'}`}
            style={{ width: 'auto', margin: 0, padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {isTrackingActive ? 'Detener Compartir' : 'Compartir GPS'}
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
                    value={targetDate} 
                    onChange={(e) => setShiftSummaryDate(e.target.value)} 
                    style={{ width: '160px', padding: '8px 12px' }}
                  />
                </div>
                
                {(() => {
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
              <h2>Planificación y Seguimiento de Ruta ({targetDate})</h2>
              <p style={{ marginBottom: '15px' }}>Gestiona las paradas planificadas de tu jornada. Marca cada una como "Éxito" o "Fallido" según se complete el servicio.</p>
              {dateTickets.length === 0 ? (
                <div style={{ padding: '30px', color: 'var(--text-muted)', textAlign: 'center' }}>No hay paradas planificadas para este día.</div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente / Contacto</th>
                        <th>Dirección / Ruta</th>
                        <th>Servicios a Realizar</th>
                        <th>Estado del Servicio</th>
                        <th style={{ textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dateTickets.map(t => {
                        const isClosed = getShiftStatus(t.furgoId, t.date) === 'closed';
                        return (
                          <tr key={t.id}>
                            <td style={{ fontWeight: '500' }}>
                              <div>{t.customerName}</div>
                              {t.phone && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>📞 {t.phone}</div>}
                              {t.notes && <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '4px' }}>📝 {t.notes}</div>}
                              {t.codAmount > 0 && (
                                <div style={{
                                  marginTop: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: t.status === 'success' ? 'var(--success-light)' : t.status === 'failed' ? 'var(--danger-light)' : 'var(--warning-light)',
                                  color: t.status === 'success' ? 'var(--success)' : t.status === 'failed' ? 'var(--danger)' : 'var(--warning)',
                                  border: '1px solid ' + (t.status === 'success' ? 'rgba(16, 185, 129, 0.2)' : t.status === 'failed' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)'),
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: '600'
                                }}>
                                  💵 {t.status === 'success' ? 'Cobrado: ' : t.status === 'failed' ? 'No cobrado: ' : 'Cobrar: '} {t.codAmount.toFixed(2)} €
                                </div>
                              )}
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
                              {t.routeName && <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '4px' }}>📍 Ruta: {t.routeName}</div>}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {t.tasks.map((task, idx) => (
                                  <span key={idx} className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                                    {task.name} (x{task.quantity})
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td>
                              {isClosed ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {t.status === 'success' || !t.status ? (
                                    <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>🟢 Éxito</span>
                                  ) : t.status === 'failed' ? (
                                    <span className="badge badge-danger" style={{ fontSize: '0.75rem' }} title={t.failureReason}>🔴 Fallido {t.failureReason ? `(${t.failureReason})` : ''}</span>
                                  ) : (
                                    <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>🟡 Pendiente</span>
                                  )}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div style={{ display: 'flex', gap: '5px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateTicketStatus(t.id, 'success')}
                                      style={{
                                        padding: '5px 8px',
                                        borderRadius: '6px',
                                        border: '1px solid ' + (t.status === 'success' ? 'var(--success)' : 'rgba(74, 222, 128, 0.2)'),
                                        background: t.status === 'success' ? 'rgba(74, 222, 128, 0.2)' : 'transparent',
                                        color: t.status === 'success' ? '#4ade80' : 'var(--text-muted)',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        transition: 'all 0.2s ease',
                                      }}
                                    >
                                      Éxito
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateTicketStatus(t.id, 'failed')}
                                      style={{
                                        padding: '5px 8px',
                                        borderRadius: '6px',
                                        border: '1px solid ' + (t.status === 'failed' ? 'var(--danger)' : 'rgba(248, 113, 113, 0.2)'),
                                        background: t.status === 'failed' ? 'rgba(248, 113, 113, 0.2)' : 'transparent',
                                        color: t.status === 'failed' ? '#f87171' : 'var(--text-muted)',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        transition: 'all 0.2s ease',
                                      }}
                                    >
                                      Fallido
                                    </button>
                                  </div>
                                  {(!t.status || t.status === 'pending') && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: '500' }}>🟡 Pendiente de servicio</span>
                                  )}
                                  {(t.status === 'success') && (
                                    <span style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: '500' }}>🟢 Completado con éxito</span>
                                  )}
                                  {t.status === 'failed' && (
                                    <span style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: '500' }}>🔴 Intento fallido {t.failureReason ? `(${t.failureReason})` : ''}</span>
                                  )}
                                </div>
                              )}
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
    const filteredAdminTickets = visibleTickets.filter(t => {
      if (adminStartDate && t.date < adminStartDate) return false;
      if (adminEndDate && t.date > adminEndDate) return false;
      return true;
    });

    const successTickets = filteredAdminTickets.filter(t => t.status === 'success' || !t.status);
    const totalEarnings = successTickets.reduce((sum, t) => sum + t.totalPrice, 0);
    const furgos = activeRepartidores.map(u => u.id);
    
    const furgoData = furgos.reduce((acc, fid) => {
      const fTickets = filteredAdminTickets.filter(t => t.furgoId === fid);
      const fSuccess = fTickets.filter(t => t.status === 'success' || !t.status);
      acc[fid] = {
        count: fTickets.length,
        successCount: fSuccess.length,
        earnings: fSuccess.reduce((sum, t) => sum + t.totalPrice, 0)
      };
      return acc;
    }, {});

    const maxEarnings = Math.max(...Object.values(furgoData).map(d => d.earnings), 1);

    // Contadores (Solo cuenta de paradas con éxito)
    let totalTvs = 0;
    let totalPackages = 0;
    successTickets.forEach(t => {
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
          <button className={`tab-btn ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>Repartos del Periodo ({filteredAdminTickets.length})</button>
          <button className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('map'); }}>🗺️ Mapa de Control</button>
          {editingTicketId && (
            <button className={`tab-btn active`} onClick={() => setActiveTab('new_ticket')}>✏️ Editando...</button>
          )}
          <button className={`tab-btn ${activeTab === 'tariffs' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('tariffs'); }}>Ajustar Precios</button>
          <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('users'); }}>Furgonetas y Seguridad</button>
        </div>

        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Selector de Rango de Fechas para Cortes */}
            <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'space-between', padding: '15px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>Corte de Facturación (Periodo)</h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Desde:</span>
                  <input 
                    type="date" 
                    className="form-input" 
                    style={{ padding: '6px 12px', fontSize: '0.9rem', width: 'auto' }} 
                    value={adminStartDate} 
                    onChange={(e) => setAdminStartDate(e.target.value)} 
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Hasta:</span>
                  <input 
                    type="date" 
                    className="form-input" 
                    style={{ padding: '6px 12px', fontSize: '0.9rem', width: 'auto' }} 
                    value={adminEndDate} 
                    onChange={(e) => setAdminEndDate(e.target.value)} 
                  />
                </div>
                {(adminStartDate || adminEndDate) && (
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-small" 
                    style={{ padding: '6px 12px' }}
                    onClick={() => {
                      setAdminStartDate('');
                      setAdminEndDate('');
                    }}
                  >
                    Mostrar Todo
                  </button>
                )}
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="stat-card success">
                <p>Ganancias del Periodo</p>
                <div className="stat-val">{totalEarnings.toFixed(2)} €</div>
              </div>
              <div className="stat-card info">
                <p>Entregas con Éxito</p>
                <div className="stat-val">{successTickets.length} / {filteredAdminTickets.length}</div>
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
                        <span className="chart-label">{(users.find(u => u.id === fid)?.label) || fid} ({data.successCount}/{data.count} éxitos)</span>
                      </div>
                    );
                  })}
                </div>

                <div className="table-container" style={{ marginTop: '30px' }}>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Furgoneta</th>
                        <th style={{ textAlign: 'center' }}>Éxitos / Total</th>
                        <th style={{ textAlign: 'right' }}>Base Imponible</th>
                        <th style={{ textAlign: 'right' }}>IVA (+21%)</th>
                        <th style={{ textAlign: 'right' }}>Retención (-1%)</th>
                        <th style={{ textAlign: 'right' }}>Total Neto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {furgos.map(fid => {
                        const data = furgoData[fid] || { count: 0, successCount: 0, earnings: 0 };
                        const base = data.earnings;
                        const iva = base * 0.21;
                        const retencion = base * 0.01;
                        const totalNeto = base + iva - retencion;
                        const label = users.find(u => u.id === fid)?.label || fid;
                        return (
                          <tr key={fid}>
                            <td style={{ fontWeight: '600' }}>{label}</td>
                            <td style={{ textAlign: 'center' }}>{data.successCount} / {data.count}</td>
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
                <h2>Cortes de Facturación y Exportación</h2>
                <p>
                  Descarga el informe completo a un Excel detallado con los repartos del periodo seleccionado 
                  {adminStartDate || adminEndDate ? (
                    <strong> (del {adminStartDate || 'inicio'} al {adminEndDate || 'hoy'})</strong>
                  ) : (
                    ' (todo el historial)'
                  )}.
                </p>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  <button onClick={handleExportExcel} className="btn btn-success" style={{ width: 'auto', flex: 1, minWidth: '200px' }}>
                    <FileSpreadsheet size={18} /> Exportar Excel del Periodo
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
                  {activeRepartidores.map(u => (
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
                      <th>Estado</th>
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
                          {t.codAmount > 0 && (
                            <div style={{
                              marginTop: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: t.status === 'success' ? 'var(--success)' : t.status === 'failed' ? 'var(--danger)' : 'var(--warning)',
                              fontSize: '0.8rem',
                              fontWeight: '700'
                            }}>
                              💵 {t.status === 'success' ? 'Cobrado: ' : t.status === 'failed' ? 'No cobrado: ' : 'Cobrar: '} {t.codAmount.toFixed(2)} €
                            </div>
                          )}
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
                        <td style={{ fontWeight: '700', color: t.status === 'failed' ? 'var(--text-muted)' : 'var(--success)' }}>
                          {t.status === 'failed' ? '0.00' : (t.totalPrice || 0).toFixed(2)} €
                        </td>
                        <td>
                          {(() => {
                            const isSuccess = t.status === 'success' || !t.status;
                            const isFailed = t.status === 'failed';
                            return (
                              <span className={`badge ${isSuccess ? 'badge-success' : isFailed ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.75rem' }} title={t.failureReason}>
                                {isSuccess ? '🟢 Éxito' : isFailed ? `🔴 Fallido ${t.failureReason ? `(${t.failureReason})` : ''}` : '🟡 Pendiente'}
                              </span>
                            );
                          })()}
                        </td>
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
              
              {visibleShifts.length === 0 ? (
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
                      {visibleShifts.map(s => {
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
                                {s.summary && s.summary.totalCODAmount > 0 && (
                                  <> | <span>Cobrado: <strong style={{ color: 'var(--success)' }}>{s.summary.totalCODAmount.toFixed(2)} €</strong></span></>
                                )}
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

        {activeTab === 'map' && (
          <div className="glass-panel" style={{ textAlign: 'left' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🗺️ Mapa de Control de Rutas</h2>
            <p style={{ marginBottom: '20px' }}>
              Visualiza en tiempo real la ubicación de tus repartidores en vivo y el recorrido ordenado de sus paradas en el mapa.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <span className="input-label">Filtrar por Fecha</span>
                <input 
                  type="date" 
                  className="form-input" 
                  value={mapFilterDate} 
                  onChange={(e) => setMapFilterDate(e.target.value)} 
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <span className="input-label">Filtrar por Furgoneta</span>
                <select 
                  className="form-input" 
                  value={mapFilterFurgo} 
                  onChange={(e) => setMapFilterFurgo(e.target.value)}
                >
                  <option value="all">Todas las Furgonetas</option>
                  {activeRepartidores.map(u => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0, justifyContent: 'flex-end', display: 'flex', flexDirection: 'column' }}>
                <button 
                  type="button" 
                  onClick={() => { loadData(); triggerAlert('Ubicaciones y entregas actualizadas'); }} 
                  className="btn btn-secondary" 
                  style={{ height: '45px', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <RefreshCw size={16} /> Actualizar Mapa
                </button>
              </div>
            </div>

            {/* Custom dark map style definitions */}
            <style>{`
              .leaflet-popup-content-wrapper, .leaflet-popup-tip {
                background: rgba(18, 12, 38, 0.9) !important;
                backdrop-filter: blur(10px) !important;
                border: 1px solid var(--panel-border) !important;
                color: #fff !important;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5) !important;
              }
              .leaflet-popup-close-button {
                color: #a78bfa !important;
              }
              .leaflet-container {
                font-family: 'Inter', sans-serif !important;
              }
              @keyframes gpsPulse {
                0% { transform: scale(0.9); opacity: 0.6; }
                50% { transform: scale(1.15); opacity: 1; }
                100% { transform: scale(0.9); opacity: 0.6; }
              }
            `}</style>

            <div style={{ position: 'relative' }}>
              <div id="admin-map" style={{ 
                height: '550px', 
                borderRadius: '12px', 
                border: '1px solid var(--panel-border)', 
                background: '#1e1e1e',
                boxShadow: '0 4px 30px rgba(0, 0, 0, 0.25)',
                zIndex: 1
              }}></div>
            </div>
            
            <div style={{ display: 'flex', gap: '15px', marginTop: '15px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                <span>Éxito</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                <span>Fallido</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#fbbf24' }}></span>
                <span>Pendiente</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', marginLeft: '10px' }}>
                <span style={{ display: 'inline-block', width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #a78bfa', background: 'rgba(139,92,246,0.2)', textAlign: 'center', lineHeight: '12px', fontSize: '10px' }}>🚚</span>
                <span>Repartidor en Vivo (Últimas 6h)</span>
              </div>
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
              {/* Crear nuevo usuario */}
              <div className="block-section" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)' }}>
                <div className="block-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={18} color="var(--primary)" /> Crear Nuevo Usuario
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!newUsername.trim() || !newLabel.trim() || !newPassword.trim()) {
                    triggerAlert('Por favor rellena todos los campos', 'error');
                    return;
                  }
                  const roleToUse = currentUser.role === 'superadmin' ? newRole : 'repartidor';
                  const res = addUser(newUsername, newLabel, newPassword, roleToUse, currentUser.id);
                  if (res.success) {
                    triggerAlert(`Usuario "${newLabel}" creado correctamente`);
                    setNewUsername('');
                    setNewLabel('');
                    setNewPassword('');
                    setNewRole('repartidor');
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
                    <span className="input-label">Nombre Visible / Identificador</span>
                    <input type="text" className="form-input" placeholder="Ej. Furgoneta 4 o Administrador Norte" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <span className="input-label">Contraseña / PIN</span>
                    <input type="text" className="form-input" placeholder="Ej. 4444" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                  </div>
                  {currentUser.role === 'superadmin' && (
                    <div className="input-group">
                      <span className="input-label">Rol del Usuario</span>
                      <select 
                        className="form-input" 
                        value={newRole} 
                        onChange={(e) => setNewRole(e.target.value)}
                        required
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--panel-border)', color: 'var(--text)' }}
                      >
                        <option value="repartidor">Repartidor (Furgoneta)</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  )}
                  <button type="submit" className="btn btn-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    <Plus size={16} /> Crear Nuevo Usuario
                  </button>
                </form>
              </div>

              {/* Lista y edición */}
              <div className="block-section" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)' }}>
                <div className="block-title">Usuarios y Furgonetas Activas</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                  {visibleUsers.map(u => (
                    <div key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--primary)' }}>{u.label}</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                            {u.role === 'superadmin' ? 'Super Admin' : u.role === 'admin' ? 'Administrador' : 'Repartidor'}
                          </span>
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

      {isAdminOrSuper ? renderAdminPortal() : renderDriverPortal()}

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
                  totalOtros: 0,
                  totalCODAmount: 0
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
                    {summary.totalCODAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--success)', fontWeight: '600' }}>
                         <span>Total Dinero Cobrado:</span>
                         <strong>{summary.totalCODAmount.toFixed(2)} €</strong>
                      </div>
                    )}
                    
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

                    {!existingShift && !isAdminOrSuper && (
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

                    {isAdminOrSuper && (
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
