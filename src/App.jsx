import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Capacitor } from '@capacitor/core';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';

// Asegurar Leaflet en el objeto global para compatibilidad
if (typeof window !== 'undefined') {
  window.L = L;
}

// Función helper para ordenar tickets de manera uniforme por routeOrder, luego por createdAt
const sortTicketsByRouteOrder = (ticketList) => {
  return [...ticketList].sort((a, b) => {
    const aOrder = a.routeOrder !== undefined && a.routeOrder !== null && a.routeOrder !== '' ? Number(a.routeOrder) : Infinity;
    const bOrder = b.routeOrder !== undefined && b.routeOrder !== null && b.routeOrder !== '' ? Number(b.routeOrder) : Infinity;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
};

// Formatear dirección larga a formato corto: Calle, Número, Población
const getShortAddressString = (addressStr) => {
  if (!addressStr) return '';
  let parts = addressStr.split(',').map(p => p.trim());
  
  const provinces = ['barcelona', 'madrid', 'sevilla', 'valencia', 'alicante', 'málaga', 'malaga', 'cádiz', 'cadiz', 'vizcaya', 'bizkaia', 'gipuzkoa', 'guipúzcoa', 'coruña', 'a coruña', 'asturias', 'zaragoza', 'pontevedra', 'las palmas', 'santa cruz', 'tarragona', 'girona', 'gerona', 'lleida', 'lerida', 'murcia', 'córdoba', 'cordoba', 'toledo', 'huelva', 'jaén', 'jaen', 'almería', 'almeria', 'granada', 'castellón', 'castellon', 'valladolid', 'badajoz', 'navarra', 'cantabria', 'ourense', 'lugo', 'cáceres', 'caceres', 'ciudad real', 'albacete', 'burgos', 'salamanca', 'león', 'leon', 'rioja', 'la rioja', 'cuenca', 'teruel', 'soria', 'segovia', 'ávila', 'avila', 'guadalajara', 'palencia', 'zamora', 'huesca'];
  const regions = ['catalunya', 'cataluña', 'madrid', 'andalucía', 'andalucia', 'país vasco', 'pais vasco', 'galicia', 'comunidad valenciana', 'valencia', 'aragón', 'aragon', 'castilla', 'murcia', 'extremadura', 'asturias', 'cantabria', 'navarra', 'la rioja', 'baleares', 'canarias', 'españa', 'spain'];

  // Clean each part (remove parenthesized provinces/countries/regions)
  parts = parts.map(p => {
    let cleaned = p;
    cleaned = cleaned.replace(/\s*\([^)]+\)\s*/g, ' ').trim();
    return cleaned;
  }).filter(p => p.length > 0);

  // Filter out parts that are exactly countries or regions
  const cleanParts = parts.filter(p => {
    const lp = p.toLowerCase();
    if (regions.includes(lp)) return false;
    return true;
  });

  if (cleanParts.length <= 1) return addressStr;

  const lastIndex = cleanParts.length - 1;
  const lastPart = cleanParts[lastIndex];
  const secondLastPart = cleanParts[lastIndex - 1];

  // If the last part is a province, check if we should remove it
  if (provinces.includes(lastPart.toLowerCase())) {
    // If there is a second last part, and that part is NOT just a number (so it's likely a town name)
    const isNumberOnly = /^\d+$/.test(secondLastPart) || secondLastPart.toLowerCase().includes('s/n') || secondLastPart.length <= 4;
    if (!isNumberOnly) {
      cleanParts.pop(); // Remove the province
    }
  }

  // Also remove zones/comarcas if they are present at the end
  const zones = ['vallès occidental', 'valles occidental', 'vallès oriental', 'valles oriental', 'baix llobregat', 'barcelonès', 'barcelones', 'maresme'];
  if (cleanParts.length > 1 && zones.includes(cleanParts[cleanParts.length - 1].toLowerCase())) {
    cleanParts.pop();
  }

  return cleanParts.join(', ');
};

// Obtener ruta por carreteras reales desde OSRM
const fetchRoadRoute = async (points) => {
  if (!points || points.length < 2) return null;
  try {
    const coordsString = points.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.routes && data.routes.length > 0) {
      const routeCoords = data.routes[0].geometry.coordinates;
      return routeCoords.map(c => [c[1], c[0]]);
    }
  } catch (e) {
    console.error("OSRM Routing failed:", e);
  }
  return null;
};
import { 
  Truck, 
  Settings, 
  TrendingUp, 
  Download, 
  Trash2, 
  Plus, 
  ChevronDown,
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
  Clock,
  Navigation,
  Phone
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
  getRouteStartAddr,
  saveRouteStartAddr,
  getRouteEndAddr,
  saveRouteEndAddr,
  getGoogleMapsKey,
  saveGoogleMapsKey,
  getMapboxToken,
  saveMapboxToken,
  addTariff,
  parseTicketNotes,
  encodeTicketNotes,
  deleteTariff,
  geocodeAddress,
  normalizeSpanishAddressQuery,
  saveDriverLocation,
  getDriverLocations,
  toggleUserSearchPermission,
  onDataSync,
  reinitSupabase,
  getSupabaseClient,
  getKmPrice,
  saveKmPrice,
  getRouteKms,
  saveRouteKms
} from './db';

initDB();

// Diccionario de calles principales de Barcelona para corrector ortográfico
const BARCELONA_STREETS = [
  'Balmes', 'Diagonal', 'Gran Via de les Corts Catalanes', 'Aragó', 'Passeig de Gràcia', 
  'Mallorca', 'Muntaner', 'La Rambla', 'Avinguda del Paral·lel', 'Consell de Cent', 
  'Provença', 'Girona', 'Casp', 'Aribau', 'València', 'Rocafort', 'Entença', 
  'Calàbria', 'Viladomat', 'Sardenya', 'Marina', 'Lepant', 'Padilla', 'Castillejos', 
  'Travessera de Gràcia', 'Via Augusta', 'Passeig de Sant Joan', 'Avinguda Meridiana', 
  'Gran de Gràcia', 'Santaló', 'Mandri', 'Ganduxer', 'Tuset', 'Ronda de Dalt', 
  'Ronda Litoral', 'Ronda Sant Pere', 'Ronda Universitat', 'Ronda General Mitre', 
  'Avinguda de Pedralbes', 'Avinguda de Sarrià', 'Carrer de Sants', 'Creu Coberta', 
  'Tarragona', 'Passeig de Colom', 'Via Laietana', 'Carrer Ample', 'Princesa', 
  'Carrer de Ferran', 'Carrer del Carme', 'Hospital', 'Rambla del Raval', 
  'Carrer Nou de la Rambla', 'Carrer de Pelai', 'Carrer de Fontanella', 
  'Carrer de Trafalgar', 'Avinguda de Portal de l\'Àngel', 'Carrer del Pi', 
  'Carrer de Portaferrissa', 'Carrer del Bisbe', 'Montcada', 'Passeig del Born', 
  'Avinguda del Marquès de l\'Argentera', 'Carrer del Comerç', 'Passeig de Picasso', 
  'Passeig de Lluís Companys', 'Carrer de Pujades', 'Carrer de Llull', 
  'Carrer de Pallars', 'Carrer de Pere IV', 'Avinguda de la Catedral', 'Via Júlia', 
  'Carrer de Cartellà', 'Passeig de Fabra i Puig', 'Carrer de Pi i Margall', 
  'Carrer de Roger de Llúria', 'Carrer de Pau Claris', 'Carrer del Bruc', 
  'Carrer de Bailèn', 'Carrer de Nàpols', 'Carrer de Sicília',  'Carrer del Rosselló', 'Carrer de Còrsega', 'Ramon Llull', 'Jacint Verdaguer', 'Francesc Macià', 'Prat de la Riba', 'Joaquim Sorolla', 'Joan de Borbó', 'Josep Tarradellas', 'Carles III', 'Pere IV', 'Sant Antoni', 'Enric Granados', 'Jordi Girona', 'Esteve Terradas'
];

// Algoritmo Jaro-Winkler para calcular similitud de cadenas de texto
function getJaroWinklerSimilarity(s1, s2) {
  s1 = s1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s2 = s2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (s1 === s2) return 1.0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(len2 - 1, i + matchWindow);
    for (let j = start; j <= end; j++) {
      if (!matches2[j] && s1[i] === s2[j]) {
        matches1[i] = true;
        matches2[j] = true;
        matches++;
        break;
      }
    }
  }
  
  if (matches === 0) return 0.0;
  
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (matches1[i]) {
      while (!matches2[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
  }
  
  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3.0;
  
  let prefix = 0;
  const maxPrefix = 4;
  for (let i = 0; i < Math.min(len1, len2, maxPrefix); i++) {
    if (s1[i] === s2[i]) {
      prefix++;
    } else {
      break;
    }
  }
  
  return jaro + prefix * 0.1 * (1.0 - jaro);
}

// Analizar la dirección en busca de erratas ortográficas y devolver sugerencias de calles similares
function getStreetSpellingSuggestions(addressText) {
  if (!addressText || addressText.length < 4) return [];
  
  const words = addressText.split(/\s+/).map(w => w.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '').trim()).filter(w => w.length >= 4);
  const ignoreWords = ['carrer', 'calle', 'avenida', 'paseo', 'pass', 'passatge', 'avinguda', 'ronda', 'de', 'del', 'la', 'les', 'els', 'dels', 'en', 'es', 'el'];
  
  const suggestions = [];
  
  for (const word of words) {
    if (ignoreWords.includes(word.toLowerCase())) continue;
    
    for (const street of BARCELONA_STREETS) {
      const streetWords = street.split(/\s+/).map(w => w.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '').trim()).filter(w => w.length >= 4 && !ignoreWords.includes(w.toLowerCase()));
      
      for (const sw of streetWords) {
        const sim = getJaroWinklerSimilarity(word, sw);
        if (sim > 0.80 && sim < 0.99) {
          suggestions.push({
            misspelled: word,
            corrected: sw,
            fullStreet: street,
            similarity: sim
          });
        }
      }
    }
  }

  const sorted = suggestions.sort((a, b) => b.similarity - a.similarity);
  const uniqueStreets = [];
  const seen = new Set();
  for (const item of sorted) {
    if (!seen.has(item.fullStreet)) {
      seen.add(item.fullStreet);
      uniqueStreets.push(item);
    }
  }
  
  return uniqueStreets.slice(0, 3);
}

function App() {
  const formatCustomerName = (name) => {
    if (!name) return '';
    return name
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  const [currentUser, setCurrentUser] = useState(null);
  const isAdminOrSuper = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const [tickets, setTickets] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [modulePrice, setModulePrice] = useState(3.81);
  const [kmPrice, setKmPrice] = useState(0.43);
  const [shiftKmsInput, setShiftKmsInput] = useState('');
  const [users, setUsers] = useState([]);
  const loggedInUserObj = users.find(u => u.id === currentUser?.id) || currentUser;
  const hasSearchPermission = loggedInUserObj && (
    loggedInUserObj.role === 'superadmin' || 
    loggedInUserObj.canSearch
  );
  const [shifts, setShifts] = useState([]);

  const [activeTab, setActiveTab] = useState(''); 
  const [ticketFilterFurgo, setTicketFilterFurgo] = useState('all');
  const [ticketFilterDate, setTicketFilterDate] = useState('');
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [ticketFilterPostcode, setTicketFilterPostcode] = useState('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [alertMsg, setAlertMsg] = useState({ text: '', type: '' });
  const [driverFilter, setDriverFilter] = useState('active_reparto');
  const [quickFailTicketId, setQuickFailTicketId] = useState(null);

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
  const [postcode, setPostcode] = useState('');
  const [addressVerification, setAddressVerification] = useState({ status: 'idle', message: '' });
  const [lastVerifiedAddress, setLastVerifiedAddress] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isListeningName, setIsListeningName] = useState(false);
  const [isListeningStart, setIsListeningStart] = useState(false);
  const [isListeningEnd, setIsListeningEnd] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const debounceTimerRef = useRef(null);
  const mapSelectTimerRef = useRef(null);
  const formMapRef = useRef(null);
  const formMarkerRef = useRef(null);
  const [ticketDate, setTicketDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [timeSlot, setTimeSlot] = useState('any');
  const [estimatedDuration, setEstimatedDuration] = useState(10);
  const [routeStartTime, setRouteStartTime] = useState('09:00');
  const [isDurationManuallyEdited, setIsDurationManuallyEdited] = useState(false);
  const [ticketRoute, setTicketRoute] = useState('');
  const [originalRouteLabel, setOriginalRouteLabel] = useState('');
  const [codAmount, setCodAmount] = useState('');
  const [showHelperRoute, setShowHelperRoute] = useState(false);
  const [showCod, setShowCod] = useState(false);

  // Lista de TVs añadidas al ticket actual
  // Cada TV: { id: string, inches: number, action: 'entrega'|'recogida'|'combinado', pmType: 'none'|'basic'|'complex', cuelgue: boolean, recogidaViejaType: 'none'|'urbantz'|'no_urbantz' }
  const [formTvs, setFormTvs] = useState([]);
  const [selectedMapTicket, setSelectedMapTicket] = useState(null);
  const [isMapPanelExpanded, setIsMapPanelExpanded] = useState(true);
  const [activeRoutes, setActiveRoutes] = useState(() => {
    try {
      const saved = localStorage.getItem('delivery_active_routes');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [currentRouteId, setCurrentRouteId] = useState(() => {
    return localStorage.getItem('delivery_current_route_id') || null;
  });
  const activeRouteContext = activeRoutes.find(r => r.id === currentRouteId);

  useEffect(() => {
    localStorage.setItem('delivery_active_routes', JSON.stringify(activeRoutes));
  }, [activeRoutes]);

  useEffect(() => {
    if (currentRouteId !== null) {
      localStorage.setItem('delivery_current_route_id', currentRouteId);
    } else {
      localStorage.removeItem('delivery_current_route_id');
    }
  }, [currentRouteId]);

  useEffect(() => {
    if (ticketDate) {
      setMapFilterDate(ticketDate);
    }
  }, [ticketDate]);

  useEffect(() => {
    if (!address || address.trim().length < 5) {
      setDuplicateWarning(null);
      return;
    }
    
    const normalize = (str) => {
      if (!str) return '';
      let s = str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\bcalle\b|\bc\/\b|\bc\.\b/gi, 'c')
        .replace(/\bavenida\b|\bavda\b|\bav\b/gi, 'av')
        .replace(/\bplaza\b|\bpl\b/gi, 'pl')
        .replace(/[^a-z0-9]/g, '');
      return s;
    };

    const normInput = normalize(address);
    if (normInput.length < 5) {
      setDuplicateWarning(null);
      return;
    }

    const dayTickets = tickets.filter(t => t.date === ticketDate);
    const duplicate = dayTickets.find(t => {
      if (editingTicketId && t.id === editingTicketId) return false;
      const normTicket = normalize(t.address);
      return normTicket === normInput || (normTicket.length > 8 && normInput.length > 8 && (normTicket.includes(normInput) || normInput.includes(normTicket)));
    });

    if (duplicate) {
      const driverLabel = users.find(u => u.id === duplicate.furgoId)?.label || duplicate.furgoId;
      setDuplicateWarning({
        id: duplicate.id,
        clientName: duplicate.clientName || 'Cliente sin nombre',
        routeName: duplicate.routeName || 'Sin ruta',
        driver: driverLabel
      });
    } else {
      setDuplicateWarning(null);
    }
  }, [address, ticketDate, tickets, editingTicketId, users]);

  const [collapsedTicketIds, setCollapsedTicketIds] = useState(() => {
    try {
      const saved = localStorage.getItem('delivery_collapsed_tickets');
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('delivery_collapsed_tickets', JSON.stringify(collapsedTicketIds));
  }, [collapsedTicketIds]);

  const toggleCollapse = (id) => {
    setCollapsedTicketIds(prev => {
      const current = prev && typeof prev === 'object' ? prev : {};
      return {
        ...current,
        [id]: !current[id]
      };
    });
  };
  const [showCreateRouteFormFields, setShowCreateRouteFormFields] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteDate, setNewRouteDate] = useState(new Date().toISOString().split('T')[0]);
  const [newRouteFurgoId, setNewRouteFurgoId] = useState('');

  // Estados temporales para añadir una TV nueva al listado
  const [tempTvInches, setTempTvInches] = useState('55');
  const [tempTvAction, setTempTvAction] = useState('entrega');
  const [tempTvBrand, setTempTvBrand] = useState('Samsung');

  // Cantidades de otros artículos no-TV (Paquetería y Otros Elementos)
  // { tariffId: quantity }
  const [otherQuantities, setOtherQuantities] = useState({});
  const [customExtras, setCustomExtras] = useState([]);
  const [customExtraName, setCustomExtraName] = useState('');
  const [customExtraPrice, setCustomExtraPrice] = useState('');
  const [urgenteType, setUrgenteType] = useState('none'); // 'none' | '100' | '120'

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
  const [isTrackingActive, setIsTrackingActive] = useState(true);
  const [gpsStatus, setGpsStatus] = useState('inactive'); // 'active' | 'error' | 'inactive'
  const watchIdRef = useRef(null);
  const [mapFilterDate, setMapFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [mapFilterFurgo, setMapFilterFurgo] = useState('all');
  const mapInstanceRef = useRef(null);
  const mapLayerGroupRef = useRef(null);
  const lastFittedRef = useRef('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [routeStartAddr, setRouteStartAddr] = useState(getRouteStartAddr());
  const [routeEndAddr, setRouteEndAddr] = useState(getRouteEndAddr());
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [otherDescriptions, setOtherDescriptions] = useState({});

  const handleFetchRouteSuggestions = async (queryText, type) => {
    const setTarget = type === 'start' ? setStartSuggestions : setEndSuggestions;
    if (!queryText || queryText.trim().length < 3) {
      setTarget([]);
      return;
    }
    try {
      const countryCode = searchCountryCode || 'es';
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&countrycodes=${countryCode}&q=${encodeURIComponent(queryText.trim())}`;
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (response.ok) {
        const data = await response.json();
        setTarget(data || []);
      }
    } catch (err) {
      console.error("Error fetching route suggestions:", err);
    }
  };

  const fillCurrentLocation = (targetField) => {
    if (!navigator.geolocation) {
      triggerAlert('La geolocalización no está soportada por tu navegador', 'error');
      return;
    }
    
    triggerAlert('Obteniendo tu ubicación actual...', 'info');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;
          const response = await fetch(url, { headers: { 'Accept-Language': 'es,ca,eu,gl,en;q=0.9', 'Accept': 'application/json' } });
          if (response.ok) {
            const data = await response.json();
            const displayName = data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            if (targetField === 'start') {
              setRouteStartAddr(displayName);
              triggerAlert('Ubicación de partida actualizada');
            } else {
              setRouteEndAddr(displayName);
              triggerAlert('Ubicación de llegada actualizada');
            }
          } else {
            const coordsStr = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            if (targetField === 'start') {
              setRouteStartAddr(coordsStr);
            } else {
              setRouteEndAddr(coordsStr);
            }
            triggerAlert('Ubicación obtenida (coordenadas)');
          }
        } catch (err) {
          console.error("Error reverse geocoding:", err);
          const coordsStr = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          if (targetField === 'start') {
            setRouteStartAddr(coordsStr);
          } else {
            setRouteEndAddr(coordsStr);
          }
          triggerAlert('Ubicación obtenida (coordenadas)');
        }
      },
      (error) => {
        console.error("Error obtaining location:", error);
        triggerAlert('No se pudo acceder a tu ubicación. Comprueba los permisos.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  const renderRouteSuggestions = (type) => {
    const list = type === 'start' ? startSuggestions : endSuggestions;
    const setTarget = type === 'start' ? setStartSuggestions : setEndSuggestions;
    const setAddr = type === 'start' ? setRouteStartAddr : setRouteEndAddr;
    
    if (list.length === 0) return null;
    
    return (
      <ul style={{
        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
        background: 'rgba(20, 16, 38, 0.98)', border: '1px solid var(--panel-border)', borderRadius: 'var(--border-radius-md)',
        padding: '4px 0', margin: '4px 0 0 0', listStyle: 'none', maxHeight: '150px', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.6)'
      }}>
        {list.map((sug, index) => (
          <li 
            key={index}
            onMouseDown={(e) => {
              e.preventDefault();
              setAddr(sug.display_name);
              setTarget([]);
            }}
            style={{
              padding: '10px 14px', cursor: 'pointer', fontSize: '0.85rem', color: '#ffffff',
              borderBottom: index < list.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              transition: 'background 0.2s', lineHeight: '1.4', textAlign: 'left'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.35)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            📍 {sug.display_name}
          </li>
        ))}
      </ul>
    );
  };
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [searchCountryCode, setSearchCountryCode] = useState(localStorage.getItem('search_country_code') || 'es');
  const [searchCityBias, setSearchCityBias] = useState(localStorage.getItem('search_city_bias') || 'Barcelona');
  const [searchStrictCity, setSearchStrictCity] = useState(localStorage.getItem('search_strict_city') === 'true');
  const [googleKeyInput, setGoogleKeyInput] = useState(getGoogleMapsKey());
  const [mapboxTokenInput, setMapboxTokenInput] = useState(getMapboxToken());
  const [spellingSuggestions, setSpellingSuggestions] = useState([]);

  // Derived state for role-based data partitioning (independent invoicing per administrator)
  const activeRepartidores = users.filter(u => {
    if (u.role !== 'repartidor') return false;
    if (!currentUser) return false;
    if (currentUser.role === 'superadmin') return true;
    if (currentUser.role === 'repartidor') return u.id === currentUser.id;
    // admin role
    return u.createdBy === currentUser.id;
  });

  const teamRepartidores = users.filter(u => u.role === 'repartidor');

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
  const getInitialAppName = () => {
    let uId = null;
    try {
      const savedUser = localStorage.getItem('delivery_session');
      if (savedUser && savedUser !== 'null') {
        const parsed = JSON.parse(savedUser);
        if (parsed) uId = parsed.id;
      }
    } catch (e) {}
    return getAppName(uId);
  };
  const [appName, setAppName] = useState(getInitialAppName());
  const [appNameInput, setAppNameInput] = useState(getInitialAppName());
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
    if (savedUser && savedUser !== 'null') {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.role) {
          setCurrentUser(parsed);
          setActiveTab((parsed.role === 'admin' || parsed.role === 'superadmin') ? 'dashboard' : 'new_ticket');
        }
      } catch (e) {
        console.error("Error parsing saved user session on mount:", e);
      }
    }

    reinitSupabase();

    onDataSync(() => {
      loadDataRef.current();
    });

    const handleRefresh = () => {
      reinitSupabase();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh();
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleRefresh);

    const interval = setInterval(handleRefresh, 15000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleRefresh);
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'repartidor') {
        setRouteStartAddr(localStorage.getItem(`delivery_start_addr_${currentUser.id}`) || 'Madrid, España');
        setRouteEndAddr(localStorage.getItem(`delivery_end_addr_${currentUser.id}`) || 'Madrid, España');
      } else {
        setRouteStartAddr(localStorage.getItem('delivery_default_start_addr') || 'Madrid, España');
        setRouteEndAddr(localStorage.getItem('delivery_default_end_addr') || 'Madrid, España');
      }
    }
  }, [currentUser]);

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
    let active = true;
    
    const startTracking = async () => {
      if (isTrackingActive && currentUser && currentUser.role === 'repartidor') {
        if (Capacitor.isNativePlatform()) {
          try {
            const permission = await CapGeolocation.requestPermissions();
            if (!active) return;
            if (permission.location !== 'granted') {
              setGpsStatus('error');
              return;
            }
            setGpsStatus('active');
            watchIdRef.current = await CapGeolocation.watchPosition(
              { enableHighAccuracy: true, timeout: 10000 },
              (position, err) => {
                if (!active) return;
                if (err) {
                  console.error("Capacitor watchPosition error:", err);
                  setGpsStatus('error');
                  return;
                }
                if (position) {
                  const { latitude, longitude } = position.coords;
                  saveDriverLocation(currentUser.id, latitude, longitude);
                  setGpsStatus('active');
                }
              }
            );
          } catch (err) {
            console.error("Capacitor Geolocation exception:", err);
            setGpsStatus('error');
          }
        } else {
          // Standard browser Geolocation
          if ('geolocation' in navigator) {
            setGpsStatus('active');
            watchIdRef.current = navigator.geolocation.watchPosition(
              (position) => {
                if (!active) return;
                const { latitude, longitude } = position.coords;
                saveDriverLocation(currentUser.id, latitude, longitude);
                setGpsStatus('active');
              },
              (error) => {
                if (!active) return;
                console.error("GPS Tracking Error:", error);
                setGpsStatus('error');
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              }
            );
          } else {
            console.error("Geolocation not supported by this browser.");
            setGpsStatus('error');
          }
        }
      } else {
        stopTracking();
      }
    };

    const stopTracking = () => {
      if (watchIdRef.current !== null) {
        if (Capacitor.isNativePlatform()) {
          CapGeolocation.clearWatch({ id: watchIdRef.current }).catch(err => console.error("Error clearing native watch:", err));
        } else {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        watchIdRef.current = null;
      }
      setGpsStatus('inactive');
    };

    startTracking();

    return () => {
      active = false;
      stopTracking();
    };
  }, [isTrackingActive, currentUser]);

  // Sincronizar ruta por defecto del ticket
  useEffect(() => {
    if (currentUser && !isAdminOrSuper) {
      const currentDbUser = users.find(u => u.id === currentUser.id);
      setTicketRoute(currentDbUser ? currentDbUser.label : currentUser.label);
    }
  }, [currentUser, ticketDate, users]);

  // Inicialización y actualización del Mapa Leaflet (Admin o Repartidor)
  useEffect(() => {
    const timer = setTimeout(() => {
      const isAdminMap = activeTab === 'map' && document.getElementById('admin-map');
      const isDriverMap = activeTab === 'driver_map' && document.getElementById('driver-map');

      if ((isAdminMap || isDriverMap) && window.L) {
        const mapElementId = isAdminMap ? 'admin-map' : 'driver-map';

        let map = mapInstanceRef.current;

        // 1. Inicializar nuevo mapa si no existe
        if (map === null) {
          map = window.L.map(mapElementId, {
            zoomControl: true,
            attributionControl: true
          }).setView([41.3879, 2.16992], 12);
          mapInstanceRef.current = map;

          // Deseleccionar pin al hacer clic en el fondo del mapa
          map.on('click', (e) => {
            if (e.originalEvent.target.closest('.leaflet-marker-icon')) return;
            setSelectedMapTicket(null);
          });

          // Cargar capas de mapa (Claro Minimalista, Oscuro Premium, Calles Moderno, Satélite)
          const positron = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
          });

          const darkMatter = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
          });

          const voyager = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
          });

          const satellite = window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 19
          });

          // Activar el Claro Minimalista (Positron) por defecto
          positron.addTo(map);

          const baseMaps = {
            "Claro Minimalista ⚪": positron,
            "Oscuro Premium ⚫": darkMatter,
            "Calles Moderno 🗺️": voyager,
            "Satélite Real 🛰️": satellite
          };
          window.L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);
        }

        // 2. Inicializar o limpiar el LayerGroup de marcadores y polilíneas
        if (!mapLayerGroupRef.current) {
          mapLayerGroupRef.current = window.L.layerGroup().addTo(map);
        } else {
          mapLayerGroupRef.current.clearLayers();
        }

        // 3. Filtrar y ordenar los tickets geocodificados
        const targetDate = isAdminMap ? mapFilterDate : (shiftSummaryDate || new Date().toISOString().split('T')[0]);
        
        const dayTickets = tickets.filter(t => {
          if (!t) return false;
          if (t.date !== targetDate) return false;
          if (isAdminMap) {
            if (mapFilterFurgo !== 'all' && t.furgoId !== mapFilterFurgo) return false;
          } else {
            // Driver map: only show tickets for the logged in driver
            if (t.furgoId !== currentUser?.id) return false;
          }
          const latNum = parseFloat(t.lat);
          const lngNum = parseFloat(t.lng);
          return t.lat !== undefined && t.lat !== null && !isNaN(latNum) && t.lng !== undefined && t.lng !== null && !isNaN(lngNum);
        });

        // Ordenar por hora de creación o por routeOrder para visualizar la secuencia lógica
        const sortedDayTickets = sortTicketsByRouteOrder(dayTickets);

        // Agrupar tickets por repartidor
        const ticketsByDriver = {};
        sortedDayTickets.forEach(t => {
          if (!ticketsByDriver[t.furgoId]) ticketsByDriver[t.furgoId] = [];
          ticketsByDriver[t.furgoId].push(t);
        });

        const bounds = [];
        const COLORS = ['#a78bfa', '#38bdf8', '#34d399', '#f472b6', '#fbbf24', '#f43f5e'];

        // 4. Dibujar marcadores de paradas y líneas de ruta (polilíneas)
        Object.keys(ticketsByDriver).forEach((fid, idx) => {
          const driverTickets = ticketsByDriver[fid];
          const driverColor = COLORS[idx % COLORS.length];
          const furgoLabel = users.find(u => u.id === fid)?.label || fid;

          driverTickets.forEach((t, seqIndex) => {
            const latNum = parseFloat(t.lat);
            const lngNum = parseFloat(t.lng);
            const latLng = [latNum, lngNum];
            bounds.push(latLng);

            const isSuccess = t.status === 'success';
            const isFailed = t.status === 'failed';
            const isTransit = t.status === 'transit';
            const statusColor = isSuccess ? '#10b981' : isFailed ? '#ef4444' : isTransit ? '#38bdf8' : '#fbbf24';

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

            window.L.marker(latLng, { icon: markerIcon })
              .addTo(mapLayerGroupRef.current)
              .on('click', () => {
                handleSelectMapTicket(t);
              });
          });

          // Trazar línea de ruta conectando las paradas en orden (siguiendo carreteras reales)
          if (driverTickets.length > 1) {
            const routeCoords = driverTickets.map(t => {
              const latNum = parseFloat(t.lat);
              const lngNum = parseFloat(t.lng);
              return [latNum, lngNum];
            });

            // Dibujar línea recta como fallback inmediato
            const polylineRef = window.L.polyline(routeCoords, {
              color: driverColor,
              weight: 3,
              opacity: 0.75,
              dashArray: '6, 6'
            }).addTo(mapLayerGroupRef.current);

            // Cargar trazado de carreteras reales asíncronamente desde OSRM
            fetchRoadRoute(routeCoords.map(c => ({ lat: c[0], lng: c[1] })))
              .then(roadCoords => {
                if (roadCoords && roadCoords.length > 0) {
                  polylineRef.setLatLngs(roadCoords);
                  polylineRef.setStyle({ dashArray: null, weight: 4, opacity: 0.85 });
                }
              })
              .catch(err => {
                console.error("OSRM route path failed:", err);
              });
          }
        });

        // 5. Dibujar repartidores en tiempo real
        const liveLocations = getDriverLocations();
        Object.entries(liveLocations).forEach(([fid, loc]) => {
          if (!loc || loc.lat === undefined || loc.lng === undefined) return;
          const latNum = parseFloat(loc.lat);
          const lngNum = parseFloat(loc.lng);
          if (isNaN(latNum) || isNaN(lngNum)) return;

          if (isAdminMap) {
            if (mapFilterFurgo !== 'all' && fid !== mapFilterFurgo) return;
            if (!activeRepartidores.map(r => r.id).includes(fid)) return;
          } else {
            // Driver map: only show their own location
            if (fid !== currentUser?.id) return;
          }

          const updatedAtStr = loc.updatedAt || loc.timestamp;
          if (!updatedAtStr) return;
          const locTime = new Date(updatedAtStr).getTime();
          if (isNaN(locTime)) return;
          const timeDiff = Date.now() - locTime;
          if (timeDiff > 6 * 60 * 60 * 1000) return; // Filtro de inactividad de 6 horas

          const latLng = [latNum, lngNum];
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
              <div style="margin-top: 5px;">Última señal: <strong>${new Date(locTime).toLocaleTimeString()}</strong></div>
              <div style="margin-top: 2px; font-size: 0.75rem; color: #9ca3af;">GPS: ${latNum.toFixed(5)}, ${lngNum.toFixed(5)}</div>
            </div>
          `;

          window.L.marker(latLng, { icon: liveIcon })
            .addTo(mapLayerGroupRef.current)
            .bindPopup(popupContent);
        });

        // 6. Auto-ajustar el zoom del mapa para mostrar todos los puntos (solo al iniciar o cambiar filtros)
        const currentFilterKey = `${activeTab}_${targetDate}_${mapFilterFurgo}_${shiftSummaryDate}`;
        if (bounds.length > 0 && lastFittedRef.current !== currentFilterKey) {
          map.fitBounds(bounds, { padding: [50, 50] });
          lastFittedRef.current = currentFilterKey;
        }

        // Forzar recalculo de dimensiones para corregir pantallas grises o en blanco
        map.invalidateSize();
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      const isAdminMap = document.getElementById('admin-map');
      const isDriverMap = document.getElementById('driver-map');
      if (!isAdminMap && !isDriverMap && mapInstanceRef.current !== null) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.error("Error removing map instance:", e);
        }
        mapInstanceRef.current = null;
        mapLayerGroupRef.current = null;
      }
    };
  }, [activeTab, mapFilterDate, mapFilterFurgo, tickets, users, shiftSummaryDate, currentUser]);



  const loadData = () => {
    let u = currentUser;
    if (localStorage.getItem('search_strict_city_migrated') !== 'v1') {
      localStorage.setItem('search_strict_city', 'false');
      localStorage.setItem('search_strict_city_migrated', 'v1');
      setSearchStrictCity(false);
    }
    try {
      const rawTickets = getTickets() || [];
      const rawTariffs = getTariffs() || [];
      const rawUsers = getUsers() || [];
      const rawShifts = getShifts() || [];
      
      const savedUser = localStorage.getItem('delivery_session');
      if (!u && savedUser && savedUser !== 'null') {
        try {
          u = JSON.parse(savedUser);
        } catch (e) {
          console.error("Error parsing delivery_session:", e);
        }
      }
      
      let finalTickets = rawTickets;
      let finalTariffs = rawTariffs;
      let finalUsers = rawUsers;
      let finalShifts = rawShifts;
      
      if (u && u.role) {
        if (u.role === 'admin') {
          const myUserIds = rawUsers.filter(usr => usr && (usr.createdBy === u.id || usr.id === u.id)).map(usr => usr.id);
          finalTickets = rawTickets.filter(t => t && (t.createdBy === u.id || myUserIds.includes(t.furgoId)));
          finalUsers = rawUsers.filter(usr => usr && (usr.createdBy === u.id || usr.id === u.id));
          finalTariffs = rawTariffs.filter(t => t && (t.createdBy === u.id || !t.createdBy));
          finalShifts = rawShifts.filter(s => s && (s.createdBy === u.id || myUserIds.includes(s.furgoId)));
        } else if (u.role === 'repartidor') {
          finalTickets = rawTickets.filter(t => t && t.furgoId === u.id);
          finalUsers = rawUsers.filter(usr => usr && (usr.createdBy === u.createdBy || usr.id === u.id || usr.id === u.createdBy));
          finalShifts = rawShifts.filter(s => s && s.furgoId === u.id);
        }
      }
      
      setTickets(finalTickets);
      setTariffs(finalTariffs);
      setUsers(finalUsers);
      setShifts(finalShifts);
      
      // Extraer rutas activas de los tickets para que se sincronicen entre dispositivos
      const extractedRoutes = [];
      const routeKeys = new Set();
      
      finalTickets.forEach(t => {
        if (t.routeName && t.date && t.furgoId) {
          const key = `${t.routeName}|${t.date}|${t.furgoId}`;
          if (!routeKeys.has(key)) {
            routeKeys.add(key);
            extractedRoutes.push({
              id: key,
              name: t.routeName,
              date: t.date,
              furgoId: t.furgoId
            });
          }
        }
      });

      // Ordenar rutas por fecha ascendente
      extractedRoutes.sort((a, b) => a.date.localeCompare(b.date));

      setActiveRoutes(prev => {
        const merged = [...prev];
        extractedRoutes.forEach(ext => {
          const isClosed = getShiftStatus(ext.furgoId, ext.date) === 'closed';
          if (isClosed) return; // Evitar re-introducir rutas cerradas
          
          const exists = merged.some(r => 
            r.name.toLowerCase() === ext.name.toLowerCase() && 
            r.date === ext.date && 
            r.furgoId === ext.furgoId
          );
          if (!exists) {
            merged.push(ext);
          }
        });
        return merged;
      });

      // Auto-seleccionar la última ruta activa del chofer si no hay ninguna seleccionada
      if (u && u.role === 'repartidor') {
        const myExtractedRoutes = extractedRoutes.filter(r => r.furgoId === u.id);
        if (myExtractedRoutes.length > 0 && !currentRouteId) {
          const latestRoute = myExtractedRoutes[myExtractedRoutes.length - 1];
          setCurrentRouteId(latestRoute.id);
          setTicketDate(latestRoute.date);
          setTicketRoute(latestRoute.furgoId);
          setRouteName(latestRoute.name);
        }
      }
      
      if (u && u.role === 'repartidor') {
        setNewRouteFurgoId(u.id);
      } else {
        const activeRepartidores = finalUsers.filter(usr => usr && usr.role === 'repartidor');
        if (activeRepartidores.length > 0) {
          if (!activeRepartidores.some(r => r.id === newRouteFurgoId)) {
            setNewRouteFurgoId(activeRepartidores[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Error loading data in App.jsx:", err);
    }
    
    setModulePrice(getModulePrice(u?.id) || 3.81);
    setKmPrice(getKmPrice(u?.id) || 0.43);
    setAppName(getAppName(u?.id) || 'My Delivery Team');
    if (activeTab !== 'users') {
      setAppNameInput(getAppName(u?.id) || 'My Delivery Team');
    }
    setRouteStartAddr(getRouteStartAddr(u?.id));
    setRouteEndAddr(getRouteEndAddr(u?.id));
    setGoogleKeyInput(getGoogleMapsKey());
    setMapboxTokenInput(getMapboxToken());
  };

  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  });

  const triggerAlert = (text, type = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg({ text: '', type: '' }), 4000);
  };

  useEffect(() => {
    if (isDurationManuallyEdited) return;
    let duration = 10; // Base: 10 mins

    if (formTvs.length > 0) {
      duration = 15; // Primera TV: 15 mins
      duration += (formTvs.length - 1) * 10; // Adicionales: 10 mins c/u

      formTvs.forEach(tv => {
        if (tv.pmType === 'basic') duration += 15;
        else if (tv.pmType === 'complex') duration += 30;

        if (tv.cuelgue) duration += 30;
        if (tv.recogidaViejaType && tv.recogidaViejaType !== 'none') duration += 5;
      });
    }

    // Otros elementos (paquetes o accesorios)
    let totalOthers = 0;
    Object.values(otherQuantities).forEach(qty => {
      totalOthers += (qty || 0);
    });
    if (totalOthers > 0 && formTvs.length === 0) {
      // Si solo es paquetería
      duration = 10 + (totalOthers - 1) * 5;
    } else if (totalOthers > 0) {
      // Si acompaña a la TV
      duration += totalOthers * 3;
    }

    setEstimatedDuration(duration);
  }, [formTvs, otherQuantities]);

  useEffect(() => {
    if (activeRouteContext && activeRouteContext.date) {
      setShiftSummaryDate(activeRouteContext.date);
    }
  }, [activeRouteContext]);

  useEffect(() => {
    const mapEl = document.getElementById('form-mini-map');
    if (mapEl && window.L && addressVerification.status === 'success' && addressVerification.coords) {
      const { lat, lng } = addressVerification.coords;
      const latLng = [lat, lng];

      if (!formMapRef.current) {
        const map = window.L.map('form-mini-map', {
          zoomControl: false,
          attributionControl: false
        }).setView(latLng, 16);

        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 20
        }).addTo(map);

        const marker = window.L.marker(latLng, {
          draggable: true
        }).addTo(map);

        marker.on('dragend', () => {
          const newPos = marker.getLatLng();
          setAddressVerification(prev => ({
            ...prev,
            coords: {
              ...prev.coords,
              lat: parseFloat(newPos.lat.toFixed(6)),
              lng: parseFloat(newPos.lng.toFixed(6))
            }
          }));
        });

        map.on('click', (e) => {
          const newPos = e.latlng;
          marker.setLatLng(newPos);
          setAddressVerification(prev => ({
            ...prev,
            coords: {
              ...prev.coords,
              lat: parseFloat(newPos.lat.toFixed(6)),
              lng: parseFloat(newPos.lng.toFixed(6))
            }
          }));
        });

        window.L.control.zoom({ position: 'bottomright' }).addTo(map);

        formMapRef.current = map;
        formMarkerRef.current = marker;
      } else {
        const map = formMapRef.current;
        const marker = formMarkerRef.current;
        // Only set view and position if they actually changed to prevent infinite loops on dragging
        const currentCenter = map.getCenter();
        const currentMarkerLatLng = marker.getLatLng();
        if (Math.abs(currentMarkerLatLng.lat - lat) > 0.00001 || Math.abs(currentMarkerLatLng.lng - lng) > 0.00001) {
          marker.setLatLng(latLng);
        }
        if (Math.abs(currentCenter.lat - lat) > 0.001 || Math.abs(currentCenter.lng - lng) > 0.001) {
          map.setView(latLng, 16);
        }
        map.invalidateSize();
      }
    }

    return () => {
      if (!document.getElementById('form-mini-map') && formMapRef.current) {
        formMapRef.current.remove();
        formMapRef.current = null;
        formMarkerRef.current = null;
      }
    };
  }, [addressVerification.status, addressVerification.coords]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    const username = usernameInput.trim();
    const password = passwordInput.trim();
    
    const dbUsers = getUsers() || [];
    let foundUser = dbUsers.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    // Fallback: Si no se encuentra localmente, hacer consulta en vivo a Supabase
    if (!foundUser) {
      const supabaseClient = getSupabaseClient();
      if (supabaseClient) {
        try {
          const { data: cloudUsers, error } = await supabaseClient
            .from('delivery_users')
            .select('*')
            .ilike('username', username)
            .eq('password', password);
            
          if (cloudUsers && cloudUsers.length > 0 && !error) {
            const u = cloudUsers[0];
            foundUser = {
              id: u.id,
              username: u.username,
              password: u.password,
              label: u.label,
              role: u.role,
              canSearch: u.can_search || false,
              createdBy: u.created_by || 'admin'
            };
            // Guardarlo localmente en la lista de usuarios para futuras cargas offline
            const updatedUsers = [...dbUsers.filter(usr => usr.id !== foundUser.id), foundUser];
            saveUsers(updatedUsers);
          }
        } catch (err) {
          console.error("Live login query failed:", err);
        }
      }
    }

    if (foundUser) {
      setCurrentUser(foundUser);
      localStorage.setItem('delivery_session', JSON.stringify(foundUser));
      setActiveTab((foundUser.role === 'admin' || foundUser.role === 'superadmin') ? 'dashboard' : 'new_ticket');
      setUsernameInput('');
      setPasswordInput('');
      await reinitSupabase(); // Forzar sincronización inmediata de sus datos tras iniciar sesión
      loadData();
      triggerAlert(`¡Bienvenido, ${foundUser.label}!`);
    } else {
      setLoginError('Usuario o contraseña incorrectos');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('delivery_session');
    setCurrentUser(null);
    setAppName('My Delivery Team');
    setAppNameInput('My Delivery Team');
    setRouteStartAddr(getRouteStartAddr());
    setRouteEndAddr(getRouteEndAddr());
    setActiveTab('');
    setEditingTicketId(null);
    triggerAlert('Sesión cerrada correctamente');
    setTickets([]);
    setTariffs([]);
    setUsers([]);
    setShifts([]);
  };

  // Añadir una televisión a la lista del formulario
  const addTvToForm = () => {
    const newTv = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      inches: parseInt(tempTvInches),
      brand: tempTvBrand || 'Genérica',
      action: tempTvAction,
      pmType: tempTvAction === 'solo_pm' ? 'basic' : 'none',
      cuelgue: tempTvAction === 'solo_cuelgue' ? true : false,
      recogidaViejaType: 'none'
    };
    setFormTvs([...formTvs, newTv]);
  };

  // Quitar una televisión de la lista del formulario
  const removeTvFromForm = (tvId) => {
    setFormTvs(formTvs.filter(tv => tv.id !== tvId));
  };

  // Añadir un concepto adicional personalizado
  const addCustomExtra = () => {
    const newExtra = {
      id: 'CUSTOM_' + Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: customExtraName.trim(),
      price: parseFloat(customExtraPrice) || 0
    };
    setCustomExtras([...customExtras, newExtra]);
    setCustomExtraName('');
    setCustomExtraPrice('');
  };

  // Quitar un concepto adicional
  const removeCustomExtra = (id) => {
    setCustomExtras(customExtras.filter(extra => extra.id !== id));
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
    const isPaqueteria = ['ENTREGA_PV', 'ENTREGA_GV', 'RECOGIDA_PV', 'RECOGIDA_GV'].includes(tariffId);
    
    if (change > 0 && isPaqueteria) {
      const desc = prompt("Describe el artículo o mercancía a cargar (ej: ventilador de techo):");
      if (desc === null) return; // User cancelled
      const finalDesc = desc.trim() || 'Mercancía genérica';
      
      setOtherDescriptions(prev => {
        const curList = prev[tariffId] || [];
        return { ...prev, [tariffId]: [...curList, finalDesc] };
      });
    } else if (change < 0 && isPaqueteria) {
      setOtherDescriptions(prev => {
        const curList = prev[tariffId] || [];
        if (curList.length === 0) return prev;
        const newList = [...curList];
        newList.pop(); // Remove the last one
        return { ...prev, [tariffId]: newList };
      });
    }

    setOtherQuantities(prev => {
      const cur = prev[tariffId] || 0;
      const newVal = Math.max(0, cur + change);
      return { ...prev, [tariffId]: newVal };
    });
  };

  // Buscar sugerencias de direcciones usando Nominatim (OSM) con filtros geográficos
  const fetchAddressSuggestions = async (queryText) => {
    if (!queryText.trim() || queryText.trim().length < 4) {
      setSuggestions([]);
      return;
    }
    setIsSearchingSuggestions(true);
    try {
      const googleKey = localStorage.getItem('delivery_google_maps_api_key') || '';
      const mapboxToken = localStorage.getItem('delivery_mapbox_access_token') || '';

      // 1. Mapbox Geocoding Suggestions
      if (mapboxToken.trim()) {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(queryText.trim())}.json?access_token=${mapboxToken.trim()}&country=es&language=es,ca,eu,gl&limit=5`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data && data.features) {
            const formatted = data.features.map(feat => {
              let postcode = '';
              if (feat.context) {
                const pc = feat.context.find(c => c.id.startsWith('postcode'));
                if (pc) postcode = pc.text;
              }
              let road = feat.text || '';
              return {
                lat: feat.geometry.coordinates[1].toString(),
                lon: feat.geometry.coordinates[0].toString(),
                display_name: feat.place_name,
                address: {
                  road: road,
                  postcode: postcode
                }
              };
            });
            setSuggestions(formatted);
            setIsSearchingSuggestions(false);
            return;
          }
        }
      }

      // 2. Google Maps Geocoding Suggestions
      if (googleKey.trim()) {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryText.trim())}&key=${googleKey.trim()}&language=es`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data && data.status === 'OK' && data.results) {
            const formatted = data.results.slice(0, 5).map(result => {
              const lat = result.geometry.location.lat.toString();
              const lon = result.geometry.location.lng.toString();
              const displayName = result.formatted_address;
              let postcode = '';
              const pcComponent = result.address_components.find(c => c.types.includes('postal_code'));
              if (pcComponent) postcode = pcComponent.long_name;
              return {
                lat,
                lon,
                display_name: displayName,
                address: {
                  road: result.address_components[0]?.long_name || '',
                  postcode
                }
              };
            });
            setSuggestions(formatted);
            setIsSearchingSuggestions(false);
            return;
          }
        }
      }

      // 3. Fallback: Free Nominatim (OSM)
      const countryCode = searchCountryCode || 'es';
      const cityBias = searchCityBias || 'Barcelona';
      const strictCity = searchStrictCity;

      let searchQuery = normalizeSpanishAddressQuery(queryText);
      const hasComma = searchQuery.includes(',');
      const hasPostalCode = /\b\d{5}\b/.test(searchQuery);
      const commonCities = ['sabadell', 'terrassa', 'badalona', 'hospitalet', 'mataro', 'cornella', 'sant cugat', 'girona', 'tarragona', 'lleida', 'vic', 'manresa', 'sitges', 'castelldefels', 'viladecans', 'prat', 'rubi', 'granollers', 'mollet', 'figueres', 'reus', 'santiago', 'sevilla', 'bilbao', 'madrid', 'valencia', 'zaragoza', 'malaga', 'murcia', 'palma', 'las palmas', 'alicante', 'cordoba', 'valladolid', 'vigo', 'gijon'];
      const hasCommonCity = commonCities.some(city => searchQuery.toLowerCase().includes(city));

      const shouldAppendCity = strictCity && cityBias && !hasComma && !hasPostalCode && !hasCommonCity && !searchQuery.toLowerCase().includes(cityBias.toLowerCase());

      if (shouldAppendCity) {
        searchQuery += `, ${cityBias}`;
      }

      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&countrycodes=${countryCode}&q=${encodeURIComponent(searchQuery)}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'es,ca,eu,gl,en;q=0.9'
        }
      });
      if (response.ok) {
        let data = await response.json();

        if (!data || data.length === 0) {
          const strippedQuery = searchQuery.replace(/^\s*(carrer\s+(de\s+|d')?|calle\s+(de\s+)?|avinguda\s+(de\s+|d')?|avenida\s+(de\s+)?|paseo\s+(de\s+)?|passeig\s+(de\s+|d')?|plaza\s+(de\s+)?|plaça\s+(de\s+|d')?|ronda\s+(de\s+)?|via\s+|vía\s+|camí\s+(de\s+|d')?|cami\s+(de\s+|d')?|carretera\s+(de\s+)?|ctra\s+|pasaje\s+(de\s+)?|passatge\s+(de\s+|d')?|ptge\s+)/i, '').trim();
          if (strippedQuery && strippedQuery !== searchQuery) {
            const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&countrycodes=${countryCode}&q=${encodeURIComponent(strippedQuery)}`;
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

    const rawAddr = sug.address || {};
    let street = rawAddr.road || rawAddr.pedestrian || rawAddr.footway || rawAddr.path || rawAddr.cycleway || rawAddr.square || rawAddr.amenity || rawAddr.building || '';
    if (!street && sug.display_name) {
      street = sug.display_name.split(',')[0].trim();
    }

    let houseNumber = rawAddr.house_number || '';
    const numberMatch = address.match(/\b\d{1,4}[a-zA-Z]?\b/);
    if (!houseNumber && numberMatch) {
      const typedNumber = numberMatch[0];
      const isPostalCode = typedNumber.length === 5;
      if (!isPostalCode) {
        houseNumber = typedNumber;
      }
    }

    let city = rawAddr.city || rawAddr.town || rawAddr.village || rawAddr.municipality || rawAddr.hamlet || '';
    if (!city && sug.display_name) {
      const parts = sug.display_name.split(',').map(p => p.trim());
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
    
    const finalAddress = shortParts.length > 0 ? shortParts.join(', ') : sug.display_name;

    setAddress(finalAddress);

    const extractedPostcode = sug.address && sug.address.postcode ? sug.address.postcode : '';
    if (extractedPostcode) {
      setPostcode(extractedPostcode);
    }

    setAddressVerification({
      status: 'success',
      message: `🟢 Dirección verificada correctamente (GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      coords: { lat, lng }
    });
    setLastVerifiedAddress(sug.display_name);
    setSuggestions([]);
    setSpellingSuggestions([]);
  };

  // Iniciar la búsqueda de dirección por dictado de voz (Web Speech API)
  const handleStartVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      triggerAlert('La búsqueda por voz no es compatible con tu navegador actual. Usa Chrome o Safari.', 'error');
      return;
    }

    if (isListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      triggerAlert('🎙️ Micrófono activado. Por favor, dicta la dirección...', 'info');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        setAddress(transcript);
        setAddressVerification({ status: 'idle', message: '' });
        
        // Verificar errores de ortografía en el texto dictado
        const corrections = getStreetSpellingSuggestions(transcript);
        setSpellingSuggestions(corrections);
        
        // Buscar sugerencias de mapas para el texto dictado
        fetchAddressSuggestions(transcript);
        triggerAlert('🎙️ Dirección capturada con éxito');
      }
    };

    recognition.onerror = (e) => {
      console.error("Speech recognition error:", e);
      if (e.error === 'not-allowed') {
        triggerAlert('Permiso de micrófono denegado. Habilita el acceso en tu navegador.', 'error');
      } else {
        triggerAlert('No se pudo entender la dirección. Intenta hablar más claro.', 'warning');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start SpeechRecognition:", err);
      setIsListening(false);
    }
  };

  const handleStartNameVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      triggerAlert('El dictado por voz no es compatible con tu navegador actual. Usa Chrome o Safari.', 'error');
      return;
    }

    if (isListeningName) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListeningName(true);
      triggerAlert('🎙️ Micrófono activado. Por favor, dicta el nombre del cliente...', 'info');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        const formattedName = formatCustomerName(transcript);
        setCustomerName(formattedName);
        triggerAlert('🎙️ Nombre de cliente capturado y formateado con éxito');
      }
    };

    recognition.onerror = (e) => {
      console.error("Speech recognition error:", e);
      if (e.error === 'not-allowed') {
        triggerAlert('Permiso de micrófono denegado. Habilita el acceso en tu navegador.', 'error');
      } else {
        triggerAlert('No se pudo entender el nombre. Intenta hablar más claro.', 'warning');
      }
    };

    recognition.onend = () => {
      setIsListeningName(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start SpeechRecognition:", err);
      setIsListeningName(false);
    }
  };

  const handleStartStartVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      triggerAlert('La búsqueda por voz no es compatible con tu navegador actual. Usa Chrome o Safari.', 'error');
      return;
    }

    if (isListeningStart) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListeningStart(true);
      triggerAlert('🎙️ Micrófono activado. Por favor, dicta la dirección de salida...', 'info');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        setRouteStartAddr(transcript);
        triggerAlert('🎙️ Dirección de salida capturada con éxito');
      }
    };

    recognition.onerror = (e) => {
      console.error("Speech recognition error:", e);
      if (e.error === 'not-allowed') {
        triggerAlert('Permiso de micrófono denegado. Habilita el acceso en tu navegador.', 'error');
      } else {
        triggerAlert('No se pudo entender la dirección. Intenta hablar más claro.', 'warning');
      }
    };

    recognition.onend = () => {
      setIsListeningStart(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start SpeechRecognition:", err);
      setIsListeningStart(false);
    }
  };

  const handleStartEndVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      triggerAlert('La búsqueda por voz no es compatible con tu navegador actual. Usa Chrome o Safari.', 'error');
      return;
    }

    if (isListeningEnd) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListeningEnd(true);
      triggerAlert('🎙️ Micrófono activado. Por favor, dicta la dirección de llegada...', 'info');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        setRouteEndAddr(transcript);
        triggerAlert('🎙️ Dirección de llegada capturada con éxito');
      }
    };

    recognition.onerror = (e) => {
      console.error("Speech recognition error:", e);
      if (e.error === 'not-allowed') {
        triggerAlert('Permiso de micrófono denegado. Habilita el acceso en tu navegador.', 'error');
      } else {
        triggerAlert('No se pudo entender la dirección. Intenta hablar más claro.', 'warning');
      }
    };

    recognition.onend = () => {
      setIsListeningEnd(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start SpeechRecognition:", err);
      setIsListeningEnd(false);
    }
  };

  const handleSelectMapTicket = (ticket) => {
    setSelectedMapTicket(ticket);
    setIsMapPanelExpanded(true);
    if (mapSelectTimerRef.current) {
      clearTimeout(mapSelectTimerRef.current);
    }
    mapSelectTimerRef.current = setTimeout(() => {
      setSelectedMapTicket(null);
    }, 8000);
  };

  const handleMoveTicketOrder = async (ticketId, direction) => {
    const currentList = getFilteredTickets();
    const idx = currentList.findIndex(t => t.id === ticketId);
    if (idx === -1) return;

    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === currentList.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const ticketA = currentList[idx];
    const ticketB = currentList[targetIdx];

    const updatedTickets = tickets.map(t => {
      if (t.date === ticketA.date && t.furgoId === ticketA.furgoId) {
        const itemIdx = currentList.findIndex(x => x.id === t.id);
        let order = t.routeOrder;
        if (order === undefined || order === null || order === '') {
          order = itemIdx + 1;
        }
        return { ...t, routeOrder: Number(order) };
      }
      return t;
    });

    const dbTicketA = updatedTickets.find(t => t.id === ticketA.id);
    const dbTicketB = updatedTickets.find(t => t.id === ticketB.id);

    if (dbTicketA && dbTicketB) {
      const tempOrder = dbTicketA.routeOrder;
      dbTicketA.routeOrder = dbTicketB.routeOrder;
      dbTicketB.routeOrder = tempOrder;
    }

    setTickets(updatedTickets);

    try {
      if (dbTicketA) await updateTicket(dbTicketA);
      if (dbTicketB) await updateTicket(dbTicketB);
    } catch (e) {
      console.error("Error saving manual route order:", e);
    }
  };

  // Reordenar un ticket manualmente a cualquier posición
  const changeTicketRouteOrder = async (ticketToMove, targetPos) => {
    if (targetPos < 1) return;

    // Obtener las paradas del mismo chofer y día
    const dayTickets = tickets
      .filter(t => t && t.date === ticketToMove.date && t.furgoId === ticketToMove.furgoId)
      .sort((a, b) => {
        const aOrd = a.routeOrder !== undefined && a.routeOrder !== null && a.routeOrder !== '' ? Number(a.routeOrder) : Infinity;
        const bOrd = b.routeOrder !== undefined && b.routeOrder !== null && b.routeOrder !== '' ? Number(b.routeOrder) : Infinity;
        return aOrd - bOrd;
      });

    const currentIndex = dayTickets.findIndex(t => t.id === ticketToMove.id);
    if (currentIndex === -1) return;

    // Quitar de la posición actual
    const [movedTicket] = dayTickets.splice(currentIndex, 1);
    
    // Validar límites
    let targetIdx = targetPos - 1;
    if (targetIdx < 0) targetIdx = 0;
    if (targetIdx > dayTickets.length) targetIdx = dayTickets.length;

    // Insertar en la nueva posición
    dayTickets.splice(targetIdx, 0, movedTicket);

    // Actualizar el orden secuencial
    const updatedTickets = tickets.map(t => {
      if (t && t.date === ticketToMove.date && t.furgoId === ticketToMove.furgoId) {
        const idx = dayTickets.findIndex(x => x.id === t.id);
        return { ...t, routeOrder: idx + 1 };
      }
      return t;
    });

    setTickets(updatedTickets);

    try {
      for (const t of updatedTickets) {
        if (t && t.date === ticketToMove.date && t.furgoId === ticketToMove.furgoId) {
          await updateTicket(t);
        }
      }
      triggerAlert(`📍 Parada reordenada con éxito a la posición ${targetPos}`);
    } catch (err) {
      console.error("Error saving manual route reorder:", err);
      triggerAlert("Error al guardar el nuevo orden de ruta", "error");
    }
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
        if (coords.postcode) {
          setPostcode(coords.postcode);
        }
        if (coords.displayName && coords.displayName.trim() !== trimmed) {
          setAddress(coords.displayName);
          setLastVerifiedAddress(coords.displayName);
        } else {
          setLastVerifiedAddress(trimmed);
        }
        setAddressVerification({ 
          status: 'success', 
          message: `🟢 Verificada como: ${coords.displayName || trimmed}`,
          coords
        });
      } else {
        setAddressVerification({ 
          status: 'warning', 
          message: '⚠️ Dirección no localizada en el mapa. Puedes continuar y guardar la parada de todas formas.' 
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

    if (duplicateWarning) {
      const confirmSave = window.confirm(
        `⚠️ DIRECCIÓN DUPLICADA DETECTADA\n\nYa existe una parada registrada para hoy (${ticketDate}) con esta misma dirección:\n- Cliente: ${duplicateWarning.clientName}\n- Ruta: ${duplicateWarning.routeName}\n- Chofer: ${duplicateWarning.driver}\n\n¿Estás seguro de que deseas guardar este reparto de todas formas?`
      );
      if (!confirmSave) return;
    }

    const checkFurgoId = editingTicketId ? editingFurgoId : currentUser.id;
    const isClosed = getShiftStatus(checkFurgoId, ticketDate) === 'closed';
    if (isClosed && !isAdminOrSuper) {
      triggerAlert('El turno para este día ya ha sido cerrado. No puedes guardar ni editar repartos para esta fecha.', 'error');
      return;
    }

    // Agrupar todas las tareas y calcular tarifas locales
    const tasksArray = [];

    // Validar que si la acción es "solo_pm" o "solo_cuelgue", se hayan seleccionado los servicios correspondientes
    let hasValidationError = false;
    formTvs.forEach(tv => {
      if (tv.action === 'solo_pm' && tv.pmType === 'none') {
        triggerAlert('Para un servicio de "Solo PM", debes seleccionar el tipo de Puesta en Marcha (Básica o Compleja)', 'error');
        hasValidationError = true;
      }
      if (tv.action === 'solo_cuelgue' && !tv.cuelgue) {
        triggerAlert('Para un servicio de "Solo Cuelgue", debes marcar la opción de Cuelgue en Pared', 'error');
        hasValidationError = true;
      }
    });
    if (hasValidationError) return;

    // 1. Añadir las TVs y sus servicios vinculados
    formTvs.forEach(tv => {
      const range = getTVRange(tv.inches);
      
      // Artículo principal TV
      if (tv.action !== 'solo_pm' && tv.action !== 'solo_cuelgue') {
        const mainTariffId = tv.action === 'combinado' ? `TV_COMB_${range}` : `TV_ENT_${range}`;
        tasksArray.push({
          tariffId: mainTariffId,
          quantity: 1,
          brand: tv.brand || 'Genérica',
          inches: tv.inches || 43
        });
      }

      // PM
      if (tv.pmType !== 'none') {
        const pmId = tv.pmType === 'basic' ? `PM_BAS_${range}` : `PM_COMP_${range}`;
        tasksArray.push({
          tariffId: pmId,
          quantity: 1,
          brand: tv.brand || 'Genérica',
          inches: tv.inches || 43
        });
      }

      // Cuelgue
      if (tv.cuelgue) {
        const cuelgueId = `CUELGUE_${range}`;
        tasksArray.push({
          tariffId: cuelgueId,
          quantity: 1,
          brand: tv.brand || 'Genérica',
          inches: tv.inches || 43
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
        const isPaqueteria = ['ENTREGA_PV', 'ENTREGA_GV', 'RECOGIDA_PV', 'RECOGIDA_GV'].includes(tariffId);
        if (isPaqueteria) {
          const descs = otherDescriptions[tariffId] || [];
          for (let i = 0; i < quantity; i++) {
            const desc = descs[i] || 'Mercancía';
            const originalTariff = tariffs.find(t => t.id === tariffId);
            tasksArray.push({
              tariffId,
              quantity: 1,
              name: `${originalTariff?.name || 'Paquetería'} (${desc})`
            });
          }
        } else {
          tasksArray.push({
            tariffId,
            quantity
          });
        }
      }
    });

    // 3. Añadir conceptos adicionales (extras personalizados)
    customExtras.forEach(extra => {
      tasksArray.push({
        tariffId: extra.id,
        name: extra.name,
        price: extra.price,
        quantity: 1
      });
    });

    // 4. Añadir Servicio Urgente si aplica
    if (urgenteType === '100') {
      tasksArray.push({
        tariffId: 'URGENTE_100',
        quantity: 1
      });
    } else if (urgenteType === '120') {
      tasksArray.push({
        tariffId: 'URGENTE_120',
        quantity: 1
      });
    }

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
    const assignedFurgoId = currentUser?.role === 'repartidor'
      ? currentUser.id
      : (targetUser ? targetUser.id : (editingTicketId ? editingFurgoId : currentUser.id));

    let finalNotes = notes.trim();
    finalNotes = encodeTicketNotes(timeSlot, estimatedDuration, finalNotes);
    if (originalRouteLabel) {
      finalNotes = `[Ruta Original: ${originalRouteLabel}] ${finalNotes}`.trim();
    }

    // Datos del ticket estructurados
    const ticketData = {
      id: editingTicketId || undefined,
      furgoId: assignedFurgoId,
      date: ticketDate,
      customerName: formatCustomerName(customerName).trim(),
      phone: phone.trim(),
      address: address.trim(),
      postcode: postcode.trim(),
      notes: finalNotes,
      codAmount: parseFloat(codAmount) || 0,
      tasks: tasksArray,
      routeName: routeName || undefined,
      createdBy: editingTicketId ? undefined : (currentUser?.id || 'admin')
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
      loadData();
    } else {
      addTicket(ticketData);
      triggerAlert('Registro guardado con éxito');
      // Resetear
      setCustomerName('');
      setPhone('');
      setAddress('');
      setPostcode('');
      setAddressVerification({ status: 'idle', message: '' });
      setLastVerifiedAddress('');
      setFormTvs([]);
      setOtherQuantities({});
      setCustomExtras([]);
      setCustomExtraName('');
      setCustomExtraPrice('');
      setUrgenteType('none');
      setNotes('');
      setTimeSlot('any');
      setEstimatedDuration(10);
      setIsDurationManuallyEdited(false);
      setCodAmount('');
      setShowHelperRoute(false);
      setShowCod(false);
      setOriginalRouteLabel('');
      if (activeRouteContext) {
        setTicketDate(activeRouteContext.date);
        setTicketRoute(activeRouteContext.furgoId);
        setRouteName(activeRouteContext.name);
      } else {
        setTicketDate(new Date().toISOString().split('T')[0]);
        setTicketRoute('');
        setRouteName('');
      }
      setSpellingSuggestions([]);
      setFormStep(1);
      loadData();
    }
  };

  const handleOptimizeRoute = async () => {
    const targetFurgo = currentUser.role === 'repartidor' ? currentUser.id : (activeTab === 'tickets' ? ticketFilterFurgo : mapFilterFurgo);
    const targetDate = currentUser.role === 'repartidor' ? (shiftSummaryDate || new Date().toISOString().split('T')[0]) : (activeTab === 'tickets' ? ticketFilterDate : mapFilterDate);

    if (!targetFurgo || targetFurgo === 'all') {
      triggerAlert('Por favor, selecciona una furgoneta específica para optimizar su ruta.', 'error');
      return;
    }
    
    if (!targetDate) {
      triggerAlert('Por favor, selecciona una fecha para optimizar la ruta.', 'error');
      return;
    }

    const dayTickets = tickets.filter(t => t && t.furgoId === targetFurgo && t.date === targetDate);
    if (dayTickets.length === 0) {
      triggerAlert('No hay paradas planificadas para este conductor en la fecha seleccionada.', 'error');
      return;
    }

    setIsOptimizing(true);
    
    saveRouteStartAddr(routeStartAddr, currentUser.id);
    saveRouteEndAddr(routeEndAddr, currentUser.id);

    try {
      let startCoords = null;
      if (routeStartAddr.trim()) {
        const startGeocoded = await geocodeAddress(routeStartAddr);
        if (startGeocoded && startGeocoded.lat && startGeocoded.lng) {
          startCoords = { lat: parseFloat(startGeocoded.lat), lng: parseFloat(startGeocoded.lng) };
        } else {
          startCoords = { lat: 41.3879, lng: 2.16992 };
          triggerAlert('No se pudo geolocalizar el punto de partida. Usando ubicación por defecto (Barcelona).', 'warning');
        }
      } else {
        startCoords = { lat: 41.3879, lng: 2.16992 };
      }

      let endCoords = null;
      if (routeEndAddr.trim()) {
        const endGeocoded = await geocodeAddress(routeEndAddr);
        if (endGeocoded && endGeocoded.lat && endGeocoded.lng) {
          endCoords = { lat: parseFloat(endGeocoded.lat), lng: parseFloat(endGeocoded.lng) };
        } else {
          endCoords = startCoords;
        }
      } else {
        endCoords = startCoords;
      }

      const ticketsWithCoords = [];
      for (const t of dayTickets) {
        let lat = t.lat ? parseFloat(t.lat) : null;
        let lng = t.lng ? parseFloat(t.lng) : null;
        
        if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
          const res = await geocodeAddress(t.address);
          if (res && res.lat && res.lng) {
            lat = parseFloat(res.lat);
            lng = parseFloat(res.lng);
            t.lat = lat;
            t.lng = lng;
            updateTicket(t);
          }
        }
        
        if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
          ticketsWithCoords.push({ ...t, lat, lng });
        } else {
          ticketsWithCoords.push({ ...t, lat: startCoords.lat, lng: startCoords.lng });
        }
      }

      const getDistance = (c1, c2) => {
        const R = 6371;
        const dLat = (c2.lat - c1.lat) * Math.PI / 180;
        const dLng = (c2.lng - c1.lng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) * 
          Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      const parsedTickets = ticketsWithCoords.map(t => {
        const parsed = parseTicketNotes(t.notes);
        return { ...t, timeSlot: parsed.timeSlot, estimatedDuration: parsed.estimatedDuration };
      });

      const morningTickets = parsedTickets.filter(t => t.timeSlot === 'morning');
      const anyTickets = parsedTickets.filter(t => t.timeSlot === 'any' || !t.timeSlot);
      const afternoonTickets = parsedTickets.filter(t => t.timeSlot === 'afternoon');

      const route = [];
      let currentPos = startCoords;

      const optimizeGroup = (group) => {
        const unvisited = [...group];
        while (unvisited.length > 0) {
          let nearestIdx = -1;
          let minDistance = Infinity;

          for (let i = 0; i < unvisited.length; i++) {
            const dist = getDistance(currentPos, unvisited[i]);
            if (dist < minDistance) {
              minDistance = dist;
              nearestIdx = i;
            }
          }

          if (nearestIdx !== -1) {
            const nextTicket = unvisited.splice(nearestIdx, 1)[0];
            route.push(nextTicket);
            currentPos = { lat: nextTicket.lat, lng: nextTicket.lng };
          } else {
            break;
          }
        }
      };

      optimizeGroup(morningTickets);
      optimizeGroup(anyTickets);
      optimizeGroup(afternoonTickets);

      route.forEach((ticket, index) => {
        ticket.routeOrder = index + 1;
        updateTicket(ticket);
      });

      triggerAlert(`¡Ruta optimizada con éxito! ${route.length} paradas ordenadas de forma eficiente.`, 'success');
      loadData();
    } catch (err) {
      console.error(err);
      triggerAlert('Ocurrió un error al optimizar la ruta.', 'error');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSaveMapSettings = () => {
    localStorage.setItem('search_country_code', searchCountryCode);
    localStorage.setItem('search_city_bias', searchCityBias);
    localStorage.setItem('search_strict_city', searchStrictCity ? 'true' : 'false');
    triggerAlert('Ajustes geográficos del mapa guardados con éxito', 'success');
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
    setPostcode(ticket.postcode || '');
    setAddressVerification(ticket.lat ? { 
      status: 'success', 
      message: '🟢 Dirección verificada en el mapa',
      coords: { lat: ticket.lat, lng: ticket.lng }
    } : { status: 'idle', message: '' });
    setLastVerifiedAddress(ticket.lat ? ticket.address : '');
    setTicketDate(ticket.date);
    let parsedNotes = ticket.notes || '';
    let origLabel = '';
    if (parsedNotes.startsWith('[Ruta Original: ')) {
      const endIdx = parsedNotes.indexOf(']');
      if (endIdx !== -1) {
        origLabel = parsedNotes.substring(16, endIdx).trim();
        parsedNotes = parsedNotes.substring(endIdx + 1).trim();
      }
    }
    setOriginalRouteLabel(origLabel);
    setShowHelperRoute(!!origLabel);
    
    // Parsear franja horaria y duración
    const parsed = parseTicketNotes(parsedNotes);
    setTimeSlot(parsed.timeSlot);
    setEstimatedDuration(parsed.estimatedDuration);
    setIsDurationManuallyEdited(true);
    setNotes(parsed.cleanNotes);
    setShowCod(ticket.codAmount > 0);
    setTicketRoute(ticket.furgoLabel || users.find(u => u.id === ticket.furgoId)?.label || ticket.furgoId);

    // Reconstruir TVs y otros artículos a partir de las tareas guardadas en el ticket
    const tempTvs = [];
    const tempOthers = {};

    const tvMainTasks = ticket.tasks.filter(t => t.tariffId.startsWith('TV_ENT_') || t.tariffId.startsWith('TV_COMB_'));
    const pmTasks = ticket.tasks.filter(t => t.tariffId.startsWith('PM_') && t.tariffId !== 'PM_BSND');
    const cuelgueTasks = ticket.tasks.filter(t => t.tariffId.startsWith('CUELGUE_') && t.tariffId !== 'CUELGUE_BSND');
    const viejaTasks = ticket.tasks.filter(t => t.tariffId === 'TV_VIEJA_URB' || t.tariffId === 'TV_VIEJA_NO_URB');

    let pmIndex = 0;
    let cuelgueIndex = 0;
    let viejaIndex = 0;

    tvMainTasks.forEach((mTask, idx) => {
      const isComb = mTask.tariffId.includes('COMB');
      let range = '49';
      if (mTask.tariffId.includes('74')) range = '74';
      if (mTask.tariffId.includes('115')) range = '115';

      const inchMatch = mTask.name.match(/TV (\d+)"/);
      const inches = inchMatch ? parseInt(inchMatch[1]) : (range === '49' ? 43 : range === '74' ? 55 : 75);

      let pmType = 'none';
      if (pmIndex < pmTasks.length) {
        const pmMatch = pmTasks[pmIndex++];
        pmType = pmMatch.tariffId.includes('BAS') ? 'basic' : 'complex';
      }

      let cuelgue = false;
      if (cuelgueIndex < cuelgueTasks.length) {
        cuelgueIndex++;
        cuelgue = true;
      }

      let recogidaViejaType = 'none';
      if (viejaIndex < viejaTasks.length) {
        const viejaMatch = viejaTasks[viejaIndex++];
        recogidaViejaType = viejaMatch.tariffId.includes('URB') && !viejaMatch.tariffId.includes('NO_URB') ? 'urbantz' : 'no_urbantz';
      }

      tempTvs.push({
        id: 'tv_' + idx + Date.now().toString(),
        inches,
        action: isComb ? 'combinado' : (mTask.name.includes('Recogida') && !mTask.name.includes('Entrega') ? 'recogida' : 'entrega'),
        pmType,
        cuelgue,
        recogidaViejaType
      });
    });

    while (pmIndex < pmTasks.length) {
      const pmMatch = pmTasks[pmIndex++];
      let range = '49';
      if (pmMatch.tariffId.includes('74')) range = '74';
      if (pmMatch.tariffId.includes('115')) range = '115';
      const inches = range === '49' ? 43 : range === '74' ? 55 : 75;

      const pmType = pmMatch.tariffId.includes('BAS') ? 'basic' : 'complex';

      let cuelgue = false;
      if (cuelgueIndex < cuelgueTasks.length) {
        cuelgueIndex++;
        cuelgue = true;
      }

      let recogidaViejaType = 'none';
      if (viejaIndex < viejaTasks.length) {
        const viejaMatch = viejaTasks[viejaIndex++];
        recogidaViejaType = viejaMatch.tariffId.includes('URB') && !viejaMatch.tariffId.includes('NO_URB') ? 'urbantz' : 'no_urbantz';
      }

      tempTvs.push({
        id: 'tv_pm_' + pmIndex + Date.now().toString(),
        inches,
        action: 'solo_pm',
        pmType,
        cuelgue,
        recogidaViejaType
      });
    }

    while (cuelgueIndex < cuelgueTasks.length) {
      const cuelgueMatch = cuelgueTasks[cuelgueIndex++];
      let range = '49';
      if (cuelgueMatch.tariffId.includes('74')) range = '74';
      if (cuelgueMatch.tariffId.includes('115')) range = '115';
      const inches = range === '49' ? 43 : range === '74' ? 55 : 75;

      let recogidaViejaType = 'none';
      if (viejaIndex < viejaTasks.length) {
        const viejaMatch = viejaTasks[viejaIndex++];
        recogidaViejaType = viejaMatch.tariffId.includes('URB') && !viejaMatch.tariffId.includes('NO_URB') ? 'urbantz' : 'no_urbantz';
      }

      tempTvs.push({
        id: 'tv_cuelgue_' + cuelgueIndex + Date.now().toString(),
        inches,
        action: 'solo_cuelgue',
        pmType: 'none',
        cuelgue: true,
        recogidaViejaType
      });
    }

    const tempCustomExtras = [];
    const tempDescriptions = {};
    let localUrgente = 'none';

    // Reconstruir otros artículos no-TV y sus descripciones de paquetería
    ticket.tasks.forEach(t => {
      if (t.tariffId === 'URGENTE_100') {
        localUrgente = '100';
        return;
      }
      if (t.tariffId === 'URGENTE_120') {
        localUrgente = '120';
        return;
      }
      if (t.tariffId && t.tariffId.startsWith('CUSTOM_')) {
        tempCustomExtras.push({
          id: t.tariffId,
          name: t.name,
          price: t.unitPrice || t.price || 0
        });
        return;
      }
      const isTVRelated = (t.tariffId.startsWith('TV_ENT_') || 
                          t.tariffId.startsWith('TV_COMB_') || 
                          t.tariffId.startsWith('PM_') || 
                          t.tariffId.startsWith('CUELGUE_') || 
                          t.tariffId === 'TV_VIEJA_URB' || 
                          t.tariffId === 'TV_VIEJA_NO_URB') &&
                          t.tariffId !== 'PM_BSND' &&
                          t.tariffId !== 'CUELGUE_BSND';

      if (!isTVRelated) {
        tempOthers[t.tariffId] = (tempOthers[t.tariffId] || 0) + t.quantity;
        const isPaqueteria = ['ENTREGA_PV', 'ENTREGA_GV', 'RECOGIDA_PV', 'RECOGIDA_GV'].includes(t.tariffId);
        if (isPaqueteria) {
          const match = t.name ? t.name.match(/\(([^)]+)\)/) : null;
          const desc = match ? match[1] : 'Mercancía';
          if (!tempDescriptions[t.tariffId]) tempDescriptions[t.tariffId] = [];
          for (let i = 0; i < t.quantity; i++) {
            tempDescriptions[t.tariffId].push(desc);
          }
        }
      }
    });

    setFormTvs(tempTvs);
    setOtherQuantities(tempOthers);
    setOtherDescriptions(tempDescriptions);
    setCustomExtras(tempCustomExtras);
    setUrgenteType(localUrgente);
    setCodAmount(ticket.codAmount ? ticket.codAmount.toString() : '');
    setFormStep(1);
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
    setPostcode('');
    setFormTvs([]);
    setOtherQuantities({});
    setCustomExtras([]);
    setCustomExtraName('');
    setCustomExtraPrice('');
    setUrgenteType('none');
    setNotes('');
    setTimeSlot('any');
    setEstimatedDuration(10);
    setIsDurationManuallyEdited(false);
    setCodAmount('');
    setTicketRoute(currentUser ? currentUser.label : '');
    setOriginalRouteLabel('');
    setShowHelperRoute(false);
    setShowCod(false);
    setTicketDate(new Date().toISOString().split('T')[0]);
    setSpellingSuggestions([]);
    setFormStep(1);
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
    saveModulePrice(val, currentUser?.id);
    setModulePrice(val);
    recalculateAllTickets(tariffs, val);
  };

  const handleUpdateKmPrice = (newPrice) => {
    const val = parseFloat(newPrice) || 0;
    saveKmPrice(val, currentUser?.id);
    setKmPrice(val);
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
      const kms = parseFloat(shiftKmsInput) || 0;
      saveRouteKms(furgoId, date, kms);
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

  const handleUpdateUser = (id, newLabel, newPassword) => {
    if (!newLabel.trim()) {
      triggerAlert('El nombre visible no puede estar vacío', 'error');
      return;
    }
    if (!newPassword.trim()) {
      triggerAlert('La contraseña no puede estar vacía', 'error');
      return;
    }
    const updated = users.map(u => (u.id === id ? { ...u, label: newLabel.trim(), password: newPassword.trim() } : u));
    saveUsers(updated);
    setUsers(updated);
    triggerAlert('Datos de usuario actualizados correctamente');
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

  const handleUpdateTicketTvSize = (ticketId, oldRange, newRange) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const updatedTasks = ticket.tasks.map(task => {
      if (task.tariffId.endsWith(`_${oldRange}`)) {
        const prefix = task.tariffId.substring(0, task.tariffId.length - oldRange.length - 1);
        const newTariffId = `${prefix}_${newRange}`;
        const tariff = tariffs.find(tar => tar.id === newTariffId);
        if (tariff) {
          let name = tariff.name;
          if (newTariffId.startsWith('TV_ENT_') || newTariffId.startsWith('TV_COMB_')) {
            const approxInches = newRange === '49' ? 43 : newRange === '74' ? 55 : 75;
            const actionText = newTariffId.startsWith('TV_COMB_') ? 'Entrega + Recogida' : 'Entrega';
            name = `TV ${approxInches}" (${actionText})`;
          }
          return {
            ...task,
            tariffId: newTariffId,
            name: name
          };
        }
      }
      return task;
    });

    let totalCalculado = 0;
    const finalTasks = updatedTasks.map(task => {
      const tariff = tariffs.find(t => t.id === task.tariffId);
      if (!tariff) return task;
      const price = tariff.type === 'fixed' ? tariff.value : tariff.value * modulePrice;
      return {
        ...task,
        unitPrice: price,
        subtotal: price * task.quantity
      };
    });
    totalCalculado = finalTasks.reduce((sum, t) => sum + t.subtotal, 0);

    const updatedTicket = {
      ...ticket,
      tasks: finalTasks,
      totalPrice: totalCalculado
    };

    updateTicket(ticketId, updatedTicket);
    triggerAlert('Medida de TV actualizada y módulos recalculados');
    loadData();
  };

  const handleStartTransit = (id) => {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    updateTicketStatus(id, 'transit', '');
    loadData();
    triggerAlert('Iniciando viaje de reparto. ¡Buen viaje!', 'success');

    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ticket.address)}`;
    window.open(url, '_blank');
  };

  const handleNavigateFullRoute = () => {
    if (!currentUser || currentUser.role !== 'repartidor') return;

    const targetDate = shiftSummaryDate || new Date().toISOString().split('T')[0];
    const userTickets = tickets.filter(t => t.furgoId === currentUser.id && t.date === targetDate);
    
    if (userTickets.length === 0) {
      triggerAlert('No tienes paradas planificadas para hoy.', 'error');
      return;
    }

    const sorted = sortTicketsByRouteOrder(userTickets);
    const startAddr = routeStartAddr.trim() || 'Madrid, España';
    const endAddr = routeEndAddr.trim() || '';

    let origin = startAddr;
    let destination = '';
    let waypoints = [];

    if (endAddr) {
      destination = endAddr;
      waypoints = sorted.map(t => t.address);
    } else {
      if (sorted.length === 1) {
        destination = sorted[0].address;
      } else {
        destination = sorted[sorted.length - 1].address;
        waypoints = sorted.slice(0, sorted.length - 1).map(t => t.address);
      }
    }

    if (waypoints.length > 9) {
      waypoints = waypoints.slice(0, 9);
      triggerAlert('La ruta completa incluye más de 9 paradas. Se mostrarán las primeras 9 en el mapa de navegación.', 'warning');
    }

    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints.length > 0) {
      url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
    }
    url += '&travelmode=driving';

    window.open(url, '_blank');
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

    // Resumen General (Solo suma ganancias de repartos con Éxito y kilometraje)
    const successTickets = filteredTickets.filter(t => t.status === 'success' || !t.status);
    const furgos = activeRepartidores.map(u => u.id);

    let totalKms = 0;
    let totalMileageEarnings = 0;
    furgos.forEach(fid => {
      const fShifts = shifts.filter(s => 
        s.furgoId === fid && 
        s.status === 'closed' &&
        (!adminStartDate || s.date >= adminStartDate) &&
        (!adminEndDate || s.date <= adminEndDate)
      );
      fShifts.forEach(s => {
        const kms = getRouteKms(fid, s.date);
        totalKms += kms;
        totalMileageEarnings += kms * kmPrice;
      });
    });

    const totalBaseEarnings = successTickets.reduce((sum, t) => sum + t.totalPrice, 0);
    const totalEarnings = totalBaseEarnings + totalMileageEarnings;
    const totalIVA = totalEarnings * 0.21;
    const totalRetencion = totalEarnings * 0.01;
    const totalNet = totalEarnings + totalIVA - totalRetencion;
    const totalCOD = successTickets.reduce((sum, t) => sum + (t.codAmount || 0), 0);

    const summaryData = [
      [`CONTROL DE FACTURACIÓN DE REPARTOS (Periodo: ${adminStartDate || 'inicio'} a ${adminEndDate || 'hoy'})`],
      [],
      ['Facturación Total Acumulada (Base Imponible + Kms)', `${totalEarnings.toFixed(2)} €`],
      ['  - Base Imponible Servicios', `${totalBaseEarnings.toFixed(2)} €`],
      ['  - Importe por Kilometraje', `${totalMileageEarnings.toFixed(2)} € (Total: ${totalKms.toFixed(1)} km)`],
      ['IVA Acumulado (+21%)', `${totalIVA.toFixed(2)} €`],
      ['Retención Acumulada (-1%)', `${totalRetencion.toFixed(2)} €`],
      ['Total Neto Facturado', `${totalNet.toFixed(2)} €`],
      ['Total Paradas Planificadas', filteredTickets.length],
      ['Total Entregas con Éxito (Facturadas)', successTickets.length],
      ['Total Reembolsos Cobrados', `${totalCOD.toFixed(2)} €`],
      [],
      ['Furgoneta', 'Paradas Planificadas', 'Entregas Éxito', 'Kilómetros Recorridos', 'Importe Kilometraje (€)', 'Base Imponible (€)', 'IVA 21% (€)', 'Retención 1% (€)', 'Total Neto (€)', 'Reembolsos Cobrados (€)'],
    ];

    furgos.forEach(fid => {
      const fTickets = filteredTickets.filter(t => t.furgoId === fid);
      const fSuccess = fTickets.filter(t => t.status === 'success' || !t.status);
      const label = users.find(u => u.id === fid)?.label || fid;

      const fShifts = shifts.filter(s => 
        s.furgoId === fid && 
        s.status === 'closed' &&
        (!adminStartDate || s.date >= adminStartDate) &&
        (!adminEndDate || s.date <= adminEndDate)
      );
      let fKms = 0;
      fShifts.forEach(s => {
        fKms += getRouteKms(fid, s.date);
      });
      const fMileageEarnings = fKms * kmPrice;

      const earnings = fSuccess.reduce((sum, t) => sum + t.totalPrice, 0) + fMileageEarnings;
      const iva = earnings * 0.21;
      const ret = earnings * 0.01;
      const net = earnings + iva - ret;
      const fCod = fSuccess.reduce((sum, t) => sum + (t.codAmount || 0), 0);
      summaryData.push([
        label, 
        fTickets.length, 
        fSuccess.length,
        `${fKms.toFixed(1)} km`,
        `${fMileageEarnings.toFixed(2)} €`,
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
      if (ticketFilterPostcode.trim()) {
        const queryPostcode = ticketFilterPostcode.trim();
        const postcodeMatch = t.postcode ? t.postcode.includes(queryPostcode) : false;
        const addressPostcodeMatch = t.address ? t.address.includes(queryPostcode) : false;
        if (!postcodeMatch && !addressPostcodeMatch) return false;
      }
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
      const aOrder = a.routeOrder !== undefined && a.routeOrder !== null && a.routeOrder !== '' ? Number(a.routeOrder) : Infinity;
      const bOrder = b.routeOrder !== undefined && b.routeOrder !== null && b.routeOrder !== '' ? Number(b.routeOrder) : Infinity;
      if (aOrder !== Infinity || bOrder !== Infinity) {
        if (aOrder !== bOrder) return aOrder - bOrder;
      }
      const dateA = a.createdAt || '';
      const dateB = b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
  };

  const isSingleRouteFiltered = ticketFilterFurgo !== 'all' && ticketFilterDate && !ticketSearchQuery.trim() && !ticketFilterPostcode.trim();


  const renderCreateRouteStartButton = () => {
    return (
      <div 
        className="glass-panel" 
        style={{ 
          textAlign: 'center', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '30px 20px', 
          gap: '12px',
          maxWidth: '340px',
          width: '100%',
          margin: '20px auto'
        }}
      >
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--primary)',
          boxShadow: '0 0 20px rgba(99, 102, 241, 0.2)',
          marginBottom: '5px'
        }}>
          <Plus size={32} />
        </div>
        <h2 style={{ margin: 0, fontWeight: '700' }}>Gestiona paradas</h2>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowCreateRouteFormFields(true)}
          style={{ width: 'auto', minWidth: '200px', height: '45px', marginTop: '5px' }}
        >
          🚀 Crear Ruta
        </button>
      </div>
    );
  };

  const renderCreateRouteForm = () => {
    if (!showCreateRouteFormFields) {
      return renderCreateRouteStartButton();
    }

    const activeRepartidores = users.filter(u => u.role === 'repartidor');

    const handleCreateRouteSubmit = (e) => {
      e.preventDefault();
      const cleanName = newRouteName.trim();
      if (!cleanName) {
        triggerAlert('Por favor, introduce un nombre para la ruta', 'error');
        return;
      }
      
      const selectedFurgoId = currentUser?.role === 'repartidor' 
        ? currentUser.id 
        : (newRouteFurgoId || (activeRepartidores[0]?.id || ''));
      if (!selectedFurgoId) {
        triggerAlert('Por favor, asigna una furgoneta o chofer', 'error');
        return;
      }

      const newRoute = {
        id: `${cleanName}|${newRouteDate}|${selectedFurgoId}`,
        name: cleanName,
        date: newRouteDate,
        furgoId: selectedFurgoId
      };

      setActiveRoutes(prev => [...prev, newRoute]);
      setCurrentRouteId(newRoute.id);
      setShowCreateRouteFormFields(false);

      // Pre-fill fields for the ticket form
      setTicketDate(newRouteDate);
      setTicketRoute(selectedFurgoId);
      setRouteName(cleanName);
      setFormStep(1);
      
      // Reset creation inputs
      setNewRouteName('');
      
      triggerAlert(`🚀 Ruta "${cleanName}" creada. Ahora añade las paradas.`);
    };

    return (
      <div className="glass-panel" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          <Plus size={24} color="var(--primary)" /> 
          Crear Nueva Ruta
        </h2>

        <form onSubmit={handleCreateRouteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div className="input-group">
            <span className="input-label">Nombre de la Ruta</span>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Ej: Ruta Sabadell, Ruta Norte, Ruta Especial..."
              value={newRouteName}
              onChange={(e) => setNewRouteName(e.target.value)}
              required
            />
          </div>

          <div className="grid-2col">
            <div className="input-group">
              <span className="input-label">Fecha de la Ruta</span>
              <input 
                type="date" 
                className="form-input" 
                value={newRouteDate}
                onChange={(e) => setNewRouteDate(e.target.value)}
                required
              />
            </div>

            {currentUser?.role !== 'repartidor' && (
              <div className="input-group">
                <span className="input-label">Asignar Chofer / Furgoneta</span>
                <select 
                  className="form-input" 
                  value={newRouteFurgoId}
                  onChange={(e) => setNewRouteFurgoId(e.target.value)}
                  required
                >
                  <option value="" disabled>Selecciona furgoneta...</option>
                  {activeRepartidores.map(u => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                if (activeRoutes.length > 0) {
                  const last = activeRoutes[activeRoutes.length - 1];
                  setCurrentRouteId(last.id);
                  setTicketDate(last.date);
                  setTicketRoute(last.furgoId);
                  setRouteName(last.name);
                }
                setShowCreateRouteFormFields(false);
              }}
              style={{ width: 'auto', padding: '0 20px', height: '42px', margin: 0 }}
            >
              Atrás
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ flex: 1, height: '42px', margin: 0 }}
            >
              🚀 Empezar a Añadir Paradas
            </button>
          </div>
        </form>
      </div>
    );
  };

  // --- RENDERIZADO DEL FORMULARIO ---
  const renderTicketForm = () => {
    const displayedActiveRoutes = currentUser?.role === 'repartidor'
      ? activeRoutes.filter(r => r.furgoId === currentUser.id)
      : activeRoutes;

    if (!activeRouteContext && !editingTicketId) {
      return renderCreateRouteForm();
    }

    const itemsPaqueteria = tariffs.filter(t => t.block === 'Paquetería');
    const itemsOtros = tariffs.filter(t => {
      const isTvInstallation = t.id.startsWith('PM_BAS_') || t.id.startsWith('PM_COMP_') || t.id.startsWith('CUELGUE_');
      return t.block === 'Otros' || (t.block === 'Instalaciones' && !isTvInstallation);
    });

    const activeCheckFurgo = editingTicketId ? editingFurgoId : currentUser.id;
    const isClosed = getShiftStatus(activeCheckFurgo, ticketDate) === 'closed' && !isAdminOrSuper;

    return (
      <form onSubmit={handleFormSubmit} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {activeRouteContext && !editingTicketId && (
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.9rem',
            textAlign: 'left',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div>
              <span style={{ fontWeight: '700', color: 'var(--primary)', marginRight: '6px' }}>📍 Ruta Activa:</span>
              <select
                className="form-input"
                value={currentRouteId || ''}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  if (selectedId === 'new') {
                    setCurrentRouteId(null);
                    setShowCreateRouteFormFields(true);
                  } else {
                    setCurrentRouteId(selectedId);
                    const r = activeRoutes.find(x => x.id === selectedId);
                    if (r) {
                      setTicketDate(r.date);
                      setTicketRoute(r.furgoId);
                      setRouteName(r.name);
                    }
                  }
                }}
                style={{ 
                  width: 'auto', 
                  minWidth: '180px',
                  padding: '4px 10px', 
                  fontSize: '0.85rem', 
                  margin: 0,
                  height: '32px',
                  display: 'inline-block',
                  background: 'var(--input-bg)',
                  borderColor: 'var(--input-border)',
                  color: 'var(--text-main)'
                }}
              >
                {displayedActiveRoutes.map(r => (
                  <option key={r.id} value={r.id} style={{ background: 'var(--panel-bg)', color: 'var(--text-main)' }}>
                    {r.name} ({r.date})
                  </option>
                ))}
                <option value="new" style={{ background: 'var(--panel-bg)', fontWeight: 'bold', color: 'var(--primary)' }}>
                  ➕ Crear Otra Ruta...
                </option>
              </select>
              <br />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                🚚 Chofer: {users.find(u => u.id === activeRouteContext.furgoId)?.label || activeRouteContext.furgoId} 
                • Paradas en esta ruta: {tickets.filter(t => t.date === activeRouteContext.date && t.furgoId === activeRouteContext.furgoId).length}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => {
                if (window.confirm(`¿Seguro que quieres finalizar y cerrar la ruta "${activeRouteContext.name}"? Se quitará de la lista de rutas activas y se cerrará el turno de este chofer.`)) {
                  // Generar resumen y cerrar turno
                  const summary = getShiftSummary(activeRouteContext.furgoId, activeRouteContext.date);
                  closeShift(activeRouteContext.furgoId, activeRouteContext.date, summary);

                  const remaining = activeRoutes.filter(r => r.id !== currentRouteId);
                  setActiveRoutes(remaining);
                  const nextRoute = remaining[remaining.length - 1];
                  if (nextRoute) {
                    setCurrentRouteId(nextRoute.id);
                    setTicketDate(nextRoute.date);
                    setTicketRoute(nextRoute.furgoId);
                    setRouteName(nextRoute.name);
                  } else {
                    setCurrentRouteId(null);
                    setTicketDate(new Date().toISOString().split('T')[0]);
                    setTicketRoute('');
                    setRouteName('');
                  }
                  triggerAlert('Ruta finalizada, turno cerrado y resumen diario generado con éxito');
                }
              }}
              style={{ width: 'auto', margin: 0, padding: '6px 12px' }}
            >
              Finalizar esta Ruta
            </button>
          </div>
        )}

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

        {/* Barra de Pasos (Step Indicator) */}
        <div className="step-bar">
          <div 
            className={`step-node ${formStep === 1 ? 'active' : formStep > 1 ? 'completed' : ''}`}
            onClick={() => formStep > 1 && setFormStep(1)}
            style={{ cursor: formStep > 1 ? 'pointer' : 'default' }}
          >
            <span className="step-circle">1</span>
            <span>Datos de Entrega</span>
          </div>
          <div style={{ flex: 1, height: '2px', background: 'rgba(255,255,255,0.05)', minWidth: '20px' }}></div>
          <div 
            className={`step-node ${formStep === 2 ? 'active' : ''}`}
            onClick={() => {
              if (customerName.trim() && address.trim() && (ticketRoute || currentUser?.role === 'repartidor' || isAdminOrSuper)) {
                setFormStep(2);
              }
            }}
            style={{ cursor: (customerName.trim() && address.trim() && (ticketRoute || currentUser?.role === 'repartidor' || isAdminOrSuper)) ? 'pointer' : 'not-allowed' }}
          >
            <span className="step-circle">2</span>
            <span>Mercancía y Cierre</span>
          </div>
        </div>

        {/* PASO 1: CLIENTE Y GEOLOCALIZACIÓN */}
        {formStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
            {(!activeRouteContext || editingTicketId) ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <span className="input-label">Fecha</span>
                  <input type="date" className="form-input" value={ticketDate} onChange={(e) => setTicketDate(e.target.value)} required disabled={isClosed} />
                </div>

                {currentUser?.role !== 'repartidor' && (
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <span className="input-label">{editingTicketId ? 'Furgoneta asignada' : 'Asignar a la Furgoneta'}</span>
                    <select 
                      className="form-input" 
                      value={editingTicketId ? editingFurgoId : ticketRoute} 
                      onChange={(e) => {
                        if (editingTicketId) {
                          setEditingFurgoId(e.target.value);
                        } else {
                          setTicketRoute(e.target.value);
                        }
                      }} 
                      required
                      disabled={isClosed}
                    >
                      <option value="">Selecciona Chofer / Furgoneta...</option>
                      {activeRepartidores.map(u => (
                        <option key={u.id} value={u.id}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : null}

            {/* 1. Dirección Primero */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
              <div className="input-group" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="input-label">Dirección</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {!!(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                      <button
                        type="button"
                        onClick={handleStartVoiceSearch}
                        className={`btn btn-small ${isListening ? 'btn-danger' : 'btn-secondary'}`}
                        style={{ 
                          width: 'auto', margin: 0, padding: '2px 8px', fontSize: '0.7rem', height: '20px',
                          display: 'flex', alignItems: 'center', gap: '3px',
                          background: isListening ? '#ef4444' : '', borderColor: isListening ? '#ef4444' : '', color: '#fff',
                          animation: isListening ? 'gpsPulse 1.5s infinite ease-in-out' : 'none'
                        }}
                        disabled={isClosed}
                      >
                        🎙️ {isListening ? 'Escuchando...' : 'Dictar'}
                      </button>
                    )}
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
                    
                    const corrections = getStreetSpellingSuggestions(val);
                    setSpellingSuggestions(corrections);
                    
                    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                    
                    if (val.trim().length >= 4) {
                      debounceTimerRef.current = setTimeout(() => {
                        fetchAddressSuggestions(val);
                      }, 400);
                    } else {
                      setSuggestions([]);
                    }
                  }} 
                  onBlur={() => {
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

                {duplicateWarning && (
                  <div style={{
                    marginTop: '8px',
                    padding: '10px 14px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#fca5a5',
                    fontSize: '0.82rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <strong style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      ⚠️ ¡Dirección Duplicada Detectada!
                    </strong>
                    <span>
                      Ya existe una parada registrada hoy para esta dirección en la ruta <strong>"{duplicateWarning.routeName}"</strong> ({duplicateWarning.driver}).
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#f3f4f6' }}>
                      Cliente: <strong>{duplicateWarning.clientName}</strong>
                    </span>
                  </div>
                )}

                {spellingSuggestions.length > 0 && (
                  <div style={{
                    background: 'rgba(79, 70, 229, 0.12)', border: '1px solid rgba(79, 70, 229, 0.35)',
                    padding: '10px 14px', borderRadius: '8px', marginTop: '8px', fontSize: '0.82rem', color: '#e2e8f0', textAlign: 'left'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '6px', color: '#c7d2fe', fontSize: '0.85rem' }}>
                      💡 ¿Quisiste decir alguna de estas calles?
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {spellingSuggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const correctedAddress = address.replace(new RegExp(sug.misspelled, 'gi'), sug.corrected);
                            setAddress(correctedAddress);
                            setSpellingSuggestions([]);
                            fetchAddressSuggestions(correctedAddress);
                          }}
                          className="btn btn-secondary"
                          style={{
                            margin: 0, padding: '4px 10px', fontSize: '0.75rem', borderRadius: '16px', width: 'auto', height: 'auto',
                            background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#fff',
                            fontWeight: '500', cursor: 'pointer'
                          }}
                        >
                          {sug.fullStreet}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {!isSearchingSuggestions && suggestions.length > 0 && (
                  <ul style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    background: 'rgba(20, 16, 38, 0.98)', border: '1px solid var(--panel-border)', borderRadius: 'var(--border-radius-md)',
                    padding: '4px 0', margin: '4px 0 0 0', listStyle: 'none', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.6)'
                  }}>
                    {suggestions.map((sug, index) => (
                      <li 
                        key={index}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(sug);
                        }}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', fontSize: '0.85rem', color: '#ffffff',
                          borderBottom: index < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          transition: 'background 0.2s', lineHeight: '1.4', textAlign: 'left'
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
                    fontSize: '0.78rem', marginTop: '6px', 
                    color: addressVerification.status === 'success' ? '#34d399' : addressVerification.status === 'warning' ? '#fbbf24' : addressVerification.status === 'verifying' ? '#a78bfa' : '#f87171',
                    fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    {addressVerification.message}
                  </div>
                )}

                {addressVerification.status === 'success' && addressVerification.coords && (
                  <div style={{ marginTop: '12px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#c7d2fe' }}>📍 Ubicación Confirmada:</span>
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${addressVerification.coords.lat},${addressVerification.coords.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-small"
                        style={{ width: 'auto', margin: 0, padding: '2px 8px', fontSize: '0.72rem', height: '22px', display: 'flex', alignItems: 'center', gap: '3px', border: '1px solid rgba(79, 70, 229, 0.4)', color: '#c7d2fe', background: 'rgba(79, 70, 229, 0.1)' }}
                      >
                        🌐 Google Maps / Vista Satélite
                      </a>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <div 
                        id="form-mini-map" 
                        style={{ 
                          height: '200px', 
                          width: '100%', 
                          borderRadius: '6px', 
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          background: '#1e1e1e',
                          zIndex: 1 
                        }}
                      ></div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'left', fontStyle: 'italic', lineHeight: '1.3' }}>
                        💡 Arrastra el marcador en el mapa o haz clic para ajustar la posición exacta de entrega.
                      </div>
                    </div>

                    {/* Editor de Coordenadas Manuales */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '5px' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <span className="input-label" style={{ fontSize: '0.7rem', margin: '0 0 2px 0', textTransform: 'uppercase', opacity: 0.8 }}>Latitud</span>
                        <input 
                          type="number" 
                          step="0.000001" 
                          className="form-input" 
                          style={{ padding: '4px 8px', fontSize: '0.8rem', height: '28px', margin: 0, textAlign: 'center', fontWeight: '600' }}
                          value={addressVerification.coords.lat} 
                          onChange={(e) => {
                            const latVal = parseFloat(e.target.value) || 0;
                            setAddressVerification(prev => ({
                              ...prev,
                              coords: { ...prev.coords, lat: latVal }
                            }));
                          }} 
                        />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <span className="input-label" style={{ fontSize: '0.7rem', margin: '0 0 2px 0', textTransform: 'uppercase', opacity: 0.8 }}>Longitud</span>
                        <input 
                          type="number" 
                          step="0.000001" 
                          className="form-input" 
                          style={{ padding: '4px 8px', fontSize: '0.8rem', height: '28px', margin: 0, textAlign: 'center', fontWeight: '600' }}
                          value={addressVerification.coords.lng} 
                          onChange={(e) => {
                            const lngVal = parseFloat(e.target.value) || 0;
                            setAddressVerification(prev => ({
                              ...prev,
                              coords: { ...prev.coords, lng: lngVal }
                            }));
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Cliente, Teléfono y Código Postal */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginTop: '10px' }}>
              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="input-label">Cliente</span>
                  {!!(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                    <button
                      type="button"
                      onClick={handleStartNameVoiceInput}
                      className={`btn btn-small ${isListeningName ? 'btn-danger' : 'btn-secondary'}`}
                      style={{ 
                        width: 'auto', margin: 0, padding: '2px 8px', fontSize: '0.7rem', height: '20px',
                        display: 'flex', alignItems: 'center', gap: '3px',
                        background: isListeningName ? '#ef4444' : '', borderColor: isListeningName ? '#ef4444' : '', color: '#fff',
                        animation: isListeningName ? 'gpsPulse 1.5s infinite ease-in-out' : 'none'
                      }}
                      disabled={isClosed}
                    >
                      🎙️ {isListeningName ? 'Escuchando...' : 'Dictar'}
                    </button>
                  )}
                </div>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej. Jaime Rodríguez" 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)} 
                  onBlur={() => setCustomerName(formatCustomerName(customerName))}
                  required 
                  disabled={isClosed} 
                />
              </div>

              <div className="input-group">
                <span className="input-label">Teléfono</span>
                <input type="tel" className="form-input" placeholder="Ej. 612345678" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isClosed} />
              </div>

              <div className="input-group">
                <span className="input-label">Código Postal</span>
                <input type="text" className="form-input" placeholder="Ej. 08208" value={postcode} onChange={(e) => setPostcode(e.target.value.trim())} disabled={isClosed} />
              </div>
            </div>

            {/* 3. Selección de Auxilio de Ruta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontWeight: '600' }}>
                <input 
                  type="checkbox" 
                  checked={showHelperRoute} 
                  onChange={(e) => {
                    setShowHelperRoute(e.target.checked);
                    if (!e.target.checked) setOriginalRouteLabel('');
                  }} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                🔄 Pertenece a otra ruta
              </label>

              {showHelperRoute && (
                <div className="input-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                  <span className="input-label" style={{ fontSize: '0.8rem' }}>Selecciona Furgoneta Propietaria (Ruta Original)</span>
                  <select 
                    className="form-input" 
                    value={originalRouteLabel} 
                    onChange={(e) => setOriginalRouteLabel(e.target.value)} 
                    disabled={isClosed}
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--panel-border)', color: 'var(--text)' }}
                  >
                    <option value="">Selecciona Ruta Original...</option>
                    {teamRepartidores.map(u => (
                      <option key={u.id} value={u.label}>{u.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Franja Horaria y Tiempo Estimado */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '10px', borderTop: '1px dashed var(--panel-border)', paddingTop: '15px' }}>
                <div className="input-group">
                  <span className="input-label">⏳ Franja Horaria de Entrega</span>
                  <select
                    className="form-input"
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    disabled={isClosed}
                  >
                    <option value="any">Indiferente / Todo el día</option>
                    <option value="morning">☀️ Mañana (09:00 - 14:00)</option>
                    <option value="afternoon">🌙 Tarde (16:00 - 20:00)</option>
                  </select>
                </div>

                <div className="input-group">
                  <span className="input-label">⏱️ Tiempo Estimado en Parada (minutos)</span>
                  <input 
                    type="number" 
                    className="form-input" 
                    min="1" 
                    value={estimatedDuration} 
                    onChange={(e) => { 
                      setEstimatedDuration(parseInt(e.target.value, 10) || 0); 
                      setIsDurationManuallyEdited(true); 
                    }} 
                    disabled={isClosed} 
                  />
                </div>
              </div>
            </div>

            <div className="wizard-footer" style={{ justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => {
                  if (!customerName.trim()) {
                    triggerAlert('Por favor, indica el nombre del cliente.', 'error');
                    return;
                  }
                  if (!address.trim()) {
                    triggerAlert('Por favor, indica la dirección de entrega.', 'error');
                    return;
                  }
                  if (!ticketRoute && currentUser?.role !== 'repartidor') {
                    triggerAlert('Por favor, selecciona una furgoneta o ruta.', 'error');
                    return;
                  }
                  setFormStep(2);
                }} 
                className="btn btn-primary"
                style={{ width: 'auto' }}
              >
                Continuar a Servicios ➔
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: ARTÍCULOS Y SERVICIOS */}
        {formStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', animation: 'fadeIn 0.3s ease' }}>
            {/* SECCIÓN A: TELEVISORES */}
            <div className="block-section" style={{ textAlign: 'left' }}>
              <div className="block-title">📺 Selección de Televisores</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                Selecciona la medida de la TV y la acción del servicio, luego haz clic en "Añadir".
              </p>

              {/* Selector de Pulgadas de la TV */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <div 
                  className="tv-size-card active"
                  onClick={() => {
                    if (isClosed) return;
                    const val = window.prompt('Introduce las pulgadas de la TV:', tempTvInches || '55');
                    if (val !== null) setTempTvInches(val);
                  }}
                  style={{ 
                    width: '100%', 
                    maxWidth: '300px', 
                    padding: '20px', 
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '2px solid var(--primary)',
                    borderRadius: '12px',
                    boxShadow: '0 0 15px rgba(99, 102, 241, 0.15)',
                    margin: '0 auto'
                  }}
                >
                  <span style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📺</span>
                  <span style={{ fontWeight: '800', fontSize: '1.4rem', color: '#fff' }}>
                    {tempTvInches ? `${tempTvInches}"` : 'Toca para definir'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>
                    Pulgadas de la TV (Toca para cambiar)
                  </span>
                </div>
              </div>

              {/* Selector de Marca de la TV */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '15px' }}>
                <span className="input-label" style={{ margin: 0 }}>Marca de la TV:</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="form-input"
                    value={['Samsung', 'LG', 'Sony', 'Philips', 'Xiaomi', 'Hisense', 'TCL'].includes(tempTvBrand) ? tempTvBrand : 'Otra'}
                    onChange={(e) => {
                      if (e.target.value === 'Otra') {
                        const customBrand = window.prompt('Introduce la marca de la TV:', tempTvBrand === 'Otra' ? '' : tempTvBrand);
                        if (customBrand !== null) {
                          setTempTvBrand(customBrand || 'Genérica');
                        }
                      } else {
                        setTempTvBrand(e.target.value);
                      }
                    }}
                    style={{ flex: 1 }}
                  >
                    <option value="Samsung">Samsung</option>
                    <option value="LG">LG</option>
                    <option value="Sony">Sony</option>
                    <option value="Philips">Philips</option>
                    <option value="Xiaomi">Xiaomi</option>
                    <option value="Hisense">Hisense</option>
                    <option value="TCL">TCL</option>
                    <option value="Otra">Otra (escribir...)</option>
                  </select>
                  {!['Samsung', 'LG', 'Sony', 'Philips', 'Xiaomi', 'Hisense', 'TCL'].includes(tempTvBrand) && (
                    <input
                      type="text"
                      className="form-input"
                      value={tempTvBrand}
                      onChange={(e) => setTempTvBrand(e.target.value)}
                      placeholder="Escribe la marca..."
                      style={{ flex: 1 }}
                    />
                  )}
                </div>
              </div>

              {/* Selector Segmentado de Acción */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '15px' }}>
                <span className="input-label" style={{ margin: 0 }}>Acción a realizar:</span>
                <div className="action-pills">
                  <button 
                    type="button" 
                    className={`action-pill-opt ${tempTvAction === 'entrega' ? 'active' : ''}`}
                    onClick={() => !isClosed && setTempTvAction('entrega')}
                  >
                    Entrega
                  </button>
                  <button 
                    type="button" 
                    className={`action-pill-opt ${tempTvAction === 'recogida' ? 'active' : ''}`}
                    onClick={() => !isClosed && setTempTvAction('recogida')}
                  >
                    Recogida
                  </button>
                  <button 
                    type="button" 
                    className={`action-pill-opt ${tempTvAction === 'combinado' ? 'active' : ''}`}
                    onClick={() => !isClosed && setTempTvAction('combinado')}
                  >
                    Entrega+Rec.
                  </button>
                  <button 
                    type="button" 
                    className={`action-pill-opt ${tempTvAction === 'solo_pm' ? 'active' : ''}`}
                    onClick={() => !isClosed && setTempTvAction('solo_pm')}
                  >
                    Solo PM
                  </button>
                  <button 
                    type="button" 
                    className={`action-pill-opt ${tempTvAction === 'solo_cuelgue' ? 'active' : ''}`}
                    onClick={() => !isClosed && setTempTvAction('solo_cuelgue')}
                  >
                    Solo Cuelgue
                  </button>
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => {
                  if (!tempTvInches) {
                    triggerAlert('Por favor, selecciona el tamaño o pulgadas de la TV', 'error');
                    return;
                  }
                  addTvToForm();
                }} 
                className="btn btn-primary" 
                style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                disabled={isClosed}
              >
                <Plus size={16} /> Añadir Televisión a la Carga
              </button>

              {/* Listado de TVs Añadidas */}
              {formTvs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                  {formTvs.map((tv) => {
                    const actionText = tv.action === 'entrega' ? 'Entrega' : tv.action === 'recogida' ? 'Recogida' : tv.action === 'solo_pm' ? 'Solo PM' : tv.action === 'solo_cuelgue' ? 'Solo Cuelgue' : 'Entrega + Recogida';
                    return (
                      <div key={tv.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--panel-border)', paddingBottom: '8px', marginBottom: '12px' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--primary)' }}>
                            📺 TV {tv.brand || 'Genérica'} {tv.inches}" ({actionText})
                          </span>
                          <button type="button" onClick={() => removeTvFromForm(tv.id)} className="btn btn-danger btn-small" style={{ display: 'flex', padding: '4px 8px', gap: '4px', width: 'auto', margin: 0 }} disabled={isClosed}>
                            <Trash2 size={12} /> Quitar
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <span className="input-label">Puesta en Marcha (PM)</span>
                            <select className="form-input" value={tv.pmType} onChange={(e) => updateTvInForm(tv.id, 'pmType', e.target.value)} disabled={isClosed}>
                              <option value="none">No requiere</option>
                              <option value="basic">Puesta en Marcha Básica (3 Mód.)</option>
                              <option value="complex">Puesta en Marcha Compleja (5 Mód.)</option>
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
                              Cuelgue en Pared (8/10 Mód.)
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECCIÓN URGENTE */}
            <div className="block-section" style={{ textAlign: 'left', border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.03)' }}>
              <div className="block-title" style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>⚡ Servicio Urgente Especial</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                Si este reparto es un servicio urgente especial que sale en cualquier momento, selecciona la tarifa correspondiente para que se compute en las ganancias:
              </p>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`action-pill-opt ${urgenteType === 'none' ? 'active' : ''}`}
                  onClick={() => !isClosed && setUrgenteType('none')}
                  style={{ flex: 1, height: '40px', minWidth: '120px', borderRadius: '8px', cursor: isClosed ? 'not-allowed' : 'pointer' }}
                >
                  No es Urgente
                </button>
                <button
                  type="button"
                  className={`action-pill-opt ${urgenteType === '100' ? 'active' : ''}`}
                  onClick={() => !isClosed && setUrgenteType('100')}
                  style={{ 
                    flex: 1, 
                    height: '40px', 
                    minWidth: '120px', 
                    borderRadius: '8px', 
                    cursor: isClosed ? 'not-allowed' : 'pointer',
                    borderColor: urgenteType === '100' ? '#ef4444' : '', 
                    color: urgenteType === '100' ? '#fff' : '', 
                    background: urgenteType === '100' ? 'rgba(239, 68, 68, 0.2)' : '' 
                  }}
                >
                  Urgente 100€
                </button>
                <button
                  type="button"
                  className={`action-pill-opt ${urgenteType === '120' ? 'active' : ''}`}
                  onClick={() => !isClosed && setUrgenteType('120')}
                  style={{ 
                    flex: 1, 
                    height: '40px', 
                    minWidth: '120px', 
                    borderRadius: '8px', 
                    cursor: isClosed ? 'not-allowed' : 'pointer',
                    borderColor: urgenteType === '120' ? '#ef4444' : '', 
                    color: urgenteType === '120' ? '#fff' : '', 
                    background: urgenteType === '120' ? 'rgba(239, 68, 68, 0.2)' : '' 
                  }}
                >
                  Urgente 120€
                </button>
              </div>
            </div>

            {/* SECCIÓN B: PAQUETERÍA Y OTROS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', textAlign: 'left' }}>
              <div className="block-section">
                <div className="block-title">📦 Bloque Paquetería (Unidades)</div>
                {itemsPaqueteria.map(t => {
                  const qty = otherQuantities[t.id] || 0;
                  const descs = otherDescriptions[t.id] || [];
                  return (
                    <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '10px 0' }}>
                      <div className="task-item-row" style={{ borderBottom: 'none', padding: 0 }}>
                        <span className="task-item-label">{t.name}</span>
                        <div className="qty-counter">
                          <button type="button" className="qty-btn" onClick={() => handleOtherQtyChange(t.id, -1)} disabled={isClosed}><Minus size={14} /></button>
                          <span className="qty-val">{qty}</span>
                          <button type="button" className="qty-btn" onClick={() => handleOtherQtyChange(t.id, 1)} disabled={isClosed}><Plus size={14} /></button>
                        </div>
                      </div>
                      {qty > 0 && descs.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '10px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {descs.map((d, i) => (
                            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              📦 Item {i + 1}: <strong style={{ color: '#fff' }}>{d}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="block-section">
                <div className="block-title">🔧 Otros Elementos / Accesorios</div>
                {(() => {
                  const soundbarIds = ['BSND', 'PM_BSND', 'CUELGUE_BSND'];
                  const soundbarItems = soundbarIds.map(id => itemsOtros.find(item => item.id === id)).filter(Boolean);
                  const otherItems = itemsOtros.filter(item => !soundbarIds.includes(item.id) && item.id !== 'URGENTE_100' && item.id !== 'URGENTE_120');
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

            {/* SECCIÓN C: CONCEPTOS ADICIONALES (EXTRAS PERSONALIZADOS) */}
            <div className="block-section" style={{ textAlign: 'left' }}>
              <div className="block-title">➕ Conceptos Adicionales (Extras Especiales)</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                Registra servicios extras no contemplados en la tarifa estándar (ej. subida por escalera, ayudante adicional, etc.)
              </p>
              
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                <div style={{ flex: 2, minWidth: '200px' }}>
                  <span className="input-label" style={{ margin: '0 0 4px 0' }}>Descripción del Servicio Extra</span>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: Subida por escaleras (10 pisos)"
                    value={customExtraName}
                    onChange={(e) => setCustomExtraName(e.target.value)}
                    disabled={isClosed}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '100px' }}>
                  <span className="input-label" style={{ margin: '0 0 4px 0' }}>Precio (€)</span>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="Ej: 20"
                    value={customExtraPrice}
                    onChange={(e) => setCustomExtraPrice(e.target.value)}
                    disabled={isClosed}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={() => {
                      if (!customExtraName.trim()) {
                        triggerAlert('Escribe una descripción para el concepto adicional', 'error');
                        return;
                      }
                      if (!customExtraPrice || parseFloat(customExtraPrice) < 0) {
                        triggerAlert('Introduce un precio válido', 'error');
                        return;
                      }
                      addCustomExtra();
                    }}
                    style={{ height: '42px', margin: 0, padding: '0 20px', width: 'auto' }}
                    disabled={isClosed}
                  >
                    Añadir Extra
                  </button>
                </div>
              </div>

              {/* Listado de Extras Añadidos */}
              {customExtras.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {customExtras.map(extra => (
                    <div key={extra.id} className="task-item-row" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                      <span style={{ fontWeight: '600' }}>✨ {extra.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontWeight: '700', color: 'var(--success)' }}>{extra.price.toFixed(2)} €</span>
                        <button 
                          type="button" 
                          className="btn btn-danger btn-small"
                          onClick={() => removeCustomExtra(extra.id)}
                          style={{ width: 'auto', margin: 0, padding: '4px 8px' }}
                          disabled={isClosed}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COD Reembolso y Observaciones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px', borderTop: '1px dashed var(--panel-border)', paddingTop: '15px' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontWeight: '600' }}>
                <input 
                  type="checkbox" 
                  checked={showCod} 
                  onChange={(e) => {
                    setShowCod(e.target.checked);
                    if (!e.target.checked) setCodAmount('');
                  }} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                💵 Este reparto tiene cobro contra reembolso (COD)
              </label>

              {showCod && (
                <div className="input-group" style={{ animation: 'fadeIn 0.2s ease' }}>
                  <span className="input-label" style={{ fontSize: '0.8rem' }}>Importe a Cobrar / Reembolso (€)</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    className="form-input" 
                    placeholder="Ej. 150.00" 
                    value={codAmount} 
                    onChange={(e) => setCodAmount(e.target.value)} 
                    disabled={isClosed} 
                  />
                </div>
              )}
            </div>

            <div className="input-group" style={{ marginTop: '15px' }}>
              <span className="input-label">Observaciones / Instrucciones del Reparto</span>
              <textarea 
                className="form-input" 
                placeholder="Escribe aquí notas adicionales, indicaciones de timbre, portales, etc." 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                style={{ minHeight: '80px', resize: 'vertical', padding: '12px' }}
                disabled={isClosed}
              />
            </div>

            <div className="wizard-footer">
              <button 
                type="button" 
                onClick={() => setFormStep(1)} 
                className="btn btn-secondary"
                style={{ width: 'auto' }}
              >
                ← Atrás
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ 
                  width: 'auto', 
                  background: 'linear-gradient(135deg, var(--primary) 0%, #10b981 100%)',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                  fontWeight: '800'
                }}
                disabled={isClosed}
              >
                💾 {editingTicketId ? 'Guardar Cambios' : 'Confirmar y Planificar Reparto'}
              </button>
            </div>
          </div>
        )}
      </form>
    );
  };

  // --- RENDERIZADO DEL PORTAL DEL CHOFER (REPARTIDOR) ---
  const renderDriverPortal = () => {
    const userTickets = tickets.filter(t => t.furgoId === currentUser.id);
    const targetDate = shiftSummaryDate || new Date().toISOString().split('T')[0];
    const dateTickets = sortTicketsByRouteOrder(userTickets.filter(t => t.date === targetDate));

    const minutesToHHMM = (totalMins) => {
      const h = Math.floor(totalMins / 60) % 24;
      const m = Math.floor(totalMins % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    const hhmmToMinutes = (timeStr) => {
      const parts = (timeStr || '09:00').split(':');
      return (parseInt(parts[0], 10) || 9) * 60 + (parseInt(parts[1], 10) || 0);
    };

    const timelineSchedules = {};
    if (dateTickets.length > 0) {
      let lastPos = { lat: 41.3879, lng: 2.16992 };
      let currentTime = hhmmToMinutes(routeStartTime);

      const getDistanceSimple = (c1, c2) => {
        const R = 6371;
        const dLat = (c2.lat - c1.lat) * Math.PI / 180;
        const dLng = (c2.lng - c1.lng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) * 
          Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      };

      dateTickets.forEach((ticket, idx) => {
        const parsed = parseTicketNotes(ticket.notes);
        let ticketLat = ticket.lat ? parseFloat(ticket.lat) : lastPos.lat;
        let ticketLng = ticket.lng ? parseFloat(ticket.lng) : lastPos.lng;
        
        const dist = idx === 0 ? 0 : getDistanceSimple(lastPos, { lat: ticketLat, lng: ticketLng });
        const travelMins = Math.round((dist / 35) * 60); // 35 km/h
        
        const arrivalTime = currentTime + travelMins;
        const departureTime = arrivalTime + parsed.estimatedDuration;
        
        timelineSchedules[ticket.id] = {
          arrival: minutesToHHMM(arrivalTime),
          departure: minutesToHHMM(departureTime),
          duration: parsed.estimatedDuration,
          timeSlot: parsed.timeSlot === 'morning' ? 'Mañana' : parsed.timeSlot === 'afternoon' ? 'Tarde' : 'Indiferente'
        };
        
        lastPos = { lat: ticketLat, lng: ticketLng };
        currentTime = departureTime;
      });
    }

    return (
      <div>
        <div className="tab-container">
          <button className={`tab-btn ${activeTab === 'new_ticket' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('new_ticket'); }}>
            {editingTicketId ? '✏️ Editando Parada' : '📋 Planificar Ruta'}
          </button>
          <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            🚚 Mi Ruta ({dateTickets.length})
          </button>
          <button className={`tab-btn ${activeTab === 'driver_map' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('driver_map'); }}>
            🗺️ Ver Mapa
          </button>
          {hasSearchPermission && (
            <button className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('search'); }}>
              🔍 Buscador General
            </button>
          )}
        </div>



        {activeTab === 'new_ticket' && renderTicketForm()}

        {activeTab === 'driver_map' && (
          <div className="glass-panel" style={{ textAlign: 'left', padding: '20px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: 'var(--primary)' }}>
              🗺️ Mapa de Mi Ruta ({targetDate})
            </h3>
            <div className="map-split-container">
              <div className="map-split-left">
                <div 
                  key={`driver-map-${targetDate}-${activeTab}`}
                  id="driver-map" 
                  style={{ 
                    height: '100%', 
                    width: '100%', 
                    borderRadius: 'var(--border-radius-lg)', 
                    border: '1px solid var(--panel-border)',
                    background: '#1e1e1e',
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.25)',
                    zIndex: 1
                  }}
                ></div>
              </div>
              
              <div className="map-split-right">
                {renderMapStopsList(false)}
              </div>
            </div>
          </div>
        )}


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

                <div className="input-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                  <span className="input-label" style={{ margin: 0, fontWeight: '700' }}>🕒 Salida:</span>
                  <input 
                    type="time" 
                    className="form-input" 
                    value={routeStartTime} 
                    onChange={(e) => setRouteStartTime(e.target.value)} 
                    style={{ width: '110px', padding: '8px 12px' }}
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
                            const existingKms = getRouteKms(currentUser.id, targetDate);
                            setShiftKmsInput(existingKms > 0 ? existingKms.toString() : '');
                            setShiftSummaryDate(targetDate);
                            setShiftSummaryFurgoId(currentUser.id);
                            setShowShiftModal(true);
                          }} 
                          className="btn btn-secondary btn-small"
                          style={{ margin: 0, padding: '8px 14px' }}
                        >
                          Ver Resumen Guardado
                        </button>
                        {/* {dayTickets.length > 0 && (
                          <button 
                            type="button" 
                            onClick={handleExportCircuit} 
                            className="btn btn-secondary btn-small"
                            style={{ margin: 0, padding: '8px 14px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'rgba(79, 70, 229, 0.05)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <FileSpreadsheet size={14} /> Exportar a Circuit
                          </button>
                        )} */}
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
                            const existingKms = getRouteKms(currentUser.id, targetDate);
                            setShiftKmsInput(existingKms > 0 ? existingKms.toString() : '');
                            setShiftSummaryDate(targetDate);
                            setShiftSummaryFurgoId(currentUser.id);
                            setShowShiftModal(true);
                          }} 
                          className="btn btn-primary btn-small"
                          style={{ margin: 0, padding: '8px 14px', background: 'var(--warning)', color: '#000', fontWeight: '700' }}
                        >
                          Finalizar Turno
                        </button>
                        {/* {dayTickets.length > 0 && (
                          <button 
                            type="button" 
                            onClick={handleExportCircuit} 
                            className="btn btn-secondary btn-small"
                            style={{ margin: 0, padding: '8px 14px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'rgba(79, 70, 229, 0.05)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <FileSpreadsheet size={14} /> Exportar a Circuit
                          </button>
                        )} */}
                      </div>
                    );
                  }
                })()}
              </div>
            </div>

            <div className="glass-panel" style={{ textAlign: 'left', padding: '20px', border: '1px solid var(--panel-border)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', margin: '0 0 10px 0', fontSize: '1.05rem' }}>
                ⚡ Optimización de Mi Ruta
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                Ordena tus paradas del día de la más cercana a la más lejana ingresando tus puntos de salida y fin de ruta.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                  <span className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🏁 Punto de Partida (Inicio)</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {!!(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                        <button
                          type="button"
                          onClick={handleStartStartVoiceInput}
                          style={{
                            background: 'transparent', border: 'none', color: isListeningStart ? 'var(--danger)' : 'var(--primary)',
                            fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                            fontWeight: isListeningStart ? 'bold' : 'normal',
                            animation: isListeningStart ? 'gpsPulse 1.5s infinite ease-in-out' : 'none'
                          }}
                        >
                          🎙️ {isListeningStart ? 'Escuchando...' : 'Dictar'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => fillCurrentLocation('start')}
                        style={{
                          background: 'transparent', border: 'none', color: 'var(--primary)',
                          fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0
                        }}
                      >
                        📍 Usar GPS
                      </button>
                    </div>
                  </span>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: Mi Casa, Calle X, Madrid" 
                    value={routeStartAddr} 
                    onChange={(e) => {
                      setRouteStartAddr(e.target.value);
                      handleFetchRouteSuggestions(e.target.value, 'start');
                    }}
                  />
                  {renderRouteSuggestions('start')}
                </div>
                <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                  <span className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🏁 Punto de Llegada (Retorno/Fin)</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {!!(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                        <button
                          type="button"
                          onClick={handleStartEndVoiceInput}
                          style={{
                            background: 'transparent', border: 'none', color: isListeningEnd ? 'var(--danger)' : 'var(--primary)',
                            fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                            fontWeight: isListeningEnd ? 'bold' : 'normal',
                            animation: isListeningEnd ? 'gpsPulse 1.5s infinite ease-in-out' : 'none'
                          }}
                        >
                          🎙️ {isListeningEnd ? 'Escuchando...' : 'Dictar'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => fillCurrentLocation('end')}
                        style={{
                          background: 'transparent', border: 'none', color: 'var(--primary)',
                          fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0
                        }}
                      >
                        📍 Usar GPS
                      </button>
                    </div>
                  </span>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: Almacén, Calle Y, Madrid (o vacío)" 
                    value={routeEndAddr} 
                    onChange={(e) => {
                      setRouteEndAddr(e.target.value);
                      handleFetchRouteSuggestions(e.target.value, 'end');
                    }}
                  />
                  {renderRouteSuggestions('end')}
                </div>
                <div className="input-group" style={{ marginBottom: 0, justifyContent: 'flex-end', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button 
                      type="button" 
                      onClick={handleOptimizeRoute} 
                      className="btn btn-primary" 
                      style={{ height: '45px', margin: 0, fontWeight: '700', flex: 1 }}
                      disabled={isOptimizing}
                    >
                      {isOptimizing ? 'Calculando...' : '⚡ Optimizar'}
                    </button>
                    <button 
                      type="button" 
                      onClick={handleNavigateFullRoute} 
                      className="btn btn-secondary" 
                      style={{ height: '45px', margin: 0, fontWeight: '700', flex: 1, border: '1px solid var(--primary)', color: 'var(--primary)', background: 'rgba(79, 70, 229, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      title="Navegar ruta completa en Google Maps"
                    >
                      🗺️ Navegar Ruta
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ textAlign: 'left', padding: '20px' }}>
              <h2>Planificación y Seguimiento de Ruta ({targetDate})</h2>
              <p style={{ marginBottom: '15px', color: 'var(--text-muted)' }}>
                Gestiona las paradas planificadas de tu jornada. Marca cada una como "Éxito" o "Fallido" según se complete el servicio.
              </p>

              {/* Barra de progreso de la jornada */}
              {(() => {
                const total = dateTickets.length;
                if (total === 0) return null;
                const completed = dateTickets.filter(t => t.status === 'success' || t.status === 'failed').length;
                const pct = Math.round((completed / total) * 100);
                const successCount = dateTickets.filter(t => t.status === 'success').length;
                const failedCount = dateTickets.filter(t => t.status === 'failed').length;

                return (
                  <div style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.02)', padding: '12px 15px', borderRadius: '10px', border: '1px solid var(--panel-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', flexWrap: 'wrap', gap: '6px' }}>
                      <span>Avance de Ruta: {completed}/{total} Paradas ({pct}%)</span>
                      <span style={{ color: 'var(--success)' }}>🟢 {successCount} Éxito | 🔴 {failedCount} Fallos</span>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })()}

              {/* Botones de Filtrado Rápido estilo Ventanas */}
              {dateTickets.length > 0 && (
                <div style={{
                  display: 'flex',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '4px',
                  borderRadius: '12px',
                  border: '1px solid var(--panel-border)',
                  marginBottom: '20px',
                  gap: '4px'
                }}>
                  <button 
                    type="button" 
                    onClick={() => setDriverFilter('active_reparto')} 
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: driverFilter === 'active_reparto' ? 'var(--primary)' : 'transparent',
                      color: driverFilter === 'active_reparto' ? '#fff' : 'var(--text-muted)',
                      fontWeight: '700',
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    🚚 En Reparto ({dateTickets.filter(t => !t.status || t.status === 'pending' || t.status === 'transit').length})
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setDriverFilter('completed')} 
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: driverFilter === 'completed' ? '#10b981' : 'transparent',
                      color: driverFilter === 'completed' ? '#fff' : 'var(--text-muted)',
                      fontWeight: '700',
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    ✅ Completadas ({dateTickets.filter(t => t.status === 'success' || t.status === 'failed').length})
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setDriverFilter('all')} 
                    style={{
                      flex: 0.5,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: driverFilter === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: driverFilter === 'all' ? 'var(--text-main)' : 'var(--text-muted)',
                      fontWeight: '700',
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    Todas ({dateTickets.length})
                  </button>
                </div>
              )}

              {dateTickets.length === 0 ? (
                <div style={{ padding: '30px', color: 'var(--text-muted)', textAlign: 'center' }}>No hay paradas planificadas para este día.</div>
              ) : (
                (() => {
                  const filteredTickets = dateTickets.filter(t => {
                    if (driverFilter === 'active_reparto') return !t.status || t.status === 'pending' || t.status === 'transit';
                    if (driverFilter === 'completed') return t.status === 'success' || t.status === 'failed';
                    return true;
                  });

                  if (filteredTickets.length === 0) {
                    return (
                      <div style={{ padding: '40px', color: 'var(--text-muted)', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px dashed var(--panel-border)' }}>
                        No hay paradas en este filtro.
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {filteredTickets.map((t) => {
                        const isClosed = getShiftStatus(t.furgoId, t.date) === 'closed';
                        const stopIndex = dateTickets.findIndex(ticket => ticket.id === t.id) + 1;
                        const isCollapsed = !!collapsedTicketIds[t.id];
                        
                        let statusBadge = <span className="badge badge-warning" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>🟡 Pendiente</span>;
                        if (t.status === 'success') {
                          statusBadge = <span className="badge badge-success" style={{ fontSize: '0.75rem', fontWeight: 'bold', background: '#10b981', color: '#fff' }}>🟢 Éxito</span>;
                        } else if (t.status === 'failed') {
                          statusBadge = <span className="badge badge-danger" style={{ fontSize: '0.75rem', fontWeight: 'bold', background: '#ef4444', color: '#fff' }}>🔴 Fallido {t.failureReason ? `(${t.failureReason})` : ''}</span>;
                        } else if (t.status === 'transit') {
                          statusBadge = <span className="badge" style={{ fontSize: '0.75rem', fontWeight: 'bold', background: '#38bdf8', color: '#0f172a' }}>🔵 En Camino</span>;
                        }

                        if (isCollapsed) {
                          return (
                            <div 
                              key={t.id} 
                              className="driver-card" 
                              style={{
                                borderLeft: t.status === 'transit' ? '4px solid #38bdf8' : t.status === 'success' ? '4px solid #10b981' : t.status === 'failed' ? '4px solid #ef4444' : '1px solid var(--panel-border)',
                                textAlign: 'left',
                                padding: '10px 14px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                <div 
                                  onClick={() => toggleCollapse(t.id)} 
                                  style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, cursor: 'pointer', overflow: 'hidden' }}
                                >
                                  <span style={{ color: 'var(--primary)', display: 'inline-flex', transform: 'rotate(-90deg)', transition: 'transform 0.2s', marginRight: '2px' }} title="Expandir parada">
                                    <ChevronDown size={18} />
                                  </span>
                                  <div className="driver-card-index" style={{ margin: 0, padding: '2px 8px', fontSize: '0.85rem', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>#{stopIndex}</div>
                                  <div style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }} title={`${getShortAddressString(t.address)}${t.postcode ? ` - CP ${t.postcode}` : ''}`}>
                                    {getShortAddressString(t.address)}{t.postcode ? ` - CP ${t.postcode}` : ''}
                                  </div>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                  {statusBadge}
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.address)}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="btn btn-secondary btn-small"
                                    style={{ display: 'inline-flex', padding: '8px', margin: 0, width: 'auto', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', border: '1px solid var(--primary)' }}
                                    title="Iniciar GPS"
                                  >
                                    <MapPin size={14} color="var(--primary)" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div 
                            key={t.id} 
                            className="driver-card" 
                            style={{
                              borderLeft: t.status === 'transit' ? '4px solid #38bdf8' : t.status === 'success' ? '4px solid #10b981' : t.status === 'failed' ? '4px solid #ef4444' : '1px solid var(--panel-border)',
                              textAlign: 'left'
                            }}
                          >
                            {/* Cabecera de la Tarjeta */}
                            <div className="driver-card-header">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
                                <span 
                                  onClick={() => toggleCollapse(t.id)} 
                                  style={{ color: 'var(--primary)', cursor: 'pointer', display: 'inline-flex', marginRight: '4px', transition: 'transform 0.2s' }}
                                  title="Minimizar parada"
                                >
                                  <ChevronDown size={18} />
                                </span>
                                <div className="driver-card-index">#{stopIndex}</div>
                                <div className="driver-card-title">{t.customerName}</div>
                                {t.notes && t.notes.startsWith('[Ruta Original: ') && (() => {
                                  const endIdx = t.notes.indexOf(']');
                                  const label = endIdx !== -1 ? t.notes.substring(16, endIdx) : 'Otra';
                                  return (
                                    <span className="badge" style={{ 
                                      fontSize: '0.72rem', 
                                      padding: '2px 8px', 
                                      background: 'rgba(245, 158, 11, 0.15)', 
                                      border: '1px solid rgba(245, 158, 11, 0.3)', 
                                      color: '#fbbf24',
                                      borderRadius: '6px',
                                      fontWeight: 'bold',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}>
                                      🔄 Auxilio de {label}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {statusBadge}
                                {!isClosed && (
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button 
                                      type="button" 
                                      onClick={() => startEditing(t)} 
                                      className="btn btn-secondary btn-small" 
                                      style={{ margin: 0, padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'auto' }}
                                      title="Editar parada"
                                    >
                                      <Edit size={12} />
                                    </button>
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        if (window.confirm('¿Estás seguro de que deseas eliminar permanentemente esta parada?')) {
                                          handleDeleteTicket(t.id);
                                          loadData();
                                        }
                                      }} 
                                      className="btn btn-danger btn-small" 
                                      style={{ margin: 0, padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'auto' }}
                                      title="Eliminar parada"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Cronograma Estimado */}
                            {timelineSchedules[t.id] && (
                              <div style={{
                                background: 'rgba(99, 102, 241, 0.08)',
                                border: '1px solid rgba(99, 102, 241, 0.15)',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '12px',
                                fontSize: '0.8rem',
                                color: 'var(--text-main)',
                                marginBottom: '12px',
                                marginTop: '4px',
                                alignItems: 'center'
                              }}>
                                <span>🕒 <strong>Llegada:</strong> {timelineSchedules[t.id].arrival}</span>
                                <span>⌛ <strong>Parada:</strong> {timelineSchedules[t.id].duration} min</span>
                                <span>🛫 <strong>Salida:</strong> {timelineSchedules[t.id].departure}</span>
                                <span style={{
                                  marginLeft: 'auto',
                                  fontSize: '0.72rem',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: timelineSchedules[t.id].timeSlot === 'Mañana' ? 'rgba(251, 191, 36, 0.15)' : timelineSchedules[t.id].timeSlot === 'Tarde' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                  color: timelineSchedules[t.id].timeSlot === 'Mañana' ? '#fbbf24' : timelineSchedules[t.id].timeSlot === 'Tarde' ? '#38bdf8' : 'var(--text-muted)',
                                  border: timelineSchedules[t.id].timeSlot === 'Mañana' ? '1px solid rgba(251, 191, 36, 0.25)' : timelineSchedules[t.id].timeSlot === 'Tarde' ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid var(--panel-border)',
                                  fontWeight: 'bold'
                                }}>
                                  🎯 Horario: {timelineSchedules[t.id].timeSlot}
                                </span>
                              </div>
                            )}

                            {/* Contacto y Notas */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                              {t.phone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                                  <span>📞 {t.phone}</span>
                                  <a 
                                    href={`tel:${t.phone}`} 
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '50%',
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      color: '#10b981',
                                      border: '1px solid rgba(16, 185, 129, 0.25)',
                                      boxShadow: '0 0 10px rgba(16, 185, 129, 0.1)',
                                      cursor: 'pointer',
                                      textDecoration: 'none',
                                      marginLeft: '4px'
                                    }}
                                    title="Llamar Cliente"
                                  >
                                    <Phone size={14} />
                                  </a>
                                </div>
                              )}
                              {t.notes && (
                                <div style={{ 
                                  fontStyle: 'italic', 
                                  color: 'var(--text-muted)', 
                                  padding: '6px 10px', 
                                  background: 'rgba(255,255,255,0.02)', 
                                  borderRadius: '6px', 
                                  border: '1px solid var(--panel-border)',
                                  marginTop: '4px',
                                  fontSize: '0.8rem'
                                }}>
                                  📝 {t.notes}
                                </div>
                              )}
                            </div>

                            {/* Dirección con Botón de Navegación Gps */}
                            <div style={{ 
                              background: 'rgba(255,255,255,0.01)', 
                              border: '1px solid var(--panel-border)', 
                              borderRadius: '8px', 
                              padding: '10px 12px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '10px',
                              marginTop: '10px'
                            }}>
                              <div style={{ fontSize: '0.85rem', lineHeight: '1.3' }}>
                                <strong>{getShortAddressString(t.address)}{t.postcode ? ` - CP ${t.postcode}` : ''}</strong>
                              </div>
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.address)}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="btn btn-secondary btn-small"
                                style={{ display: 'inline-flex', padding: '10px', margin: 0, width: 'auto', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', border: '1px solid var(--primary)' }}
                                title="Iniciar GPS"
                              >
                                <MapPin size={16} color="var(--primary)" />
                              </a>
                            </div>

                            {/* Cobro Contra Reembolso */}
                            {t.codAmount > 0 && (
                              <div style={{ alignSelf: 'flex-start', marginTop: '10px' }}>
                                <div className={`driver-card-cod ${t.status === 'success' ? 'success' : t.status === 'failed' ? 'failed' : ''}`}>
                                  💵 {t.status === 'success' ? 'Cobrado: ' : t.status === 'failed' ? 'No cobrado: ' : 'Cobrar en Destino: '} 
                                  <strong>{t.codAmount.toFixed(2)} €</strong>
                                </div>
                              </div>
                            )}

                            {/* Tareas / Servicios */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px', marginTop: '10px' }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>Servicios:</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {t.tasks.map((task, idx) => {
                                  const tariff = tariffs.find(tar => tar.id === task.tariffId);
                                  const name = task.name || (tariff ? tariff.name : task.tariffId);
                                  return (
                                    <span key={idx} className="badge badge-primary" style={{ fontSize: '0.78rem', padding: '4px 8px' }}>
                                      {name} (x{task.quantity})
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Selector de Medida de TV en Destino basado en Segmented Control / Botones de Píldora */}
                            {(() => {
                              const tvRanges = [];
                              t.tasks.forEach(task => {
                                ['49', '74', '115'].forEach(r => {
                                  if (task.tariffId.endsWith(`_${r}`) && !tvRanges.includes(r)) {
                                    tvRanges.push(r);
                                  }
                                });
                              });

                              if (tvRanges.length === 0 || isClosed) return null;

                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed rgba(255, 255, 255, 0.05)', paddingTop: '10px', marginTop: '4px' }}>
                                  {tvRanges.map(range => {
                                    return (
                                      <div key={range} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '700' }}>
                                          Ajustar tamaño de TV en Destino:
                                        </span>
                                        <div className="pill-selector">
                                          <button 
                                            type="button" 
                                            className={`pill-option ${range === '49' ? 'active' : ''}`}
                                            onClick={() => handleUpdateTicketTvSize(t.id, range, '49')}
                                          >
                                            Hasta 49"
                                          </button>
                                          <button 
                                            type="button" 
                                            className={`pill-option ${range === '74' ? 'active' : ''}`}
                                            onClick={() => handleUpdateTicketTvSize(t.id, range, '74')}
                                          >
                                            50" a 74"
                                          </button>
                                          <button 
                                            type="button" 
                                            className={`pill-option ${range === '115' ? 'active' : ''}`}
                                            onClick={() => handleUpdateTicketTvSize(t.id, range, '115')}
                                          >
                                            75" a 115"
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            {/* Acciones del Chofer en la Tarjeta */}
                            {!isClosed && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', marginTop: '4px' }}>
                                {(!t.status || t.status === 'pending') ? (
                                  <button
                                    type="button"
                                    onClick={() => handleStartTransit(t.id)}
                                    style={{
                                      padding: '12px',
                                      borderRadius: '8px',
                                      border: 'none',
                                      background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                                      color: '#fff',
                                      fontSize: '0.85rem',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px',
                                      width: '100%'
                                    }}
                                  >
                                    <Navigation size={16} /> Navegar
                                  </button>
                                ) : t.status === 'transit' ? (
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateTicketStatus(t.id, 'success')}
                                      style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#10b981',
                                        color: '#fff',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        fontWeight: '700',
                                        flex: 1,
                                        boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      🟢 Éxito
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setQuickFailTicketId(t.id)}
                                      style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#ef4444',
                                        color: '#fff',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        fontWeight: '700',
                                        flex: 1,
                                        boxShadow: '0 4px 10px rgba(239, 68, 68, 0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      🔴 Fallido
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateTicketStatus(t.id, 'pending')}
                                    className="btn btn-secondary btn-small"
                                    style={{
                                      alignSelf: 'flex-start',
                                      fontSize: '0.75rem',
                                      padding: '6px 12px',
                                      margin: 0
                                    }}
                                  >
                                    🔄 Reabrir / Pendiente
                                  </button>
                                )}

                                {/* Atajos Directos si está pendiente para marcar de un click */}
                                {(!t.status || t.status === 'pending') && (
                                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateTicketStatus(t.id, 'success')}
                                      style={{
                                        padding: '6px 8px',
                                        border: '1px solid rgba(74, 222, 128, 0.15)',
                                        background: 'rgba(74, 222, 128, 0.03)',
                                        color: '#4ade80',
                                        fontSize: '0.72rem',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        flex: 1,
                                        fontWeight: '600'
                                      }}
                                    >
                                      Entregado
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setQuickFailTicketId(t.id)}
                                      style={{
                                        padding: '6px 8px',
                                        border: '1px solid rgba(248, 113, 113, 0.15)',
                                        background: 'rgba(248, 113, 113, 0.03)',
                                        color: '#f87171',
                                        fontSize: '0.72rem',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        flex: 1,
                                        fontWeight: '600'
                                      }}
                                    >
                                      Fallido
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}

        {activeTab === 'search' && renderSearchSection()}

        {/* Modal de Presintonías de Motivo de Fallo Rápido */}
        {quickFailTicketId !== null && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}>
            <div className="glass-panel" style={{
              width: '100%',
              maxWidth: '360px',
              padding: '25px',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              border: '1px solid var(--panel-border)'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: 'var(--danger)' }}>
                🔴 Registrar Motivo de Fallo
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Selecciona una de las opciones rápidas para liquidar la parada:
              </p>

              <div className="quick-fail-grid">
                <button 
                  type="button" 
                  className="quick-fail-btn"
                  onClick={() => {
                    handleUpdateTicketStatus(quickFailTicketId, 'failed', 'Ausente');
                    setQuickFailTicketId(null);
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>👤</span>
                  Ausente
                </button>
                <button 
                  type="button" 
                  className="quick-fail-btn"
                  onClick={() => {
                    handleUpdateTicketStatus(quickFailTicketId, 'failed', 'Rechazado');
                    setQuickFailTicketId(null);
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>❌</span>
                  Rechazado
                </button>
                <button 
                  type="button" 
                  className="quick-fail-btn"
                  onClick={() => {
                    handleUpdateTicketStatus(quickFailTicketId, 'failed', 'No responde');
                    setQuickFailTicketId(null);
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>📞</span>
                  No responde
                </button>
                <button 
                  type="button" 
                  className="quick-fail-btn"
                  onClick={() => {
                    handleUpdateTicketStatus(quickFailTicketId, 'failed', 'Dirección Incorrecta');
                    setQuickFailTicketId(null);
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>📍</span>
                  Dir. Incorrecta
                </button>
              </div>

              <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const customReason = window.prompt('Escribe el motivo del fallo:');
                    if (customReason !== null) {
                      handleUpdateTicketStatus(quickFailTicketId, 'failed', customReason || 'Otro motivo');
                      setQuickFailTicketId(null);
                    }
                  }}
                  className="btn btn-secondary btn-small"
                  style={{ width: '100%', marginBottom: '10px' }}
                >
                  ✏️ Otro Motivo (Escribir)
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFailTicketId(null)}
                  className="btn btn-link btn-small"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- PANEL DE DETALLE FLOTANTE EN EL MAPA ---
  const renderMapFloatingPanel = () => {
    // 1. Obtener el ticket a mostrar (el seleccionado o el siguiente pendiente)
    let ticketToShow = selectedMapTicket;
    
    // Si no hay seleccionado, buscar la siguiente parada pendiente de los tickets visibles en este mapa
    if (!ticketToShow) {
      const targetDate = activeTab === 'map' ? mapFilterDate : (shiftSummaryDate || new Date().toISOString().split('T')[0]);
      
      const dayTickets = (tickets || []).filter(t => {
        if (!t) return false;
        if (t.date !== targetDate) return false;
        if (activeTab === 'map') {
          if (mapFilterFurgo !== 'all' && t.furgoId !== mapFilterFurgo) return false;
        } else {
          if (t.furgoId !== currentUser?.id) return false;
        }
        return true;
      });

      const sorted = sortTicketsByRouteOrder(dayTickets);
      // Encontrar el primero que no sea éxito ni fallido
      ticketToShow = sorted.find(t => t && t.status !== 'success' && t.status !== 'failed');
    }

    if (!ticketToShow) {
      return (
        <div className="map-floating-details-empty">
          <span>✨ Ruta finalizada o sin paradas planificadas para hoy</span>
        </div>
      );
    }

    const isSuccess = ticketToShow.status === 'success';
    const isFailed = ticketToShow.status === 'failed';
    const isTransit = ticketToShow.status === 'transit';
    const statusText = isSuccess ? '🟢 Completado' : isFailed ? `🔴 Fallido (${ticketToShow.failureReason || 'Sin motivo'})` : isTransit ? '🔵 En Camino' : '🟡 Pendiente';

    const furgoLabel = users.find(u => u.id === ticketToShow.furgoId)?.label || ticketToShow.furgoId || '';
    const stopIndex = (tickets || []).filter(tk => tk && ticketToShow && tk.date === ticketToShow.date && tk.furgoId === ticketToShow.furgoId)
                             .sort((a,b) => {
                               const aOrd = a && a.routeOrder !== undefined && a.routeOrder !== null && a.routeOrder !== '' ? Number(a.routeOrder) : Infinity;
                               const bOrd = b && b.routeOrder !== undefined && b.routeOrder !== null && b.routeOrder !== '' ? Number(b.routeOrder) : Infinity;
                               return aOrd - bOrd;
                             })
                             .findIndex(tk => tk && tk.id === ticketToShow.id) + 1;

    return (
      <div className="map-floating-details">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div className="map-floating-title-container">
              {(() => {
                const dayTicketsCount = (tickets || []).filter(tk => tk && ticketToShow && tk.date === ticketToShow.date && tk.furgoId === ticketToShow.furgoId).length;
                if (dayTicketsCount > 1) {
                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <span className="map-floating-badge-stop" style={{ paddingRight: '2px' }}>Parada #</span>
                      <select 
                        value={stopIndex}
                        onChange={(e) => {
                          e.stopPropagation();
                          changeTicketRouteOrder(ticketToShow, Number(e.target.value));
                        }}
                        style={{
                          background: 'var(--primary)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '4px',
                          padding: '1px 6px 1px 4px',
                          fontSize: '0.68rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          outline: 'none',
                          height: '18px',
                          lineHeight: '1',
                          margin: 0
                        }}
                      >
                        {Array.from({ length: dayTicketsCount }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num} style={{ background: '#141628', color: '#fff' }}>
                            {num}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return <span className="map-floating-badge-stop">Parada #{stopIndex || '?'}</span>;
              })()}
              <h4 className="map-floating-title">{ticketToShow.customerName || ''}</h4>
            </div>
            {isMapPanelExpanded && (
              <p className="map-floating-subtitle">🚚 Chofer: {furgoLabel} • {statusText}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            <button
              type="button"
              className="map-floating-toggle-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsMapPanelExpanded(!isMapPanelExpanded);
                if (mapSelectTimerRef.current) {
                  clearTimeout(mapSelectTimerRef.current);
                  mapSelectTimerRef.current = null;
                }
              }}
              title={isMapPanelExpanded ? "Minimizar panel" : "Ver detalles"}
            >
              {isMapPanelExpanded ? '▼' : '▲'}
            </button>
            {selectedMapTicket && (
              <button 
                type="button" 
                className="map-floating-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMapTicket(null);
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {isMapPanelExpanded && (
          <>
            <div className="map-floating-info-row" style={{ marginTop: '4px' }}>
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>📍</span>
              <span className="map-floating-info-text">{getShortAddressString(ticketToShow.address)} {ticketToShow.postcode && `(CP ${ticketToShow.postcode})`}</span>
            </div>

            {ticketToShow.phone && (
              <div className="map-floating-info-row">
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>📞</span>
                <a href={`tel:${ticketToShow.phone}`} className="map-floating-phone-link">
                  {ticketToShow.phone}
                </a>
              </div>
            )}

            {/* Resumen rápido de artículos de la parada */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '6px' }}>
              {(ticketToShow.tasks || []).map((task, idx) => {
                if (!task) return null;
                return (
                  <span key={idx} className="map-floating-task-badge">
                    {task.name || ''} {task.quantity > 1 && `x${task.quantity}`}
                  </span>
                );
              })}
              {ticketToShow.codAmount && parseFloat(ticketToShow.codAmount) > 0 && (
                <span className="map-floating-task-badge" style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fbbf24', fontWeight: '700' }}>
                  💵 Reembolso: {parseFloat(ticketToShow.codAmount).toFixed(2)} €
                </span>
              )}
            </div>

            {/* Botones de acción rápida */}
            <div className="map-floating-actions-container">
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticketToShow.address || '')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-primary btn-small map-floating-action-btn"
                style={{ margin: 0, padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flex: 1 }}
              >
                <Navigation size={14} style={{ marginRight: '2px' }} /> Navegar
              </a>
              {ticketToShow.phone && (
                <a 
                  href={`tel:${ticketToShow.phone}`}
                  className="btn btn-secondary btn-small map-floating-action-btn"
                  style={{ margin: 0, padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flex: 1 }}
                >
              📞 Llamar
            </a>
          )}
        </div>
      </>
    )}
  </div>
);
};

  const renderMapStopsList = (isAdminMap) => {
    const targetDate = isAdminMap ? mapFilterDate : (shiftSummaryDate || new Date().toISOString().split('T')[0]);
    
    const dayTickets = (tickets || []).filter(t => {
      if (!t) return false;
      if (t.date !== targetDate) return false;
      if (isAdminMap) {
        if (mapFilterFurgo !== 'all' && t.furgoId !== mapFilterFurgo) return false;
      } else {
        if (t.furgoId !== currentUser?.id) return false;
      }
      return true;
    });

    const sortedDayTickets = sortTicketsByRouteOrder(dayTickets);

    if (sortedDayTickets.length === 0) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No hay paradas planificadas para este día.
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 5px 0' }}>
          📋 Secuencia de Paradas ({sortedDayTickets.length})
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sortedDayTickets.map((t, index) => {
            const isSuccess = t.status === 'success';
            const isFailed = t.status === 'failed';
            const isTransit = t.status === 'transit';
            const statusColor = isSuccess ? '#10b981' : isFailed ? '#ef4444' : isTransit ? '#38bdf8' : '#fbbf24';
            const statusLabel = isSuccess ? 'Entregado' : isFailed ? 'Fallido' : isTransit ? 'En Camino' : 'Pendiente';
            
            const isSelected = selectedMapTicket && selectedMapTicket.id === t.id;
            const furgoLabel = users.find(u => u.id === t.furgoId)?.label || t.furgoId || '';

            return (
              <div 
                key={t.id}
                onClick={() => {
                  setSelectedMapTicket(t);
                  const latNum = parseFloat(t.lat);
                  const lngNum = parseFloat(t.lng);
                  if (mapInstanceRef.current && !isNaN(latNum) && !isNaN(lngNum)) {
                    mapInstanceRef.current.setView([latNum, lngNum], 16);
                  }
                }}
                className="glass-panel"
                style={{
                  padding: '15px',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--panel-border)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: isSelected ? 'rgba(79, 70, 229, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                  textAlign: 'left',
                  boxShadow: isSelected ? '0 0 15px rgba(79, 70, 229, 0.2)' : 'none',
                  borderRadius: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: statusColor,
                      color: '#000',
                      fontWeight: '800',
                      fontSize: '0.85rem',
                      boxShadow: `0 0 8px ${statusColor}40`
                    }}>
                      {index + 1}
                    </span>
                    <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{t.customerName || 'Cliente sin nombre'}</strong>
                  </div>
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: `${statusColor}20`,
                    color: statusColor,
                    fontWeight: '800',
                    whiteSpace: 'nowrap'
                  }}>
                    {statusLabel}
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ flexShrink: 0 }}>📍</span>
                    <span>{getShortAddressString(t.address)} {t.postcode && `(CP ${t.postcode})`}</span>
                  </div>
                  {t.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ flexShrink: 0 }}>📞</span>
                      <a href={`tel:${t.phone}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }} onClick={e => e.stopPropagation()}>{t.phone}</a>
                    </div>
                  )}
                  {isAdminMap && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span>🚚</span>
                      <span>Vehículo: <strong>{furgoLabel}</strong></span>
                    </div>
                  )}
                </div>

                {/* Resumen de artículos */}
                {((t.tasks || []).length > 0 || (t.codAmount && parseFloat(t.codAmount) > 0)) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    {(t.tasks || []).map((task, idx) => {
                      if (!task) return null;
                      const tariff = tariffs.find(tar => tar.id === task.tariffId);
                      const taskName = tariff ? tariff.name : task.tariffId;
                      return (
                        <span key={idx} style={{
                          fontSize: '0.7rem',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'var(--text-main)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}>
                          {task.quantity}x {taskName}
                        </span>
                      );
                    })}
                    {t.codAmount && parseFloat(t.codAmount) > 0 && (
                      <span style={{
                        fontSize: '0.7rem',
                        background: 'rgba(251, 191, 36, 0.15)',
                        border: '1px solid rgba(251, 191, 36, 0.3)',
                        color: '#fbbf24',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: '700'
                      }}>
                        💵 Reembolso: {parseFloat(t.codAmount).toFixed(2)} €
                      </span>
                    )}
                  </div>
                )}
                
                {/* Notas y motivo de fallo en panel expandido */}
                {isSelected && (
                  <div style={{
                    marginTop: '5px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    {t.notes && (
                      <div>
                        <strong>Notas:</strong> {t.notes}
                      </div>
                    )}
                    {isFailed && t.failureReason && (
                      <div style={{ color: '#ef4444' }}>
                        <strong>Motivo de Fallo:</strong> {t.failureReason}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.address || '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-small"
                        style={{ margin: 0, padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flex: 1, height: 'auto' }}
                        onClick={e => e.stopPropagation()}
                      >
                        🧭 Navegar
                      </a>
                      
                      {isAdminMap && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingTicket(t);
                          }}
                          className="btn btn-secondary btn-small"
                          style={{ margin: 0, padding: '6px 10px', fontSize: '0.75rem', flex: 1, height: 'auto' }}
                        >
                          ✏️ Editar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- SECCIÓN DE BÚSQUEDA GENERAL ---
  const renderSearchSection = () => {
    return (
      <div className="glass-panel" style={{ textAlign: 'left' }}>
        <h2>🔍 Buscador General de Repartos</h2>
        <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
          Busca en todo el historial acumulado por nombre de cliente o dirección. 
          Encuentra qué día se realizó la visita, qué furgoneta lo atendió y los servicios específicos suministrados.
        </p>

        {/* Input de Búsqueda */}
        <div style={{ marginBottom: '25px', position: 'relative' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Escribe el nombre del cliente, dirección, teléfono..."
            value={globalSearchQuery}
            onChange={(e) => setGlobalSearchQuery(e.target.value)}
            style={{
              paddingLeft: '40px',
              height: '45px',
              fontSize: '1rem',
              borderRadius: '10px'
            }}
          />
          <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            🔍
          </span>
        </div>

        {/* Resultados de Búsqueda */}
        {(() => {
          const query = globalSearchQuery.trim().toLowerCase();
          if (!query) {
            return (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>Escribe una palabra clave arriba para iniciar la búsqueda en todo el historial.</p>
              </div>
            );
          }

          // A los repartidores con permiso solo les dejamos buscar sus propios tickets, a los administradores todos
          const searchTickets = isAdminOrSuper ? tickets : tickets.filter(t => t.furgoId === currentUser.id);

          const matches = searchTickets.filter(t => {
            const nameMatch = t.customerName && t.customerName.toLowerCase().includes(query);
            const addressMatch = t.address && t.address.toLowerCase().includes(query);
            const phoneMatch = t.phone && t.phone.toLowerCase().includes(query);
            const notesMatch = t.notes && t.notes.toLowerCase().includes(query);
            return nameMatch || addressMatch || phoneMatch || notesMatch;
          });

          if (matches.length === 0) {
            return (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>❌ No se encontraron visitas que coincidan con la búsqueda.</p>
              </div>
            );
          }

          return (
            <div style={{ overflowX: 'auto' }}>
              <table className="delivery-table">
                <thead>
                  <tr>
                    <th>Fecha de Visita</th>
                    <th>Cliente</th>
                    <th>Dirección / Población</th>
                    <th>Ruta / Chofer</th>
                    <th>Servicios Suministrados</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map(ticket => {
                    const driver = users.find(u => u.id === ticket.furgoId);
                    const driverLabel = driver ? driver.label : ticket.furgoId;
                    
                    let statusBadge = <span className="badge badge-secondary">Planificado</span>;
                    if (ticket.status === 'success') {
                      statusBadge = <span className="badge badge-success" style={{ background: '#10b981', color: '#fff' }}>🟢 Éxito</span>;
                    } else if (ticket.status === 'failed') {
                      statusBadge = <span className="badge badge-danger" style={{ background: '#ef4444', color: '#fff' }}>🔴 Fallido</span>;
                    } else if (ticket.status === 'transit') {
                      statusBadge = <span className="badge" style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 'bold' }}>🔵 En Camino</span>;
                    }

                    return (
                      <tr key={ticket.id}>
                        <td style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>
                          {ticket.date}
                        </td>
                        <td>
                          <div style={{ fontWeight: '600' }}>{ticket.customerName}</div>
                          {ticket.phone && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>📞 {ticket.phone}</div>}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem', lineHeight: '1.3' }}>{ticket.address}</div>
                          {ticket.postcode && (
                            <span className="badge" style={{ 
                              fontSize: '0.7rem', 
                              padding: '2px 6px', 
                              marginTop: '4px', 
                              display: 'inline-block',
                              background: 'rgba(99, 102, 241, 0.15)',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              color: '#a5b4fc',
                              borderRadius: '4px'
                            }}>
                              CP {ticket.postcode}
                            </span>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          🚚 {driverLabel}
                        </td>
                        <td>
                          <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '0.82rem', lineHeight: '1.4' }}>
                            {ticket.tasks.map((task, idx) => {
                              const tariff = tariffs.find(tar => tar.id === task.tariffId);
                              const name = task.name || (tariff ? tariff.name : task.tariffId);
                              return (
                                <li key={idx}>
                                  {name} <span style={{ color: 'var(--text-muted)' }}>(x{task.quantity})</span>
                                </li>
                              );
                            })}
                          </ul>
                          {ticket.notes && (
                            <div style={{ 
                              fontSize: '0.78rem', 
                              color: 'var(--text-muted)', 
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid var(--panel-border)',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              marginTop: '6px'
                            }}>
                              📝 {ticket.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {statusBadge}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => startEditing(ticket)}
                            className="btn btn-secondary btn-small"
                            style={{ margin: 0, padding: '4px 10px', fontSize: '0.75rem', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            ✏️ Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
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
    const furgos = activeRepartidores.map(u => u.id);

    const furgoData = furgos.reduce((acc, fid) => {
      const fTickets = filteredAdminTickets.filter(t => t.furgoId === fid);
      const fSuccess = fTickets.filter(t => t.status === 'success' || !t.status);
      
      let pms = 0;
      let deliveries = 0;
      fSuccess.forEach(t => {
        t.tasks.forEach(task => {
          const tid = task.tariffId || '';
          if (tid.startsWith('PM_')) {
            pms += task.quantity;
          }
          if (tid.startsWith('ENTREGA_') || tid.startsWith('TV_ENT_') || tid.startsWith('TV_COMB_')) {
            deliveries += task.quantity;
          }
        });
      });

      // Get all closed shifts for this furgoneta in the filtered period
      const fShifts = shifts.filter(s => 
        s.furgoId === fid && 
        s.status === 'closed' &&
        (!adminStartDate || s.date >= adminStartDate) &&
        (!adminEndDate || s.date <= adminEndDate)
      );
      
      let fMileageEarnings = 0;
      let fKms = 0;
      fShifts.forEach(s => {
        const kms = getRouteKms(fid, s.date);
        fKms += kms;
        fMileageEarnings += kms * kmPrice;
      });

      acc[fid] = {
        count: fTickets.length,
        successCount: fSuccess.length,
        earnings: fSuccess.reduce((sum, t) => sum + t.totalPrice, 0) + fMileageEarnings,
        mileageEarnings: fMileageEarnings,
        kms: fKms,
        pms,
        deliveries
      };
      return acc;
    }, {});

    const totalMileageEarnings = furgos.reduce((sum, fid) => sum + (furgoData[fid]?.mileageEarnings || 0), 0);
    const totalEarnings = successTickets.reduce((sum, t) => sum + t.totalPrice, 0) + totalMileageEarnings;
    const totalKmsAllFurgos = furgos.reduce((sum, fid) => sum + (furgoData[fid]?.kms || 0), 0);

    const maxEarnings = Math.max(...Object.values(furgoData).map(d => d.earnings), 1);

    // Contadores (Solo cuenta de paradas con éxito)
    let totalPMs = 0;
    let totalCustomEarnings = 0;
    successTickets.forEach(t => {
      t.tasks.forEach(task => {
        const tid = task.tariffId || '';
        if (tid.startsWith('PM_')) {
          totalPMs += task.quantity;
        }
        if (tid.startsWith('CUSTOM_')) {
          totalCustomEarnings += (task.unitPrice || task.price || 0) * task.quantity;
        }
      });
    });

    return (
      <div>
        <div className="tab-container">
          <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('dashboard'); }}>Dashboard</button>
          <button className={`tab-btn ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>Repartos del Periodo ({filteredAdminTickets.length})</button>
          <button className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('map'); }}>🗺️ Mapa de Control</button>
          {hasSearchPermission && (
            <button className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('search'); }}>🔍 Buscador General</button>
          )}
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
              <div className="stat-card success" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p>Total Mes</p>
                <div className="stat-val" style={{ lineHeight: 1 }}>{totalEarnings.toFixed(2)} €</div>
                <span style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>Incluye {totalMileageEarnings.toFixed(2)} € km ({totalKmsAllFurgos.toFixed(1)} km)</span>
              </div>
              <div className="stat-card info" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p>Entregas</p>
                <div className="stat-val" style={{ lineHeight: 1 }}>{successTickets.length}</div>
                <span style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '4px' }}>de {filteredAdminTickets.length} totales</span>
              </div>
              <div className="stat-card warning">
                <p>Puestas en Marcha</p>
                <div className="stat-val">{totalPMs}</div>
              </div>
              <div className="stat-card danger">
                <p>Adicionales Mes</p>
                <div className="stat-val">{totalCustomEarnings.toFixed(2)} €</div>
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
                        <th style={{ textAlign: 'center' }}>PMs</th>
                        <th style={{ textAlign: 'center' }}>Entregas</th>
                        <th style={{ textAlign: 'center' }}>Kms</th>
                        <th style={{ textAlign: 'right' }}>Kilometraje €</th>
                        <th style={{ textAlign: 'right' }}>Base Imponible</th>
                        <th style={{ textAlign: 'right' }}>IVA (+21%)</th>
                        <th style={{ textAlign: 'right' }}>Retención (-1%)</th>
                        <th style={{ textAlign: 'right' }}>Total Neto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {furgos.map(fid => {
                        const data = furgoData[fid] || { count: 0, successCount: 0, earnings: 0, mileageEarnings: 0, kms: 0, pms: 0, deliveries: 0 };
                        const base = data.earnings;
                        const iva = base * 0.21;
                        const retencion = base * 0.01;
                        const totalNeto = base + iva - retencion;
                        const label = users.find(u => u.id === fid)?.label || fid;
                        return (
                          <tr key={fid}>
                            <td style={{ fontWeight: '600' }}>{label}</td>
                            <td style={{ textAlign: 'center' }}>{data.successCount} / {data.count}</td>
                            <td style={{ textAlign: 'center', fontWeight: '500' }}>{data.pms}</td>
                            <td style={{ textAlign: 'center', fontWeight: '500' }}>{data.deliveries}</td>
                            <td style={{ textAlign: 'center', fontWeight: '500' }}>{data.kms.toFixed(1)} km</td>
                            <td style={{ textAlign: 'right', fontWeight: '500', color: 'var(--primary)' }}>{data.mileageEarnings.toFixed(2)} €</td>
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
              <div className="input-group">
                <span className="input-label">Código Postal</span>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: 08208" 
                  value={ticketFilterPostcode} 
                  onChange={(e) => setTicketFilterPostcode(e.target.value)} 
                />
              </div>
            </div>

            {ticketFilterFurgo !== 'all' && ticketFilterDate && (
              <div className="glass-panel" style={{ marginTop: '10px', marginBottom: '25px', padding: '20px', border: '1px solid var(--panel-border)', borderRadius: '12px', textAlign: 'left', background: 'rgba(255,255,255,0.01)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', margin: '0 0 10px 0', fontSize: '1.05rem' }}>
                  ⚡ Optimización de Ruta (Furgoneta: {activeRepartidores.find(r => r.id === ticketFilterFurgo)?.label || ticketFilterFurgo})
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                  Ordena de forma eficiente las paradas del día ({ticketFilterDate}) desde la más cercana a la más lejana basándose en tus puntos de partida y destino final.
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                  <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                    <span className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🏁 Punto de Partida (Inicio)</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!!(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                          <button
                            type="button"
                            onClick={handleStartStartVoiceInput}
                            style={{
                              background: 'transparent', border: 'none', color: isListeningStart ? 'var(--danger)' : 'var(--primary)',
                              fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                              fontWeight: isListeningStart ? 'bold' : 'normal',
                              animation: isListeningStart ? 'gpsPulse 1.5s infinite ease-in-out' : 'none'
                            }}
                          >
                            🎙️ {isListeningStart ? 'Escuchando...' : 'Dictar'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => fillCurrentLocation('start')}
                          style={{
                            background: 'transparent', border: 'none', color: 'var(--primary)',
                            fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0
                          }}
                        >
                          📍 Usar GPS
                        </button>
                      </div>
                    </span>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Calle del Almacén 1, Madrid" 
                      value={routeStartAddr} 
                      onChange={(e) => {
                        setRouteStartAddr(e.target.value);
                        handleFetchRouteSuggestions(e.target.value, 'start');
                      }}
                    />
                    {renderRouteSuggestions('start')}
                  </div>
                  <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                    <span className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🏁 Punto de Llegada (Retorno/Fin)</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!!(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                          <button
                            type="button"
                            onClick={handleStartEndVoiceInput}
                            style={{
                              background: 'transparent', border: 'none', color: isListeningEnd ? 'var(--danger)' : 'var(--primary)',
                              fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                              fontWeight: isListeningEnd ? 'bold' : 'normal',
                              animation: isListeningEnd ? 'gpsPulse 1.5s infinite ease-in-out' : 'none'
                            }}
                          >
                            🎙️ {isListeningEnd ? 'Escuchando...' : 'Dictar'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => fillCurrentLocation('end')}
                          style={{
                            background: 'transparent', border: 'none', color: 'var(--primary)',
                            fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0
                          }}
                        >
                          📍 Usar GPS
                        </button>
                      </div>
                    </span>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Calle del Almacén 1, Madrid (o vacío)" 
                      value={routeEndAddr} 
                      onChange={(e) => {
                        setRouteEndAddr(e.target.value);
                        handleFetchRouteSuggestions(e.target.value, 'end');
                      }}
                    />
                    {renderRouteSuggestions('end')}
                  </div>
                  <div className="input-group" style={{ marginBottom: 0, justifyContent: 'flex-end', display: 'flex', flexDirection: 'column' }}>
                    <button 
                      type="button" 
                      onClick={handleOptimizeRoute} 
                      className="btn btn-primary" 
                      style={{ height: '45px', margin: 0, fontWeight: '700', letterSpacing: '0.5px' }}
                      disabled={isOptimizing}
                    >
                      {isOptimizing ? 'Calculando Ruta Óptima...' : '⚡ Optimizar Ruta'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {getFilteredTickets().length === 0 ? (
              <div style={{ padding: '30px', color: 'var(--text-muted)' }}>No se encontraron registros.</div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      {isSingleRouteFiltered && <th style={{ width: '80px', textAlign: 'center' }}>Orden</th>}
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
                    {getFilteredTickets().map((t, idx, arr) => (
                      <tr key={t.id}>
                        {isSingleRouteFiltered && (
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 'bold', minWidth: '20px', fontSize: '0.85rem' }}>#{idx + 1}</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleMoveTicketOrder(t.id, 'up')}
                                  className="btn btn-secondary btn-small"
                                  style={{ padding: '1px 4px', fontSize: '0.6rem', margin: 0, visibility: idx === 0 ? 'hidden' : 'visible', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  title="Subir parada"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveTicketOrder(t.id, 'down')}
                                  className="btn btn-secondary btn-small"
                                  style={{ padding: '1px 4px', fontSize: '0.6rem', margin: 0, visibility: idx === arr.length - 1 ? 'hidden' : 'visible', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  title="Bajar parada"
                                >
                                  ▼
                                </button>
                              </div>
                            </div>
                          </td>
                        )}
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                             {t.postcode && (
                               <span className="badge badge-primary" style={{ padding: '2px 6px', fontSize: '0.7rem', fontWeight: 'bold', background: 'rgba(99, 102, 241, 0.25)', border: '1px solid rgba(99, 102, 241, 0.5)', color: '#c7d2fe' }}>
                                 CP {t.postcode}
                               </span>
                             )}
                             <span>{getShortAddressString(t.address || '')}</span>
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
                        <td>
                          {(() => {
                            const parsed = parseTicketNotes(t.notes);
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {parsed.timeSlot !== 'any' && (
                                    <span className="badge" style={{
                                      fontSize: '0.65rem',
                                      padding: '1px 5px',
                                      background: parsed.timeSlot === 'morning' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                      color: parsed.timeSlot === 'morning' ? '#fbbf24' : '#38bdf8',
                                      border: parsed.timeSlot === 'morning' ? '1px solid rgba(251, 191, 36, 0.25)' : '1px solid rgba(56, 189, 248, 0.25)',
                                      fontWeight: 'bold',
                                      borderRadius: '4px'
                                    }}>
                                      {parsed.timeSlot === 'morning' ? '☀️ Mañana' : '🌙 Tarde'}
                                    </span>
                                  )}
                                  <span className="badge" style={{
                                    fontSize: '0.65rem',
                                    padding: '1px 5px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--panel-border)',
                                    color: 'var(--text-muted)',
                                    fontWeight: 'bold',
                                    borderRadius: '4px'
                                  }}>
                                    ⏱️ {parsed.estimatedDuration} min
                                  </span>
                                </div>
                                <span 
                                  style={{ fontStyle: 'italic', fontSize: '0.85rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} 
                                  title={parsed.cleanNotes}
                                >
                                  {parsed.cleanNotes || '-'}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {t.tasks && t.tasks.map((task, idx) => {
                              if (!task) return null;
                              const tariff = tariffs.find(tar => tar.id === task.tariffId);
                              const name = task.name || (tariff ? tariff.name : task.tariffId);
                              return (
                                <span key={idx} className="badge badge-secondary" style={{ border: '1px solid var(--panel-border)', fontSize: '0.7rem' }}>
                                  {name} (x{task.quantity || 1})
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td style={{ fontWeight: '700', color: t.status === 'failed' ? 'var(--text-muted)' : 'var(--success)' }}>
                          {t.status === 'failed' ? '0.00' : (t.totalPrice || 0).toFixed(2)} €
                        </td>
                        <td>
                          {(() => {
                            const isSuccess = t.status === 'success';
                            const isFailed = t.status === 'failed';
                            const isTransit = t.status === 'transit';
                            
                            let badgeClass = 'badge-warning';
                            let badgeText = '🟡 Pendiente';
                            
                            if (isSuccess || (!t.status)) {
                              badgeClass = 'badge-success';
                              badgeText = '🟢 Éxito';
                            } else if (isFailed) {
                              badgeClass = 'badge-danger';
                              badgeText = `🔴 Fallido ${t.failureReason ? `(${t.failureReason})` : ''}`;
                            } else if (isTransit) {
                              badgeClass = 'badge-primary';
                              badgeText = '🔵 En Camino';
                            }
                            
                            return (
                              <span className={`badge ${badgeClass}`} style={{ fontSize: '0.75rem' }} title={t.failureReason}>
                                {badgeText}
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
                                  const existingKms = getRouteKms(s.furgoId, s.date);
                                  setShiftKmsInput(existingKms > 0 ? existingKms.toString() : '');
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

              .map-split-container {
                display: flex;
                flex-direction: column;
                gap: 15px;
                margin-top: 15px;
                height: 720px;
                align-items: stretch;
              }
              
              .map-split-left {
                width: 100%;
                height: 320px;
                flex-shrink: 0;
              }
              
              .map-split-right {
                width: 100%;
                flex-grow: 1;
                overflow-y: auto;
                padding-right: 5px;
                border-top: 1px solid var(--panel-border);
                padding-top: 15px;
              }

              @media (min-width: 992px) {
                .map-split-container {
                  flex-direction: row;
                  height: 650px;
                }
                
                .map-split-left {
                  width: 55%;
                  height: 100% !important;
                }
                
                .map-split-right {
                  width: 45%;
                  height: 100% !important;
                  border-top: none;
                  padding-top: 0;
                  border-left: 1px solid var(--panel-border);
                  padding-left: 15px;
                }
              }
            `}</style>

            <div className="map-split-container">
              <div className="map-split-left">
                <div 
                  key={`admin-map-${mapFilterDate}-${mapFilterFurgo}-${activeTab}`}
                  id="admin-map" 
                  style={{ 
                    height: '100%', 
                    borderRadius: '12px', 
                    border: '1px solid var(--panel-border)', 
                    background: '#1e1e1e',
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.25)',
                    zIndex: 1
                  }}
                ></div>
              </div>
              
              <div className="map-split-right">
                {renderMapStopsList(true)}
              </div>
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
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#38bdf8' }}></span>
                <span>En Camino</span>
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

            {mapFilterFurgo !== 'all' && (
              <div className="glass-panel" style={{ marginTop: '20px', padding: '20px', border: '1px solid var(--panel-border)', borderRadius: '12px', textAlign: 'left', background: 'rgba(255,255,255,0.01)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', margin: '0 0 10px 0', fontSize: '1.05rem' }}>
                  ⚡ Optimización de Ruta (Furgoneta: {activeRepartidores.find(r => r.id === mapFilterFurgo)?.label || mapFilterFurgo})
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                  Organiza de forma eficiente las paradas del día, ordenándolas desde la más cercana a la más lejana basándose en tus puntos de partida y destino final.
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
                  <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                    <span className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🏁 Punto de Partida (Inicio)</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!!(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                          <button
                            type="button"
                            onClick={handleStartStartVoiceInput}
                            style={{
                              background: 'transparent', border: 'none', color: isListeningStart ? 'var(--danger)' : 'var(--primary)',
                              fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                              fontWeight: isListeningStart ? 'bold' : 'normal',
                              animation: isListeningStart ? 'gpsPulse 1.5s infinite ease-in-out' : 'none'
                            }}
                          >
                            🎙️ {isListeningStart ? 'Escuchando...' : 'Dictar'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => fillCurrentLocation('start')}
                          style={{
                            background: 'transparent', border: 'none', color: 'var(--primary)',
                            fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0
                          }}
                        >
                          📍 Usar GPS
                        </button>
                      </div>
                    </span>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Calle del Almacén 1, Madrid" 
                      value={routeStartAddr} 
                      onChange={(e) => {
                        setRouteStartAddr(e.target.value);
                        handleFetchRouteSuggestions(e.target.value, 'start');
                      }}
                    />
                    {renderRouteSuggestions('start')}
                  </div>
                  <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                    <span className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🏁 Punto de Llegada (Retorno/Fin)</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!!(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                          <button
                            type="button"
                            onClick={handleStartEndVoiceInput}
                            style={{
                              background: 'transparent', border: 'none', color: isListeningEnd ? 'var(--danger)' : 'var(--primary)',
                              fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                              fontWeight: isListeningEnd ? 'bold' : 'normal',
                              animation: isListeningEnd ? 'gpsPulse 1.5s infinite ease-in-out' : 'none'
                            }}
                          >
                            🎙️ {isListeningEnd ? 'Escuchando...' : 'Dictar'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => fillCurrentLocation('end')}
                          style={{
                            background: 'transparent', border: 'none', color: 'var(--primary)',
                            fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0
                          }}
                        >
                          📍 Usar GPS
                        </button>
                      </div>
                    </span>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Calle del Almacén 1, Madrid (o vacío)" 
                      value={routeEndAddr} 
                      onChange={(e) => {
                        setRouteEndAddr(e.target.value);
                        handleFetchRouteSuggestions(e.target.value, 'end');
                      }}
                    />
                    {renderRouteSuggestions('end')}
                  </div>
                  <div className="input-group" style={{ marginBottom: 0, justifyContent: 'flex-end', display: 'flex', flexDirection: 'column' }}>
                    <button 
                      type="button" 
                      onClick={handleOptimizeRoute} 
                      className="btn btn-primary" 
                      style={{ height: '45px', margin: 0, fontWeight: '700', letterSpacing: '0.5px' }}
                      disabled={isOptimizing}
                    >
                      {isOptimizing ? 'Calculando Ruta Óptima...' : '⚡ Optimizar Ruta'}
                    </button>
                  </div>
                </div>
              </div>
            )}
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                  <div className="block-section" style={{ marginBottom: 0 }}>
                    <div className="block-title">Valor Unitario del Módulo</div>
                    <input type="number" step="0.01" className="form-input" value={modulePrice} onChange={(e) => handleUpdateModulePrice(e.target.value)} style={{ fontWeight: '700', fontSize: '1.2rem', color: 'var(--primary)', textAlign: 'center' }} />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>Actualmente, cada módulo equivale a {modulePrice.toFixed(2)} €.</p>
                  </div>
                  <div className="block-section" style={{ marginBottom: 0 }}>
                    <div className="block-title">Precio por Kilómetro (€/km)</div>
                    <input type="number" step="0.01" className="form-input" value={kmPrice} onChange={(e) => handleUpdateKmPrice(e.target.value)} style={{ fontWeight: '700', fontSize: '1.2rem', color: 'var(--primary)', textAlign: 'center' }} />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '10px' }}>Actualmente, cada km recorrido equivale a {kmPrice.toFixed(2)} €.</p>
                  </div>
                </div>

                <div className="block-section">
                  <div className="block-title">Ajustes de Geolocalización y Búsqueda</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                    Configura los parámetros para el autocompletado y geocodificación de direcciones en el sistema.
                  </p>
                  
                  <div className="input-group" style={{ marginBottom: '12px' }}>
                    <span className="input-label">País de Búsqueda (Código ISO 2 letras)</span>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: es, mx, ar" 
                      value={searchCountryCode} 
                      onChange={(e) => setSearchCountryCode(e.target.value.toLowerCase().trim())} 
                    />
                  </div>

                  <div className="input-group" style={{ marginBottom: '12px' }}>
                    <span className="input-label">Ciudad / Región de Enfoque</span>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Barcelona, Madrid" 
                      value={searchCityBias} 
                      onChange={(e) => setSearchCityBias(e.target.value)} 
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', padding: '5px 0' }}>
                    <input 
                      type="checkbox" 
                      id="search_strict_city" 
                      checked={searchStrictCity} 
                      onChange={(e) => setSearchStrictCity(e.target.checked)} 
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="search_strict_city" style={{ fontSize: '0.8rem', cursor: 'pointer', userSelect: 'none' }}>
                      Búsqueda estricta en la ciudad enfocada (Autocompleta ciudad)
                    </label>
                  </div>

                  <button 
                    type="button" 
                    onClick={handleSaveMapSettings} 
                    className="btn btn-primary" 
                    style={{ width: '100%', margin: 0, padding: '10px', fontSize: '0.85rem', fontWeight: '700' }}
                  >
                    Guardar Ajustes de Mapa
                  </button>
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
                    saveAppName(appNameInput, currentUser?.id);
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
            
            {/* Puntos de Inicio y Fin de Ruta Predeterminados */}
            <div className="block-section" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', marginBottom: '30px', textAlign: 'left' }}>
              <div className="block-title">📍 Direcciones de Inicio y Fin de Ruta Predeterminadas</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                Define las ubicaciones iniciales y finales para la optimización de las rutas de tus choferes. Esto se sincronizará con la base de datos para todo tu equipo.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="input-label">Ubicación de Salida / Punto de Partida</span>
                    {!!(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                      <button 
                        type="button" 
                        onClick={handleStartStartVoiceInput}
                        className={`btn btn-small ${isListeningStart ? 'btn-danger' : 'btn-secondary'}`}
                        style={{ 
                          padding: '2px 8px', fontSize: '0.7rem', height: '24px', display: 'flex', alignItems: 'center', gap: '3px',
                          background: isListeningStart ? '#ef4444' : '', borderColor: isListeningStart ? '#ef4444' : '', color: '#fff',
                          animation: isListeningStart ? 'gpsPulse 1.5s infinite ease-in-out' : 'none'
                        }}
                      >
                        🎙️ {isListeningStart ? 'Escuchando...' : 'Dictar'}
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: Calle Gran Via, Sabadell, Barcelona" 
                    value={routeStartAddr}
                    onChange={(e) => setRouteStartAddr(e.target.value)}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="input-label">Ubicación de Llegada / Fin de Ruta</span>
                    {!!(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                      <button 
                        type="button" 
                        onClick={handleStartEndVoiceInput}
                        className={`btn btn-small ${isListeningEnd ? 'btn-danger' : 'btn-secondary'}`}
                        style={{ 
                          padding: '2px 8px', fontSize: '0.7rem', height: '24px', display: 'flex', alignItems: 'center', gap: '3px',
                          background: isListeningEnd ? '#ef4444' : '', borderColor: isListeningEnd ? '#ef4444' : '', color: '#fff',
                          animation: isListeningEnd ? 'gpsPulse 1.5s infinite ease-in-out' : 'none'
                        }}
                      >
                        🎙️ {isListeningEnd ? 'Escuchando...' : 'Dictar'}
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: Calle Gran Via, Sabadell, Barcelona" 
                    value={routeEndAddr}
                    onChange={(e) => setRouteEndAddr(e.target.value)}
                  />
                </div>
              </div>
              
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  if (!routeStartAddr.trim() || !routeEndAddr.trim()) {
                    triggerAlert('Las direcciones no pueden estar vacías', 'error');
                    return;
                  }
                  saveRouteStartAddr(routeStartAddr, currentUser?.id);
                  saveRouteEndAddr(routeEndAddr, currentUser?.id);
                  triggerAlert('Puntos de ruta predeterminados guardados y sincronizados');
                }}
                style={{ width: 'auto', marginTop: '20px', height: '42px' }}
              >
                Guardar Puntos Predeterminados
              </button>
            </div>

            {/* API Keys de Proveedores de Mapas */}
            <div className="block-section" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', marginBottom: '30px', textAlign: 'left' }}>
              <div className="block-title">🗺️ Motores de Geolocalización Premium (Google Maps / Mapbox)</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                Si deseas una precisión perfecta en la geolocalización de toda España (incluyendo abreviaturas de calles y lenguas regionales), puedes ingresar tu token de Mapbox o clave de Google Maps. Si se dejan en blanco, la aplicación usará el geolocalizador gratuito OpenStreetMap de forma automática.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <span className="input-label">Mapbox Access Token (Recomendado - 100k búsquedas gratis)</span>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="pk.eyJ1Ijoi..." 
                    value={mapboxTokenInput}
                    onChange={(e) => setMapboxTokenInput(e.target.value)}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <span className="input-label">Google Maps API Key</span>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="AIzaSy..." 
                    value={googleKeyInput}
                    onChange={(e) => setGoogleKeyInput(e.target.value)}
                  />
                </div>
              </div>
              
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  saveGoogleMapsKey(googleKeyInput);
                  saveMapboxToken(mapboxTokenInput);
                  triggerAlert('Configuración de mapas guardada y sincronizada correctamente');
                }}
                style={{ width: 'auto', marginTop: '20px', height: '42px' }}
              >
                Guardar API Keys de Mapas
              </button>
            </div>

            {/* Conexión a Supabase */}
            <div className="block-section" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', marginBottom: '30px' }}>
              <div className="block-title">☁️ Conexión de Base de Datos Cloud (Supabase)</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                Conecta tu aplicación a la nube para sincronizar tus furgonetas, rutas y paradas en tiempo real. 
                Si está configurado, la aplicación sincronizará automáticamente; de lo contrario, funcionará de manera local offline.
              </p>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const urlInput = e.target.elements.supabase_url.value.trim();
                const keyInput = e.target.elements.supabase_key.value.trim();
                
                localStorage.setItem('supabase_url', urlInput);
                localStorage.setItem('supabase_key', keyInput);
                
                reinitSupabase();
                loadData();
                triggerAlert('Ajustes de base de datos guardados y sincronizados', 'success');
              }} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <span className="input-label">Supabase URL</span>
                    <input 
                      type="text" 
                      name="supabase_url"
                      className="form-input" 
                      placeholder="https://xxxxxx.supabase.co" 
                      defaultValue={localStorage.getItem('supabase_url') === 'none' ? '' : (localStorage.getItem('supabase_url') || '')} 
                    />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <span className="input-label">Supabase Anon Key</span>
                    <input 
                      type="password" 
                      name="supabase_key"
                      className="form-input" 
                      placeholder="Clave API pública anon" 
                      defaultValue={localStorage.getItem('supabase_key') === 'none' ? '' : (localStorage.getItem('supabase_key') || '')} 
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 20px', height: '42px', margin: 0 }}>
                    Conectar y Sincronizar
                  </button>
                  {((localStorage.getItem('supabase_url') && localStorage.getItem('supabase_url') !== 'none') || (localStorage.getItem('supabase_key') && localStorage.getItem('supabase_key') !== 'none')) && (
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                        if (window.confirm('¿Seguro que quieres desconectarte de la nube y volver al modo 100% local?')) {
                          localStorage.setItem('supabase_url', 'none');
                          localStorage.setItem('supabase_key', 'none');
                          reinitSupabase();
                          loadData();
                          triggerAlert('Desconectado de la nube. Modo local activado.', 'warning');
                        }
                      }}
                      style={{ width: 'auto', padding: '0 20px', height: '42px', margin: 0 }}
                    >
                      Desconectar / Usar Local
                    </button>
                  )}
                </div>
              </form>
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
                    <div key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--primary)' }}>
                          👤 {u.username} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({u.role === 'superadmin' ? 'Super Admin' : u.role === 'admin' ? 'Administrador' : 'Repartidor'})</span>
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

                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          const labelVal = e.target.elements.user_label.value;
                          const passwordVal = e.target.elements.user_password.value;
                          handleUpdateUser(u.id, labelVal, passwordVal);
                        }} 
                        style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', margin: 0 }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <span className="input-label" style={{ fontSize: '0.75rem' }}>Nombre / Identificador</span>
                            <input 
                              type="text" 
                              name="user_label"
                              className="form-input" 
                              defaultValue={u.label} 
                              style={{ padding: '6px 10px', fontSize: '0.85rem' }} 
                              required
                            />
                          </div>
                          <div className="input-group" style={{ marginBottom: 0 }}>
                            <span className="input-label" style={{ fontSize: '0.75rem' }}>Contraseña / PIN</span>
                            <input 
                              type="text" 
                              name="user_password"
                              className="form-input" 
                              defaultValue={u.password} 
                              style={{ padding: '6px 10px', fontSize: '0.85rem' }} 
                              required
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center', marginTop: '5px' }}>
                          {currentUser.role === 'superadmin' && u.id !== 'admin' && (
                            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginRight: 'auto' }}>
                              <input 
                                type="checkbox" 
                                checked={!!u.canSearch} 
                                onChange={() => {
                                  toggleUserSearchPermission(u.id);
                                  triggerAlert(`Permiso de buscador modificado para ${u.label}`);
                                  loadData();
                                }} 
                              />
                              Buscador General
                            </label>
                          )}
                          <button 
                            type="submit" 
                            className="btn btn-secondary btn-small"
                            style={{ margin: 0, padding: '6px 12px', fontSize: '0.8rem', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            💾 Guardar Cambios
                          </button>
                        </div>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'search' && renderSearchSection()}
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
          <form onSubmit={handleLogin} autoComplete="off" className="glass-panel login-form-panel" style={{ maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column' }}>
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
                placeholder="" 
                value={usernameInput} 
                onChange={(e) => setUsernameInput(e.target.value)} 
                required 
                autoComplete="off"
              />
            </div>

            <div className="input-group" style={{ position: 'relative' }}>
              <span className="input-label">Contraseña</span>
              <div style={{ position: 'relative', width: '100%' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="form-input" 
                  placeholder="" 
                  value={passwordInput} 
                  onChange={(e) => setPasswordInput(e.target.value)} 
                  required 
                  autoComplete="new-password"
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
          {!isAdminOrSuper && (
            <div 
              className="user-badge"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                cursor: 'pointer',
                borderColor: gpsStatus === 'active' ? 'rgba(52, 211, 153, 0.3)' : gpsStatus === 'error' ? 'rgba(248, 113, 113, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                background: gpsStatus === 'active' ? 'rgba(52, 211, 153, 0.05)' : gpsStatus === 'error' ? 'rgba(248, 113, 113, 0.05)' : 'transparent',
              }}
              onClick={() => {
                setIsTrackingActive(false);
                setTimeout(() => setIsTrackingActive(true), 200);
                triggerAlert('Reconectando GPS y solicitando ubicación...');
              }}
              title={gpsStatus === 'active' ? 'GPS Conectado. Haz clic para refrescar.' : gpsStatus === 'error' ? 'GPS Offline. Haz clic para reconectar.' : 'GPS Inactivo'}
            >
              <span style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: gpsStatus === 'active' ? '#34d399' : '#f87171',
                boxShadow: gpsStatus === 'active' ? '0 0 8px #34d399' : 'none',
                display: 'inline-block'
              }}></span>
              <span style={{ fontSize: '0.78rem', fontWeight: '600', color: gpsStatus === 'active' ? '#34d399' : '#f87171' }}>
                {gpsStatus === 'active' ? 'GPS' : 'GPS Offline'}
              </span>
            </div>
          )}
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
                    
                    {/* Sección de Kilometraje en el Resumen */}
                    {existingShift ? (
                      (() => {
                        const recordedKms = getRouteKms(targetFurgoId, targetDate);
                        return recordedKms > 0 ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px dashed var(--panel-border)', marginTop: '6px', color: 'var(--primary)', fontWeight: '600' }}>
                            <span>Kilometraje ({recordedKms} km a {kmPrice.toFixed(2)}€/km):</span>
                            <strong>+ {(recordedKms * kmPrice).toFixed(2)} €</strong>
                          </div>
                        ) : null;
                      })()
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>🏁 Kilómetros de la Ruta:</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input 
                            type="number" 
                            step="0.1" 
                            className="form-input" 
                            placeholder="Introduce kms recorridos" 
                            value={shiftKmsInput} 
                            onChange={(e) => setShiftKmsInput(e.target.value)} 
                            style={{ flex: 1, padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', color: 'var(--primary)', height: '36px', margin: 0 }} 
                          />
                          <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>km</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                          <span>Tarifa: {kmPrice.toFixed(2)} €/km</span>
                          <span>Importe: <strong style={{ color: '#fff' }}>{((parseFloat(shiftKmsInput) || 0) * kmPrice).toFixed(2)} €</strong></span>
                        </div>
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
                              {t.tasks && t.tasks.map((task, sIdx) => {
                                const tariff = tariffs.find(tar => tar.id === task.tariffId);
                                const name = task.name || (tariff ? tariff.name : task.tariffId);
                                return (
                                  <span key={sIdx} className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '2px 6px', background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)', border: '1px solid rgba(79, 70, 229, 0.15)' }}>
                                    {name} (x{task.quantity})
                                  </span>
                                );
                              })}
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
