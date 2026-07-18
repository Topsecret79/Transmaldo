import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Capacitor } from '@capacitor/core';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';
import Fuse from 'fuse.js';
import changelogData from './changelog.json';

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

// Diccionario de códigos postales comunes de España para resolver la población automáticamente
const getTownAndProvinceFromPostcode = (postcode) => {
  if (!postcode) return '';
  const pc = postcode.toString().trim();
  if (pc.length !== 5) return '';

  const dict = {
    // Barcelona Ciudad
    "08001": "Barcelona", "08002": "Barcelona", "08003": "Barcelona", "08004": "Barcelona",
    "08005": "Barcelona", "08006": "Barcelona", "08007": "Barcelona", "08008": "Barcelona",
    "08009": "Barcelona", "08010": "Barcelona", "08011": "Barcelona", "08012": "Barcelona",
    "08013": "Barcelona", "08014": "Barcelona", "08015": "Barcelona", "08016": "Barcelona",
    "08017": "Barcelona", "08018": "Barcelona", "08019": "Barcelona", "08020": "Barcelona",
    "08021": "Barcelona", "08022": "Barcelona", "08023": "Barcelona", "08024": "Barcelona",
    "08025": "Barcelona", "08026": "Barcelona", "08027": "Barcelona", "08028": "Barcelona",
    "08029": "Barcelona", "08030": "Barcelona", "08031": "Barcelona", "08032": "Barcelona",
    "08033": "Barcelona", "08034": "Barcelona", "08035": "Barcelona", "08036": "Barcelona",
    "08037": "Barcelona", "08038": "Barcelona", "08039": "Barcelona", "08040": "Barcelona",
    "08041": "Barcelona", "08042": "Barcelona",
    // Poblaciones de Barcelona y alrededores
    "08100": "Mollet del Vallès", "08107": "Martorelles", "08110": "Montcada i Reixac",
    "08120": "La Llagosta", "08130": "Santa Perpètua de Mogoda", "08140": "Calders",
    "08150": "Parets del Vallès", "08160": "Montmeló", "08170": "Montornès del Vallès",
    "08172": "Sant Cugat del Vallès", "08173": "Sant Cugat del Vallès", "08174": "Sant Cugat del Vallès",
    "08184": "Palau-solità i Plegamans", "08185": "Lliçà de Vall", "08186": "Lliçà d'Amunt",
    "08188": "Vallromanes", "08191": "Rubí", "08192": "Sant Quirze del Vallès",
    "08193": "Bellaterra", "08195": "Sant Cugat del Vallès", "08197": "Sant Cugat del Vallès",
    "08198": "Sant Cugat del Vallès", "08200": "Sabadell", "08201": "Sabadell",
    "08202": "Sabadell", "08203": "Sabadell", "08204": "Sabadell", "08205": "Sabadell",
    "08206": "Sabadell", "08207": "Sabadell", "08208": "Sabadell", "08210": "Barberà del Vallès",
    "08211": "Castellar del Vallès", "08213": "Polinyà", "08220": "Terrassa",
    "08221": "Terrassa", "08222": "Terrassa", "08223": "Terrassa", "08224": "Terrassa",
    "08225": "Terrassa", "08226": "Terrassa", "08227": "Terrassa", "08228": "Terrassa",
    "08230": "Matadepera", "08232": "Viladecavalls", "08233": "Vacarisses",
    "08240": "Manresa", "08241": "Manresa", "08242": "Manresa", "08243": "Manresa",
    "08270": "Navarcles", "08272": "Sant Fruitós de Bages", "08290": "Cerdanyola del Vallès",
    "08291": "Ripollet", "08292": "Esparreguera", "08294": "El Pont de Vilomara",
    "08297": "Castellbell i el Vilar", "08300": "Mataró", "08301": "Mataró",
    "08302": "Mataró", "08303": "Mataró", "08304": "Mataró", "08310": "Argentona",
    "08319": "Dosrius", "08320": "El Masnou", "08328": "Alella", "08329": "Teià",
    "08330": "Premià de Mar", "08338": "Premià de Dalt", "08339": "Vilassar de Dalt",
    "08340": "Vilassar de Mar", "08348": "Cabrils", "08349": "Cabrera de Mar",
    "08350": "Arenys de Mar", "08358": "Arenys de Munt", "08360": "Canet de Mar",
    "08370": "Calella", "08380": "Malgrat de Mar", "08389": "Palafolls",
    "08390": "Santa Susanna", "08391": "Arenys de Mar", "08392": "Sant Andreu de Llavaneres",
    "08393": "Caldes d'Estrac", "08394": "Sant Vicenç de Montalt", "08395": "Sant Pol de Mar",
    "08396": "Sant Cebrià de Vallalta", "08397": "Pineda de Mar", "08398": "Santa Susanna",
    "08400": "Granollers", "08401": "Granollers", "08402": "Granollers", "08403": "Granollers",
    "08410": "Vilanova del Vallès", "08415": "Bigues i Riells", "08420": "Canovelles",
    "08430": "La Roca del Vallès", "08440": "Cardedeu", "08450": "Llinars del Vallès",
    "08458": "Sant Pere de Vilamajor", "08459": "Sant Antoni de Vilamajor", "08460": "Santa Maria de Palautordera",
    "08470": "Sant Celoni", "08480": "L'Ametlla del Vallès", "08490": "Tordera",
    "08500": "Vic", "08520": "Les Franqueses del Vallès", "08530": "La Garriga",
    "08600": "Berga", "08620": "Sant Vicenç dels Horts", "08630": "Abrera",
    "08635": "Sant Esteve Sesrovires", "08640": "Olesa de Montserrat", "08690": "Santa Coloma de Cervelló",
    "08700": "Igualada", "08720": "Vilafranca del Penedès", "08730": "Santa Margarida i els Monjos",
    "08732": "La Múnia", "08740": "Sant Andreu de la Barca", "08750": "Molins de Rei",
    "08753": "Castellví de Rosanes", "08754": "El Papiol", "08755": "Castellbisbal",
    "08756": "La Palma de Cervelló", "08757": "Corbera de Llobregat", "08758": "Cervelló",
    "08759": "Vallirana", "08760": "Martorell", "08769": "Castellví de Rosanes",
    "08770": "Sant Sadurní d'Anoia", "08780": "Pallejà", "08788": "Vilanova del Camí",
    "08798": "Sant Cugat Sesgarrigues", "08800": "Vilanova i la Geltrú", "08810": "Sant Pere de Ribes",
    "08811": "Canyelles", "08812": "Les Roquetes", "08820": "El Prat de Llobregat",
    "08830": "Sant Boi de Llobregat", "08840": "Viladecans", "08850": "Gavà",
    "08859": "Begues", "08860": "Castelldefels", "08870": "Sitges",
    "08880": "Cubelles", "08900": "L'Hospitalet de Llobregat", "08901": "L'Hospitalet de Llobregat",
    "08902": "L'Hospitalet de Llobregat", "08903": "L'Hospitalet de Llobregat", "08904": "L'Hospitalet de Llobregat",
    "08905": "L'Hospitalet de Llobregat", "08906": "L'Hospitalet de Llobregat", "08907": "L'Hospitalet de Llobregat",
    "08908": "L'Hospitalet de Llobregat", "08910": "Badalona", "08911": "Badalona",
    "08912": "Badalona", "08913": "Badalona", "08914": "Badalona", "08915": "Badalona",
    "08916": "Badalona", "08917": "Badalona", "08918": "Badalona", "08920": "Santa Coloma de Gramenet",
    "08921": "Santa Coloma de Gramenet", "08922": "Santa Coloma de Gramenet", "08923": "Santa Coloma de Gramenet",
    "08924": "Santa Coloma de Gramenet", "08930": "Sant Adrià de Besòs", "08940": "Cornellà de Llobregat",
    "08950": "Esplugues de Llobregat", "08960": "Sant Just Desvern", "08970": "Sant Joan Despí",
    "08980": "Sant Feliu de Llobregat"
  };

  if (dict[pc]) return dict[pc];

  // Fallback por provincia
  const provCode = pc.substring(0, 2);
  const provinces = {
    "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería", "05": "Ávila",
    "06": "Badajoz", "07": "Baleares", "08": "Barcelona", "09": "Burgos", "10": "Cáceres",
    "11": "Cádiz", "12": "Castellón", "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña",
    "16": "Cuenca", "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Gipuzkoa",
    "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León", "25": "Lleida",
    "26": "La Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga", "30": "Murcia",
    "31": "Navarra", "32": "Ourense", "33": "Asturias", "34": "Palencia", "35": "Las Palmas",
    "36": "Pontevedra", "37": "Salamanca", "38": "S.C. Tenerife", "39": "Cantabria", "40": "Segovia",
    "41": "Sevilla", "42": "Soria", "43": "Tarragona", "44": "Teruel", "45": "Toledo",
    "46": "Valencia", "47": "Valladolid", "48": "Bizkaia", "49": "Zamora", "50": "Zaragoza",
    "51": "Ceuta", "52": "Melilla"
  };

  return provinces[provCode] || '';
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

  // Filter out parts that are exactly countries or regions, or contain "provincia de"
  const cleanParts = parts.filter(p => {
    const lp = p.toLowerCase();
    if (regions.includes(lp)) return false;
    if (lp.includes('provincia de') || lp.includes('província de') || lp.includes('province of')) return false;
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

// Distancia geodésica simple entre dos coordenadas
const getDistanceSimple = (c1, c2) => {
  if (!c1 || !c2 || c1.lat === null || c1.lng === null || c2.lat === null || c2.lng === null || isNaN(c1.lat) || isNaN(c1.lng) || isNaN(c2.lat) || isNaN(c2.lng)) return 0;
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

// Calcular cronogramas de paradas acumulativos
const calculateTimelineSchedules = (dateTickets, startCoords, startTimeStr, endCoords) => {
  const timelineSchedules = {};
  if (!dateTickets || dateTickets.length === 0) return timelineSchedules;

  const minutesToHHMM = (totalMins) => {
    const h = Math.floor(totalMins / 60) % 24;
    const m = Math.floor(totalMins % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const hhmmToMinutes = (timeStr) => {
    const parts = (timeStr || '09:00').split(':');
    return (parseInt(parts[0], 10) || 9) * 60 + (parseInt(parts[1], 10) || 0);
  };

  let lastPos = startCoords || { lat: 41.3879, lng: 2.16992 };
  let currentTime = hhmmToMinutes(startTimeStr);
  let cumulativeDist = 0;

  dateTickets.forEach((ticket, idx) => {
    const parsed = parseTicketNotes(ticket.notes);
    let ticketLat = ticket.lat ? parseFloat(ticket.lat) : lastPos.lat;
    let ticketLng = ticket.lng ? parseFloat(ticket.lng) : lastPos.lng;
    
    const dist = getDistanceSimple(lastPos, { lat: ticketLat, lng: ticketLng });
    cumulativeDist += dist;
    const travelMins = Math.round((dist / 35) * 60); // 35 km/h
    
    let arrivalTime;
    let departureTime;

    const isCompleted = ticket.status === 'success' || ticket.status === 'failed';
    let hasValidCompletionTime = false;
    let compLocalMins = 0;

    if (isCompleted && parsed.completedAt) {
      try {
        const compDate = new Date(parsed.completedAt);
        const compDateStr = parsed.completedAt.split('T')[0];
        if (!isNaN(compDate.getTime()) && compDateStr === ticket.date) {
          compLocalMins = compDate.getHours() * 60 + compDate.getMinutes();
          hasValidCompletionTime = true;
        }
      } catch (err) {
        console.error("Error parsing completedAt date:", err);
      }
    }

    if (hasValidCompletionTime) {
      departureTime = compLocalMins;
      arrivalTime = Math.max(departureTime - parsed.estimatedDuration, currentTime);
    } else {
      arrivalTime = currentTime + travelMins;
      departureTime = arrivalTime + parsed.estimatedDuration;
    }
    
    timelineSchedules[ticket.id] = {
      arrival: minutesToHHMM(arrivalTime),
      departure: minutesToHHMM(departureTime),
      duration: parsed.estimatedDuration,
      distance: dist.toFixed(1),
      cumulativeDistance: cumulativeDist.toFixed(1),
      travelMins,
      timeSlot: parsed.timeSlot === 'morning' ? 'Mañana' : parsed.timeSlot === 'afternoon' ? 'Tarde' : 'Indiferente'
    };
    
    lastPos = { lat: ticketLat, lng: ticketLng };
    currentTime = departureTime;
  });

  const resolvedEndCoords = endCoords || startCoords || { lat: 41.3879, lng: 2.16992 };
  const returnDist = getDistanceSimple(lastPos, resolvedEndCoords);
  const returnTravelMins = Math.round((returnDist / 35) * 60);
  
  const finalEndTime = currentTime + returnTravelMins;
  const finalTotalDist = cumulativeDist + returnDist;

  timelineSchedules.__totals = {
    endTime: minutesToHHMM(finalEndTime),
    totalDistance: finalTotalDist.toFixed(1),
    returnDistance: returnDist.toFixed(1),
    returnTravelMins
  };

  return timelineSchedules;
};

// Obtener ruta por carreteras reales desde OSRM
const fetchRoadRoute = async (points) => {
  if (!points || points.length < 2) return null;
  try {
    const coordsString = points.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const routeCoords = route.geometry.coordinates;
      return {
        geometry: routeCoords.map(c => [c[1], c[0]]),
        distance: route.distance, // en metros
        duration: route.duration  // en segundos
      };
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
  Key,
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
  Phone,
  Mail
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
  saveTickets,
  addTicket, 
  updateTicket, 
  deleteTicket, 
  calculateTaskPrice, 
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
  initializeAdminTariffs,
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
  saveRouteKms,
  getRouteStartTime,
  saveRouteStartTime,
  getAllowDriverSupportTransfer,
  saveAllowDriverSupportTransfer,
  getRouteManualStatus,
  saveRouteManualStatus,
  moveRouteDate,
  getHelpersList,
  saveHelpersList,
  savePlannedShift,
  deletePlannedShift,
  getPlatesList,
  savePlatesList,
  getDriverDailyRate,
  saveDriverDailyRate,
  getEmployeesList,
  saveEmployeesList,
  hashPassword,
  isSHA256,
  hasPermission
} from './db';


initDB();

const getNormalizedBlock = (b) => {
  if (!b) return '';
  return b.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

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

// Convierte números dictados en letras a dígitos numéricos y unifica el símbolo de número
function processVoiceAddress(text) {
  if (!text) return '';
  
  let result = text;
  
  // Diccionario de decenas para construir combinaciones "decena y unidad" (ej. "treinta y cinco" -> 35)
  const tens = {
    'treinta': 30,
    'cuarenta': 40,
    'cincuenta': 50,
    'sesenta': 60,
    'setenta': 70,
    'ochenta': 80,
    'noventa': 90
  };
  
  const units = {
    'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4,
    'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9
  };
  
  // Reemplazar patrones de "decena y unidad" (ej. "treinta y cinco" -> 35)
  for (const [tenWord, tenVal] of Object.entries(tens)) {
    for (const [unitWord, unitVal] of Object.entries(units)) {
      const pattern = new RegExp(`\\b${tenWord}\\s+y\\s+${unitWord}\\b`, 'gi');
      result = result.replace(pattern, String(tenVal + unitVal));
    }
    // Reemplazar decena sola (ej. "treinta" -> 30)
    const tenPattern = new RegExp(`\\b${tenWord}\\b`, 'gi');
    result = result.replace(tenPattern, String(tenVal));
  }
  
  // Reemplazar números individuales (0-29) y centenas
  const singleNumbers = {
    'cero': '0',
    'once': '11', 'doce': '12', 'trece': '13', 'catorce': '14', 'quince': '15',
    'dieciséis': '16', 'dieciseis': '16', 'diecisiete': '17', 'dieciocho': '18', 'diecinueve': '19',
    'veinte': '20',
    'veintiuno': '21', 'veintiuna': '21', 'veintidós': '22', 'veintidos': '22',
    'veintitrés': '23', 'veintitres': '23', 'veinticuatro': '24', 'veinticinco': '25',
    'veintiséis': '26', 'veintiseis': '26', 'veintisiete': '27', 'veintiocho': '28', 'veintinueve': '29',
    'cien': '100', 'ciento': '100',
    'uno': '1', 'una': '1', 'dos': '2', 'tres': '3', 'cuatro': '4',
    'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10'
  };
  
  for (const [word, digit] of Object.entries(singleNumbers)) {
    const pattern = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(pattern, digit);
  }
  
  // Normalizar variaciones de "número" seguidas de dígitos a "Nº X"
  result = result.replace(/\b(n[úu]mero|n\.?[ººªa]|nº|Nº)\s+(\d+)\b/gi, 'Nº $2');
  
  // Caso de número pegado al dígito (ej. "número5" -> "Nº 5")
  result = result.replace(/\b(n[úu]mero|n\.?[ººªa]|nº|Nº)(\d+)\b/gi, 'Nº $2');
  
  return result;
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
  const [serviceType, setServiceType] = useState('entrega');

  const getTicketServiceType = (t) => {
    if (!t) return 'entrega';

    // 1. Prioridad: Etiquetas o palabras clave en las notas
    if (t.notes) {
      const notesLower = t.notes.toLowerCase();
      if (notesLower.includes('[cuelgue]') || notesLower.includes('cuelgue') || notesLower.includes('colgar') || notesLower.includes('soporte')) {
        return 'cuelgue';
      }
      if (notesLower.includes('[puesta_marcha]') || notesLower.includes('puesta en marcha') || notesLower.includes('puesta_en_marcha') || notesLower.includes('instalar') || notesLower.includes('instalacion')) {
        return 'puesta_marcha';
      }
      if (notesLower.includes('[tarde]') || notesLower.includes('servicio de tarde') || notesLower.includes('por la tarde') || notesLower.includes('tarde')) {
        return 'tarde';
      }
    }

    // 2. Si no hay marcas en las notas, deducir por las tareas asignadas
    if (t.tasks && t.tasks.length > 0) {
      const hasDelivery = t.tasks.some(task => 
        task.tariffId.startsWith('TV_ENT_') || 
        task.tariffId.startsWith('TV_COMB_') || 
        task.tariffId.startsWith('ENTREGA_')
      );
      const hasCuelgue = t.tasks.some(task => 
        task.tariffId.startsWith('CUELGUE_')
      );
      const hasPM = t.tasks.some(task => 
        task.tariffId.startsWith('PM_')
      );

      if (!hasDelivery) {
        if (hasCuelgue) return 'cuelgue';
        if (hasPM) return 'puesta_marcha';
      }
    }

    return 'entrega';
  };

  const getTicketColor = (t) => {
    if (!t) return '#fbbf24';
    if (t.status === 'success') return '#10b981';
    if (t.status === 'failed') return '#ef4444';
    
    const sType = getTicketServiceType(t);
    if (sType === 'cuelgue') return '#a855f7'; // Violeta/Morado
    if (sType === 'puesta_marcha') return '#ec4899'; // Rosa/Magenta
    if (sType === 'tarde') return '#f97316'; // Naranja
    
    return t.status === 'transit' ? '#38bdf8' : '#fbbf24';
  };
  const isAdminOrSuper = currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [forceChangePasswordUser, setForceChangePasswordUser] = useState(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmPasswordVal, setConfirmPasswordVal] = useState('');

  // Estados para vinculación de correo electrónico de administradores
  const [emailLinkageUser, setEmailLinkageUser] = useState(null);
  const [linkageEmail, setLinkageEmail] = useState('');
  const [linkagePassword, setLinkagePassword] = useState('');
  const [linkageConfirmPassword, setLinkageConfirmPassword] = useState('');
  const [linkageError, setLinkageError] = useState('');
  const [isLinking, setIsLinking] = useState(false);


  const [tickets, setTickets] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [modulePrice, setModulePrice] = useState(3.81);
  const [kmPrice, setKmPrice] = useState(0.43);
  const [shiftKmsInput, setShiftKmsInput] = useState('');
  const [shiftFilterDate, setShiftFilterDate] = useState('');
  const [shiftFilterFurgo, setShiftFilterFurgo] = useState('all');
  const [users, setUsers] = useState([]);
  const loggedInUserObj = users.find(u => u.id === currentUser?.id) || currentUser;
  const showReportDay = hasPermission(loggedInUserObj, 'report_day');
  const showDeliveriesPeriod = hasPermission(loggedInUserObj, 'deliveries_period');
  const showMapControl = hasPermission(loggedInUserObj, 'map_control');
  const showShiftCalendar = hasPermission(loggedInUserObj, 'shift_calendar');
  const showGeneralSearch = hasPermission(loggedInUserObj, 'general_search');
  const showStaff = hasPermission(loggedInUserObj, 'staff');
  const showVanPricing = hasPermission(loggedInUserObj, 'van_pricing');
  const showSecurity = hasPermission(loggedInUserObj, 'security');

  const hasSearchPermission = loggedInUserObj && (
    loggedInUserObj.role === 'superadmin' || 
    (loggedInUserObj.role === 'admin' ? showGeneralSearch : loggedInUserObj.canSearch)
  );
  const [shifts, setShifts] = useState([]);
  const [allowDriverSupportTransfer, setAllowDriverSupportTransfer] = useState(getAllowDriverSupportTransfer());
  const [helpersList, setHelpersList] = useState(() => getHelpersList());
  const [newHelperName, setNewHelperName] = useState('');
  const [newHelperRate, setNewHelperRate] = useState('');
  const [employeesList, setEmployeesList] = useState(() => getEmployeesList());
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('chofer');
  const [newEmployeeRate, setNewEmployeeRate] = useState('');
  const [platesList, setPlatesList] = useState(() => getPlatesList());
  const [newPlateVal, setNewPlateVal] = useState('');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [calendarViewMode, setCalendarViewMode] = useState('month'); // 'month', 'week', 'day'
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [plannedShiftModalOpen, setPlannedShiftModalOpen] = useState(false);
  const [plannedFurgoId, setPlannedFurgoId] = useState('');
  const [plannedHelper, setPlannedHelper] = useState('');
  const [plannedHelper2, setPlannedHelper2] = useState('');
  const [plannedMatricula, setPlannedMatricula] = useState('');
  const [customDriverNameInput, setCustomDriverNameInput] = useState('');
  const [plannedDriverName, setPlannedDriverName] = useState('');
  const [editingRates, setEditingRates] = useState({});
  const [selectedPayrollEmployee, setSelectedPayrollEmployee] = useState(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpRole, setEditEmpRole] = useState('chofer');
  const [editEmpRate, setEditEmpRate] = useState('');
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [empFilterRole, setEmpFilterRole] = useState('all');
  const [empFilterStatus, setEmpFilterStatus] = useState('active');
  const [defaultNavigator, setDefaultNavigator] = useState(localStorage.getItem('delivery_default_navigator') || 'ask');

  const [navModalOpen, setNavModalOpen] = useState(false);
  const [navTarget, setNavTarget] = useState({ address: '', latitude: null, longitude: null, ticketId: null });
  const [navRememberChoice, setNavRememberChoice] = useState(false);

  const calcTaskPrice = (task) => {
    if (!task) return 0;
    if (task.noCharge) return 0;
    const catalogTariff = tariffs.find(tar => tar.id === task.tariffId);
    if (catalogTariff) {
      return calculateTaskPrice(task.tariffId, tariffs, modulePrice) * task.quantity;
    }
    if (task.tariffId && task.tariffId.startsWith('CUSTOM_')) {
      return (task.unitPrice || task.price || 0) * task.quantity;
    }
    return calculateTaskPrice(task.tariffId, tariffs, modulePrice) * task.quantity;
  };

  const calcTaskUnitPrice = (task) => {
    if (!task) return 0;
    if (task.noCharge) return 0;
    const catalogTariff = tariffs.find(tar => tar.id === task.tariffId);
    if (catalogTariff) {
      return calculateTaskPrice(task.tariffId, tariffs, modulePrice);
    }
    if (task.tariffId && task.tariffId.startsWith('CUSTOM_')) {
      return task.unitPrice || task.price || 0;
    }
    return calculateTaskPrice(task.tariffId, tariffs, modulePrice);
  };

  const getBillableTasks = (ticket) => {
    if (!ticket) return [];
    if (ticket.status === 'success') {
      return (ticket.tasks || []).map(task => {
        const tariff = tariffs.find(tar => tar.id === task.tariffId);
        const name = task.name || (tariff ? tariff.name : task.tariffId);
        return {
          name,
          quantity: task.quantity || 0,
          unitPrice: calcTaskUnitPrice(task),
          totalPrice: calcTaskPrice(task),
          detail: (() => {
            const isTv = tariff && tariff.block === 'Televisores' && task.tariffId !== 'TV_VIEJA_URB' && task.tariffId !== 'TV_VIEJA_NO_URB';
            const brand = isTv && task.brand && task.brand !== 'Genérica' ? task.brand : '';
            const inches = isTv && task.inches ? `${task.inches}"` : '';
            return [brand, inches].filter(Boolean).join(' ');
          })(),
          noCharge: task.noCharge
        };
      });
    } else if (ticket.status === 'failed') {
      const parsed = parseTicketNotes(ticket.notes);
      const chargeType = parsed.failedChargeType || 'none';
      if (chargeType === 'none') return [];

      let tariffId = '';
      let label = '';
      if (chargeType === 'pv') {
        tariffId = 'ENTREGA_PV';
        label = 'Intento Fallido (PV)';
      } else if (chargeType === 'gv') {
        tariffId = 'ENTREGA_GV';
        label = 'Intento Fallido (GV)';
      } else if (chargeType === 'tv_small') {
        tariffId = 'TV_ENT_49';
        label = 'Intento Fallido (TV <= 49")';
      } else if (chargeType === 'tv_large') {
        tariffId = 'TV_ENT_74';
        label = 'Intento Fallido (TV 50" a 74")';
      }

      if (!tariffId) return [];

      const tariff = tariffs.find(t => t.id === tariffId);
      const unitPrice = tariff ? tariff.value : 0;
      return [{
        name: label,
        quantity: 1,
        unitPrice,
        totalPrice: unitPrice,
        detail: ticket.failureReason ? `Fallo: ${ticket.failureReason}` : 'Fallo',
        noCharge: false
      }];
    }
    return [];
  };


  // Función auxiliar para cargar borradores temporales
  const getDraftVal = (key, defaultVal) => {
    try {
      const draft = localStorage.getItem('delivery_form_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed && parsed[key] !== undefined) {
          return parsed[key];
        }
      }
    } catch (e) {
      console.error("Error loading draft val for", key, e);
    }
    return defaultVal;
  };

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('delivery_active_tab') || '';
  }); 
  const [ticketFilterFurgo, setTicketFilterFurgo] = useState('all');
  const [ticketFilterDate, setTicketFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportFilterFurgo, setReportFilterFurgo] = useState('all');
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
  const [billingFilterFurgo, setBillingFilterFurgo] = useState('all');

  // Estado que controla si estamos editando
  const [editingTicketId, setEditingTicketId] = useState(null);
  const [editingFurgoId, setEditingFurgoId] = useState('');

  // Estados del Formulario
  const [customerName, setCustomerName] = useState(() => getDraftVal('customerName', ''));
  const [phone, setPhone] = useState(() => getDraftVal('phone', ''));
  const [address, setAddress] = useState(() => getDraftVal('address', ''));
  const [postcode, setPostcode] = useState(() => getDraftVal('postcode', ''));
  const [addressVerification, setAddressVerification] = useState(() => getDraftVal('addressVerification', { status: 'idle', message: '' }));
  const [lastVerifiedAddress, setLastVerifiedAddress] = useState(() => getDraftVal('lastVerifiedAddress', ''));
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
  const [notes, setNotes] = useState(() => getDraftVal('notes', ''));
  const [timeSlot, setTimeSlot] = useState(() => getDraftVal('timeSlot', 'any'));
  const [estimatedDuration, setEstimatedDuration] = useState(() => getDraftVal('estimatedDuration', 10));
  const [routeStartTime, setRouteStartTime] = useState(() => getDraftVal('routeStartTime', '09:00'));
  const [isDurationManuallyEdited, setIsDurationManuallyEdited] = useState(() => getDraftVal('isDurationManuallyEdited', false));
  const [ticketRoute, setTicketRoute] = useState(() => getDraftVal('ticketRoute', ''));
  const [originalRouteLabel, setOriginalRouteLabel] = useState(() => getDraftVal('originalRouteLabel', ''));
  const [codAmount, setCodAmount] = useState(() => getDraftVal('codAmount', ''));
  const [showHelperRoute, setShowHelperRoute] = useState(false);
  const [showCod, setShowCod] = useState(() => getDraftVal('showCod', false));

  // Lista de TVs añadidas al ticket actual
  // Cada TV: { id: string, inches: number, action: 'entrega'|'recogida'|'combinado', pmType: 'none'|'basic'|'complex', cuelgue: boolean, recogidaViejaType: 'none'|'urbantz'|'no_urbantz' }
  const [formTvs, setFormTvs] = useState(() => getDraftVal('formTvs', []));
  const [selectedMapTicket, setSelectedMapTicket] = useState(null);
  const [isMapPanelExpanded, setIsMapPanelExpanded] = useState(true);
  const [floatingPos, setFloatingPos] = useState({ x: 0, y: 0, isDragged: false });
  const dragStartRef = useRef(null);
  const [activeRoutes, setActiveRoutes] = useState(() => {
    try {
      const saved = localStorage.getItem('delivery_active_routes');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [currentRouteId, setCurrentRouteId] = useState(() => {
    const savedId = localStorage.getItem('delivery_current_route_id');
    if (!savedId) return null;
    try {
      const savedRoutesStr = localStorage.getItem('delivery_active_routes');
      const parsedRoutes = savedRoutesStr ? JSON.parse(savedRoutesStr) : [];
      const foundRoute = parsedRoutes.find(r => r.id === savedId);
      const todayStr = new Date().toISOString().split('T')[0];
      if (foundRoute && foundRoute.date === todayStr) {
        return savedId;
      }
    } catch (e) {
      console.error("Error verifying currentRouteId date:", e);
    }
    return null;
  });
  const activeRouteContext = activeRoutes.find(r => r.id === currentRouteId);

  useEffect(() => {
    if (!loggedInUserObj || loggedInUserObj.role === 'repartidor') return;
    
    // Lista de pestañas de administrador y sus condiciones
    const adminTabAccess = [
      { tab: 'dashboard', allowed: showReportDay },
      { tab: 'daily_report', allowed: showReportDay },
      { tab: 'tickets', allowed: showDeliveriesPeriod },
      { tab: 'map', allowed: showMapControl },
      { tab: 'calendar', allowed: showShiftCalendar },
      { tab: 'search', allowed: hasSearchPermission },
      { tab: 'employees', allowed: showStaff },
      { tab: 'tariffs', allowed: showVanPricing },
      { tab: 'users', allowed: showStaff || showSecurity }
    ];

    const currentTabCheck = adminTabAccess.find(t => t.tab === activeTab);
    if (currentTabCheck && !currentTabCheck.allowed) {
      // Encontrar la primera pestaña permitida
      const firstAllowed = adminTabAccess.find(t => t.allowed);
      if (firstAllowed) {
        setActiveTab(firstAllowed.tab);
      } else {
        // Fallback de seguridad, al menos ir a changelog si no tiene nada permitido
        setActiveTab('changelog');
      }
    }
  }, [activeTab, loggedInUserObj, showReportDay, showDeliveriesPeriod, showMapControl, showShiftCalendar, hasSearchPermission, showStaff, showVanPricing, showSecurity]);

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
  const [otherQuantities, setOtherQuantities] = useState(() => getDraftVal('otherQuantities', {}));
  // Acciones de otros artículos no-TV (por ejemplo, para Electrodomésticos Varios: 'entrega' | 'recogida' | 'combinado')
  // { tariffId: action }
  const [otherActions, setOtherActions] = useState(() => getDraftVal('otherActions', {}));
  const [customExtras, setCustomExtras] = useState(() => getDraftVal('customExtras', []));
  const [customExtraName, setCustomExtraName] = useState(() => getDraftVal('customExtraName', ''));
  const [customExtraPrice, setCustomExtraPrice] = useState(() => getDraftVal('customExtraPrice', ''));
  const [urgenteType, setUrgenteType] = useState(() => getDraftVal('urgenteType', 'none')); // 'none' | '100' | '120'

  // Cierre de turno
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftSummaryDate, setShiftSummaryDate] = useState(new Date().toISOString().split('T')[0]);
  const [shiftSummaryFurgoId, setShiftSummaryFurgoId] = useState('');

  // Cambiar fecha de ruta
  const [showMoveRouteModal, setShowMoveRouteModal] = useState(false);
  const [newRouteDateInput, setNewRouteDateInput] = useState('');
  const [isMovingRouteDate, setIsMovingRouteDate] = useState(false);

  // Filtro de propietario de tarifas
  const [selectedTariffOwner, setSelectedTariffOwner] = useState('base');

  // Edición detallada de tarifas
  const [editingTariffId, setEditingTariffId] = useState(null);
  const [editTariffName, setEditTariffName] = useState('');
  const [editTariffBlock, setEditTariffBlock] = useState('Otros');
  const [editTariffType, setEditTariffType] = useState('fixed');
  const [editTariffValue, setEditTariffValue] = useState('');

  // Bloques expandidos en el catálogo
  const [expandedBlocks, setExpandedBlocks] = useState({
    'Paquetería': true,
    'Televisores': false,
    'Instalaciones': false,
    'Barras de Sonido': false,
    'Electrodomésticos Varios': false,
    'Servicios': false,
    'Gama Blanca': false,
    'Muebles': false,
    'Otros': false
  });

  // Modal de observaciones para entrega/fallo
  const [obsModalTicketId, setObsModalTicketId] = useState(null);
  const [obsModalStatus, setObsModalStatus] = useState('');
  const [obsModalObservations, setObsModalObservations] = useState('');
  const [obsModalFailReason, setObsModalFailReason] = useState('');
  const [obsModalFailedChargeType, setObsModalFailedChargeType] = useState('none');

  // Estados de Ruta y Carga Dinámica de Usuarios
  const [routeName, setRouteName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('repartidor');
  const [newEmailState, setNewEmailState] = useState('');
  const [newAdminPricingOption, setNewAdminPricingOption] = useState('copy_default');
  const [expandedSections, setExpandedSections] = useState({
    tv: true,
    paqueteria: false,
    gamablanca: false,
    muebles: false,
    electrodomesticos: false,
    otros: false,
    extras: false
  });
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  const [changelogSearch, setChangelogSearch] = useState('');
  const [isTrackingActive, setIsTrackingActive] = useState(true);
  const [gpsStatus, setGpsStatus] = useState('inactive'); // 'active' | 'error' | 'inactive'
  const [routeStats, setRouteStats] = useState({});
  const watchIdRef = useRef(null);
  const [mapFilterDate, setMapFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [mapFilterFurgo, setMapFilterFurgo] = useState('all');
  const mapInstanceRef = useRef(null);
  const mapLayerGroupRef = useRef(null);
  const mapDriversLayerGroupRef = useRef(null);
  const lastFittedRef = useRef('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [routeStartAddr, setRouteStartAddr] = useState(getRouteStartAddr());
  const [rotateLoaded, setRotateLoaded] = useState(false);
  const [mapRotationState, setMapRotationState] = useState(0);
  const [mapControlsPos, setMapControlsPos] = useState(() => {
    try {
      const saved = localStorage.getItem('delivery_map_controls_pos');
      return saved ? JSON.parse(saved) : { top: 10, left: 10 };
    } catch(e) {
      return { top: 10, left: 10 };
    }
  });
  const [routeEndAddr, setRouteEndAddr] = useState(getRouteEndAddr());
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [otherDescriptions, setOtherDescriptions] = useState({});
  const [selectedDrilldownFurgoId, setSelectedDrilldownFurgoId] = useState(null);

  const [routeStartCoords, setRouteStartCoords] = useState(null);
  const [routeEndCoords, setRouteEndCoords] = useState(null);

  useEffect(() => {
    if (currentUser) {
      setRouteStartAddr(getRouteStartAddr(currentUser.id));
      setRouteEndAddr(getRouteEndAddr(currentUser.id));
    } else {
      setRouteStartAddr(getRouteStartAddr());
      setRouteEndAddr(getRouteEndAddr());
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedDrilldownFurgoId) {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
    } else {
      document.body.style.overflow = '';
      document.body.style.height = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, [selectedDrilldownFurgoId]);

  useEffect(() => {
    let active = true;
    const updateStart = async () => {
      if (routeStartAddr && routeStartAddr.trim()) {
        const res = await geocodeAddress(routeStartAddr);
        if (active && res && res.lat && res.lng) {
          setRouteStartCoords({ lat: parseFloat(res.lat), lng: parseFloat(res.lng) });
        }
      } else {
        if (active) setRouteStartCoords(null);
      }
    };
    updateStart();
    return () => { active = false; };
  }, [routeStartAddr]);

  useEffect(() => {
    let active = true;
    const updateEnd = async () => {
      if (routeEndAddr && routeEndAddr.trim()) {
        const res = await geocodeAddress(routeEndAddr);
        if (active && res && res.lat && res.lng) {
          setRouteEndCoords({ lat: parseFloat(res.lat), lng: parseFloat(res.lng) });
        }
      } else {
        if (active) setRouteEndCoords(null);
      }
    };
    updateEnd();
    return () => { active = false; };
  }, [routeEndAddr]);

  // --- SALVADO AUTOMÁTICO DE BORRADORES Y PESTAÑA ACTIVA EN LOCALSTORAGE ---
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('delivery_active_tab', activeTab);
    }
    if (activeTab === 'map' || activeTab === 'driver_map') {
      document.body.classList.add('map-active');
    } else {
      document.body.classList.remove('map-active');
    }
    return () => {
      document.body.classList.remove('map-active');
    };
  }, [activeTab]);

  useEffect(() => {
    if (editingTicketId) {
      return; // No guardar borrador si estamos editando
    }
    const draftData = {
      customerName,
      phone,
      address,
      postcode,
      addressVerification,
      lastVerifiedAddress,
      ticketDate,
      notes,
      timeSlot,
      estimatedDuration,
      routeStartTime,
      isDurationManuallyEdited,
      ticketRoute,
      originalRouteLabel,
      codAmount,
      showCod,
      formTvs,
      otherQuantities,
      otherActions,
      customExtras,
      urgenteType
    };
    // Solo guardamos si el borrador tiene algo de contenido
    const hasContent = customerName || phone || address || notes || formTvs.length > 0 || Object.keys(otherQuantities).length > 0 || customExtras.length > 0;
    if (hasContent) {
      localStorage.setItem('delivery_form_draft', JSON.stringify(draftData));
    } else {
      localStorage.removeItem('delivery_form_draft');
    }
  }, [
    customerName,
    phone,
    address,
    postcode,
    addressVerification,
    lastVerifiedAddress,
    ticketDate,
    notes,
    timeSlot,
    estimatedDuration,
    routeStartTime,
    isDurationManuallyEdited,
    ticketRoute,
    originalRouteLabel,
    codAmount,
    showCod,
    formTvs,
    otherQuantities,
    otherActions,
    customExtras,
    urgenteType,
    editingTicketId
  ]);

  const handleFetchRouteSuggestions = async (queryText, type) => {
    const setTarget = type === 'start' ? setStartSuggestions : setEndSuggestions;
    if (!queryText || queryText.trim().length < 3) {
      setTarget([]);
      return;
    }
    
    const countryCode = searchCountryCode || 'es';
    const cityBias = searchCityBias || 'Barcelona';

    if (countryCode === 'es') {
      try {
        let cartoQuery = queryText.trim();
        if (!cartoQuery.includes(',') && !/\b\d{5}\b/.test(cartoQuery) && cityBias && !cartoQuery.toLowerCase().includes(cityBias.toLowerCase())) {
          cartoQuery += `, ${cityBias}`;
        }
        const cartoUrl = `https://www.cartociudad.es/geocoder/api/geocoder/candidates?q=${encodeURIComponent(cartoQuery)}&limit=5`;
        const response = await fetch(cartoUrl);
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const formatted = data.map(item => ({
              lat: item.lat.toString(),
              lon: item.lng.toString(),
              display_name: item.muni ? `${item.address}, ${item.muni}, ${item.province}, España` : `${item.address}, ${item.province}, España`
            }));
            setTarget(formatted);
            return;
          }
        }
      } catch (err) {
        console.error("CartoCiudad route suggestions failed, falling back to Nominatim:", err);
      }
    }

    try {
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
            onClick={(e) => {
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
    // Admins see any users they created (repartidor or admin)
    return u.createdBy === currentUser.id;
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
    
    // Role filter
    let matchRole = false;
    if (currentUser.role === 'superadmin') {
      matchRole = true;
    } else if (currentUser.role === 'repartidor') {
      matchRole = s.furgoId === currentUser.id;
    } else {
      // Admin
      const allowedFurgoIds = activeRepartidores.map(r => r.id);
      matchRole = allowedFurgoIds.includes(s.furgoId);
    }
    if (!matchRole) return false;

    // Search filters (for admin / superadmin)
    if (currentUser.role !== 'repartidor') {
      if (shiftFilterDate && s.date !== shiftFilterDate) return false;
      if (shiftFilterFurgo !== 'all' && s.furgoId !== shiftFilterFurgo) return false;
    }

    return true;
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
          const savedTab = localStorage.getItem('delivery_active_tab');
          if (savedTab) {
            if (parsed.role === 'repartidor' && savedTab === 'changelog') {
              setActiveTab('new_ticket');
            } else {
              setActiveTab(savedTab);
            }
          } else {
            setActiveTab((parsed.role === 'admin' || parsed.role === 'superadmin') ? 'dashboard' : 'new_ticket');
          }
        }
      } catch (e) {
        console.error("Error parsing saved user session on mount:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const targetFurgo = currentUser.role === 'repartidor' ? currentUser.id : (activeTab === 'tickets' ? ticketFilterFurgo : mapFilterFurgo);
    const targetDate = currentUser.role === 'repartidor' ? (shiftSummaryDate || new Date().toISOString().split('T')[0]) : (activeTab === 'tickets' ? ticketFilterDate : mapFilterDate);
    if (targetFurgo && targetFurgo !== 'all' && targetDate) {
      const time = getRouteStartTime(targetFurgo, targetDate);
      setRouteStartTime(time);
    }
  }, [currentUser, activeTab, ticketFilterFurgo, mapFilterFurgo, ticketFilterDate, mapFilterDate, shiftSummaryDate]);

  useEffect(() => {
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
    if (!rotateLoaded) return;

    window.handleChangeMapStopOrder = (ticketId, targetValue) => {
      const ticketToMove = tickets.find(tk => tk && tk.id === ticketId);
      if (ticketToMove) {
        changeTicketRouteOrder(ticketToMove, Number(targetValue));
        triggerAlert(`Posición de la parada modificada a #${targetValue}`);
      }
    };

    const handleDriverLocationUpdate = () => {
      if (typeof window.updateLiveDriversOnMapFn === 'function') {
        window.updateLiveDriversOnMapFn();
      }
    };
    window.addEventListener('driver-location-updated', handleDriverLocationUpdate);

    // Fallback de sondeo automático en segundo plano cada 15 segundos por si el websocket realtime falla o se bloquea
    const fallbackPollInterval = setInterval(() => {
      const supabaseClient = getSupabaseClient();
      if (supabaseClient) {
        supabaseClient.from('delivery_settings').select('*')
          .then(({ data, error }) => {
            if (data && !error) {
              const locations = {};
              data.forEach(s => {
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
                  } catch (e) {}
                }
              });
              if (Object.keys(locations).length > 0) {
                localStorage.setItem('delivery_driver_locations', JSON.stringify(locations));
                if (typeof window.updateLiveDriversOnMapFn === 'function') {
                  window.updateLiveDriversOnMapFn();
                }
              }
            }
          })
          .catch(err => {
            console.warn("Background driver locations polling failed:", err);
          });
      }
    }, 15000);

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
            attributionControl: true,
            rotate: true,
            touchRotate: true,
            rotateControl: false,
            preferCanvas: true
          }).setView([41.3879, 2.16992], 12);
          mapInstanceRef.current = map;

          map.on('rotate', () => {
            if (typeof map.getBearing === 'function') {
              setMapRotationState(Math.round(map.getBearing()));
            }
          });

          // Deseleccionar pin al hacer clic en el fondo del mapa
          map.on('click', (e) => {
            if (e.originalEvent.target.closest('.leaflet-marker-icon')) return;
            setSelectedMapTicket(null);
          });

          // Cargar capas de mapa (Google, Claro Minimalista, Oscuro Premium, Calles Moderno, Satélite)
          const googleStreets = window.L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=es', {
            attribution: '&copy; Google Maps',
            maxZoom: 22
          });

          const googleHybrid = window.L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=es', {
            attribution: '&copy; Google Maps',
            maxZoom: 22
          });

          const googleTraffic = window.L.tileLayer('https://mt1.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}&hl=es', {
            attribution: '&copy; Google Maps',
            maxZoom: 22
          });

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

          // Activar Google Calles por defecto
          googleStreets.addTo(map);

          const baseMaps = {
            "Google Calles 🗺️": googleStreets,
            "Google Satélite Híbrido 🛰️": googleHybrid,
            "Google Tráfico en Vivo 🚗": googleTraffic,
            "Oscuro Premium ⚫": darkMatter,
            "Claro Minimalista ⚪": positron,
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

        if (!mapDriversLayerGroupRef.current) {
          mapDriversLayerGroupRef.current = window.L.layerGroup().addTo(map);
        } else {
          mapDriversLayerGroupRef.current.clearLayers();
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

            const statusColor = getTicketColor(t);
            const textColor = (statusColor === '#a855f7' || statusColor === '#ec4899' || statusColor === '#ef4444') ? '#fff' : '#000';

            const markerHtml = `
              <div style="
                width: 24px; 
                height: 24px; 
                border-radius: 50%; 
                background-color: ${statusColor}; 
                color: ${textColor}; 
                font-weight: 800; 
                font-size: 11px; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                border: 2px solid #fff;
                box-shadow: 0 0 10px rgba(0,0,0,0.5);
                transform: rotate(${-mapRotationState}deg);
                transition: transform 0.25s ease-out;
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

            const isClosed = getShiftStatus(t.furgoId, t.date) === 'closed';
            const dayTicketsCount = driverTickets.length;
            let optionsHtml = '';
            for (let i = 1; i <= dayTicketsCount; i++) {
              optionsHtml += `<option value="${i}" ${i === (seqIndex + 1) ? 'selected' : ''}>Parada #${i}</option>`;
            }

            const popupContent = `
              <div style="
                font-family: 'Inter', sans-serif; 
                font-size: 0.88rem; 
                color: #fff; 
                padding: 4px;
                min-width: 170px;
                display: flex;
                flex-direction: column;
                gap: 5px;
              ">
                <strong style="color: #a78bfa; font-size: 0.92rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">
                  ${t.customerName || 'Cliente'}
                </strong>
                <div style="font-size: 0.76rem; color: #d1d5db; line-height: 1.2;">
                  📍 ${getShortAddressString(t.address)}
                </div>
                
                ${(!isClosed || isAdminOrSuper) ? `
                  <div style="
                    margin-top: 6px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: space-between; 
                    gap: 6px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    padding-top: 6px;
                  ">
                    <span style="font-size: 0.76rem; color: #9ca3af; font-weight: 600;">Posición:</span>
                    <select 
                      onchange="if(window.handleChangeMapStopOrder) window.handleChangeMapStopOrder('${t.id}', this.value)"
                      style="
                        background: var(--primary);
                        border: 1px solid rgba(255,255,255,0.2);
                        color: #fff;
                        border-radius: 4px;
                        padding: 2px 4px;
                        font-size: 0.76rem;
                        font-weight: 700;
                        cursor: pointer;
                        outline: none;
                        height: 24px;
                      "
                    >
                      ${optionsHtml}
                    </select>
                  </div>
                ` : `
                  <div style="font-size: 0.76rem; color: #9ca3af; font-weight: 700; margin-top: 4px;">
                    Parada #${seqIndex + 1}
                  </div>
                `}
              </div>
            `;

            window.L.marker(latLng, { icon: markerIcon })
              .addTo(mapLayerGroupRef.current)
              .bindPopup(popupContent, { maxWidth: 220 })
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

            // Cargar trazado de carreteras reales asíncronamente desde OSRM
            fetchRoadRoute(routeCoords.map(c => ({ lat: c[0], lng: c[1] })))
              .then(roadData => {
                if (roadData && roadData.geometry && roadData.geometry.length > 0) {
                  window.L.polyline(roadData.geometry, {
                    color: driverColor,
                    weight: 4,
                    opacity: 0.85
                  }).addTo(mapLayerGroupRef.current);
                  
                  // Guardar estadísticas de ruta
                  setRouteStats(prev => ({
                    ...prev,
                    [fid]: {
                      distance: roadData.distance,
                      duration: roadData.duration
                    }
                  }));
                } else {
                  // Fallback inmediato si no hay geometría OSRM
                  window.L.polyline(routeCoords, {
                    color: driverColor,
                    weight: 3,
                    opacity: 0.75,
                    dashArray: '6, 6'
                  }).addTo(mapLayerGroupRef.current);
                }
              })
              .catch(err => {
                console.error("OSRM route path failed, using fallback:", err);
                // Fallback inmediato si falla la API
                window.L.polyline(routeCoords, {
                  color: driverColor,
                  weight: 3,
                  opacity: 0.75,
                  dashArray: '6, 6'
                }).addTo(mapLayerGroupRef.current);
              });
          }
        });

        // 5. Dibujar repartidores en tiempo real y registrar listener ligero
        window.updateLiveDriversOnMapFn = () => {
          if (!mapDriversLayerGroupRef.current || !mapInstanceRef.current) return;
          mapDriversLayerGroupRef.current.clearLayers();

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
            if (timeDiff > 48 * 60 * 60 * 1000) return; // Filtro de inactividad de 48 horas

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
                transform: rotate(${-mapRotationState}deg);
                transition: transform 0.25s ease-out;
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
              .addTo(mapDriversLayerGroupRef.current)
              .bindPopup(popupContent);
          });
        };

        if (typeof window.updateLiveDriversOnMapFn === 'function') {
          window.updateLiveDriversOnMapFn();
        }

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
      clearInterval(fallbackPollInterval);
      delete window.handleChangeMapStopOrder;
      delete window.updateLiveDriversOnMapFn;
      window.removeEventListener('driver-location-updated', handleDriverLocationUpdate);
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
        mapDriversLayerGroupRef.current = null;
      }
    };
  }, [activeTab, mapFilterDate, mapFilterFurgo, tickets, users, shiftSummaryDate, currentUser, rotateLoaded]);



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
      
      const processAndDeduplicateTariffs = (tariffsList, targetAdminId) => {
        const adminSuffix = `_${targetAdminId}`;
        const tariffMap = {};
        
        tariffsList.forEach(t => {
          if (t && (t.createdBy === targetAdminId || t.id.endsWith(adminSuffix))) {
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
        
        tariffsList.forEach(t => {
          if (t && !t.createdBy && !t.id.endsWith(adminSuffix)) {
            if (!tariffMap[t.id]) {
              tariffMap[t.id] = t;
            }
          }
        });
        
        return Object.values(tariffMap);
      };

      if (u && u.role) {
        if (u.role === 'admin') {
          const myUserIds = rawUsers.filter(usr => usr && (usr.createdBy === u.id || usr.id === u.id)).map(usr => usr.id);
          finalTickets = rawTickets.filter(t => t && (t.createdBy === u.id || myUserIds.includes(t.furgoId)));
          finalUsers = rawUsers.filter(usr => usr && (usr.createdBy === u.id || usr.id === u.id));
          const activeTariffsRaw = rawTariffs.filter(t => t && (t.createdBy === u.id || !t.createdBy));
          finalTariffs = processAndDeduplicateTariffs(activeTariffsRaw, u.id);
          finalShifts = rawShifts.filter(s => s && (s.createdBy === u.id || s.createdBy === 'admin' || myUserIds.includes(s.furgoId)));
        } else if (u.role === 'repartidor') {
          finalTickets = rawTickets.filter(t => t && t.furgoId === u.id);
          finalUsers = rawUsers.filter(usr => usr && (usr.createdBy === u.createdBy || usr.id === u.id || usr.id === u.createdBy));
          finalShifts = rawShifts.filter(s => s && s.furgoId === u.id);
          
          const adminId = u.createdBy || 'admin';
          const activeTariffsRaw = rawTariffs.filter(t => t && (t.createdBy === adminId || !t.createdBy));
          finalTariffs = processAndDeduplicateTariffs(activeTariffsRaw, adminId);
        }
      }
      
      setTickets(finalTickets);
      setTariffs(finalTariffs);
      setUsers(finalUsers);
      setShifts(finalShifts);

      if (u) {
        const freshUser = rawUsers.find(usr => usr.id === u.id);
        if (freshUser && (freshUser.email !== u.email || freshUser.auth_uid !== u.auth_uid || freshUser.mustChangePassword !== u.mustChangePassword)) {
          setCurrentUser(freshUser);
          localStorage.setItem('delivery_session', JSON.stringify(freshUser));
        }
      }

      // Background migration for plain-text passwords to SHA-256
      (async () => {
        let needsMigration = false;
        for (const usr of finalUsers) {
          if (usr.password && !isSHA256(usr.password)) {
            needsMigration = true;
            break;
          }
        }
        if (needsMigration) {
          console.log("Migrating plain-text passwords to SHA-256 hashes...");
          await saveUsers(finalUsers);
        }
      })();
      
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
    setGoogleKeyInput(getGoogleMapsKey());
    setMapboxTokenInput(getMapboxToken());
    setAllowDriverSupportTransfer(getAllowDriverSupportTransfer());
    setHelpersList(getHelpersList() || []);
    setPlatesList(getPlatesList() || []);
    setEmployeesList(getEmployeesList() || []);
  };

  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  });

  useEffect(() => {
    import('leaflet-rotate').then(() => {
      setRotateLoaded(true);
    }).catch(err => {
      console.error("Failed to load leaflet-rotate plugin dynamically:", err);
    });
  }, []);

  useEffect(() => {
    const activeFurgo = currentUser?.role === 'repartidor' 
      ? currentUser.id 
      : (activeTab === 'tickets' ? ticketFilterFurgo : mapFilterFurgo);
      
    if (activeFurgo && activeFurgo !== 'all') {
      setRouteStartAddr(getRouteStartAddr(activeFurgo));
      setRouteEndAddr(getRouteEndAddr(activeFurgo));
    } else {
      setRouteStartAddr(getRouteStartAddr());
      setRouteEndAddr(getRouteEndAddr());
    }
  }, [mapFilterFurgo, ticketFilterFurgo, activeTab, currentUser]);

  const triggerAlert = (text, type = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg({ text: '', type: '' }), 4000);
  };

  useEffect(() => {
    if (isDurationManuallyEdited) return;
    
    let duration = 10; // Entrega estándar: 10 min

    const hasCuelgue = serviceType === 'cuelgue' || formTvs.some(tv => tv.cuelgue) || tempTvAction === 'solo_cuelgue';
    const hasPM = serviceType === 'puesta_marcha' || formTvs.some(tv => tv.pmType === 'basic' || tv.pmType === 'complex') || tempTvAction === 'solo_pm';

    if (hasCuelgue) {
      duration = 90; // Cuelgue: 90 min
    } else if (hasPM) {
      duration = 30; // Puesta en marcha: 30 min
    } else {
      duration = 10;
    }

    setEstimatedDuration(duration);
  }, [formTvs, serviceType, tempTvAction, otherQuantities, isDurationManuallyEdited]);

  useEffect(() => {
    if (activeRouteContext && activeRouteContext.date && currentUser?.role !== 'repartidor') {
      setShiftSummaryDate(activeRouteContext.date);
    }
  }, [activeRouteContext, currentUser]);

  useEffect(() => {
    const mapEl = document.getElementById('form-mini-map');
    if (mapEl && window.L && addressVerification.status === 'success' && addressVerification.coords) {
      const { lat, lng } = addressVerification.coords;
      const latLng = [lat, lng];

      // Siempre limpiar la instancia previa si existe para evitar contenedores huérfanos
      if (formMapRef.current) {
        try {
          formMapRef.current.remove();
        } catch (e) {
          console.error("Error cleaning up previous form map:", e);
        }
        formMapRef.current = null;
        formMarkerRef.current = null;
      }

      const map = window.L.map('form-mini-map', {
        zoomControl: false,
        attributionControl: false
      }).setView(latLng, 16);

      window.L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=es', {
        maxZoom: 22
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

      // Invalidad tamaño con un leve retraso para renderizados móviles
      setTimeout(() => {
        if (formMapRef.current) {
          formMapRef.current.invalidateSize();
        }
      }, 100);
    }

    return () => {
      if (formMapRef.current) {
        try {
          formMapRef.current.remove();
        } catch (e) {
          console.error("Cleanup form map failed:", e);
        }
        formMapRef.current = null;
        formMarkerRef.current = null;
      }
    };
  }, [addressVerification.status, addressVerification.coords]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    const inputIdentifier = usernameInput.trim();
    const password = passwordInput.trim();
    const isEmail = inputIdentifier.includes('@');
    
    let foundUser = null;
    const dbUsers = getUsers() || [];
    
    if (isEmail) {
      // 1. AUTENTICACIÓN POR CORREO ELECTRÓNICO (SUPABASE AUTH)
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        setLoginError('Error de red: no se pudo inicializar la base de datos.');
        return;
      }
      
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: inputIdentifier,
          password: password
        });
        
        if (error) {
          setLoginError(`Error de autenticación: ${error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message}`);
          return;
        }
        
        const authUser = data.user;
        
        // Buscar el perfil de usuario en delivery_users usando el UID o el correo
        let profile = dbUsers.find(
          u => u.auth_uid === authUser.id || (u.email && u.email.toLowerCase() === inputIdentifier.toLowerCase())
        );
        
        // Fallback: Si no está guardado localmente, consultar a Supabase en vivo
        if (!profile) {
          const { data: cloudProfile, error: errProfile } = await supabaseClient
            .from('delivery_users')
            .select('*')
            .or(`auth_uid.eq.${authUser.id},email.eq.${inputIdentifier}`);
            
          if (cloudProfile && cloudProfile.length > 0 && !errProfile) {
            const u = cloudProfile[0];
            profile = {
              id: u.id,
              username: u.username,
              password: u.password,
              label: u.label,
              role: u.role,
              canSearch: u.can_search || false,
              createdBy: u.created_by || 'admin',
              mustChangePassword: !!u.must_change_password,
              email: u.email,
              auth_uid: u.auth_uid || authUser.id
            };
            
            // Si el perfil en la base de datos no tiene guardado el UID aún, actualizarlo
            if (!u.auth_uid) {
              const updatedUsers = [...dbUsers.filter(usr => usr.id !== profile.id), profile];
              saveUsers(updatedUsers);
            }
          }
        }
        
        if (profile) {
          // Confirmar que tiene permisos de administración
          if (profile.role !== 'admin' && profile.role !== 'superadmin' && profile.role !== 'coordinador') {
            setLoginError('Acceso denegado: este método es exclusivo para administradores.');
            return;
          }
          foundUser = profile;
        } else {
          setLoginError('No se encontró un perfil de usuario asignado a este correo.');
          return;
        }
      } catch (err) {
        console.error("Supabase email login failed:", err);
        setLoginError('Error de conexión al autenticar con el correo.');
        return;
      }
    } else {
      // 2. AUTENTICACIÓN CLÁSICA POR NOMBRE DE USUARIO (REPARTIDORES O VINCULACIÓN PENDIENTE)
      const hashedVal = await hashPassword(password);
      
      foundUser = dbUsers.find(
        u => u.username.toLowerCase() === inputIdentifier.toLowerCase() && 
        (u.password === password || u.password === hashedVal)
      );

      if (!foundUser) {
        const supabaseClient = getSupabaseClient();
        if (supabaseClient) {
          try {
            const { data: cloudUsers, error } = await supabaseClient
              .from('delivery_users')
              .select('*')
              .ilike('username', inputIdentifier)
              .or(`password.eq.${password},password.eq.${hashedVal}`);
              
            if (cloudUsers && cloudUsers.length > 0 && !error) {
              const u = cloudUsers[0];
              foundUser = {
                id: u.id,
                username: u.username,
                password: u.password,
                label: u.label,
                role: u.role,
                canSearch: u.can_search || false,
                createdBy: u.created_by || 'admin',
                mustChangePassword: !!u.must_change_password,
                email: u.email || null,
                auth_uid: u.auth_uid || null
              };
              const updatedUsers = [...dbUsers.filter(usr => usr.id !== foundUser.id), foundUser];
              saveUsers(updatedUsers);
            }
          } catch (err) {
            console.error("Live login query failed:", err);
          }
        }
      }
    }

    if (foundUser) {
      if (foundUser.mustChangePassword) {
        setForceChangePasswordUser(foundUser);
        setUsernameInput('');
        setPasswordInput('');
        return;
      }
      
      // SI ES ADMINISTRADOR O COORDINADOR Y NO TIENE EMAIL VINCULADO -> FORZAR FLUJO DE VINCULACIÓN
      if ((foundUser.role === 'admin' || foundUser.role === 'superadmin' || foundUser.role === 'coordinador') && !foundUser.email) {
        setEmailLinkageUser(foundUser);
        setUsernameInput('');
        setPasswordInput('');
        return;
      }
      
      // Intentar obtener permisos más recientes de delivery_settings para coordinadores
      const supabaseClient = getSupabaseClient();
      if (supabaseClient && foundUser.role === 'admin') {
        try {
          const { data: settingData } = await supabaseClient
            .from('delivery_settings')
            .select('value')
            .eq('key', `user_permissions_${foundUser.id}`)
            .maybeSingle();
          if (settingData && settingData.value) {
            try {
              let parsedPerms = JSON.parse(settingData.value);
              if (parsedPerms && typeof parsedPerms === 'string') {
                parsedPerms = JSON.parse(parsedPerms);
              }
              foundUser.permissions = parsedPerms;
            } catch(e) {
              console.error("Error parsing settings permissions during login:", e);
            }
          }
        } catch(err) {
          console.error("Error fetching settings permissions during login:", err);
        }
      }

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

  const handleForceChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPasswordVal.trim()) {
      triggerAlert('La contraseña no puede estar vacía', 'error');
      return;
    }
    if (newPasswordVal.trim() !== confirmPasswordVal.trim()) {
      triggerAlert('Las contraseñas no coinciden', 'error');
      return;
    }
    
    const dbUsers = getUsers() || [];
    const updatedUsers = dbUsers.map(u => {
      if (u.id === forceChangePasswordUser.id) {
        return {
          ...u,
          password: newPasswordVal.trim(),
          mustChangePassword: false
        };
      }
      return u;
    });

    const updatedUserObj = updatedUsers.find(u => u.id === forceChangePasswordUser.id);
    if (updatedUserObj) {
      saveUsers(updatedUsers);
      setCurrentUser(updatedUserObj);
      localStorage.setItem('delivery_session', JSON.stringify(updatedUserObj));
      setActiveTab((updatedUserObj.role === 'admin' || updatedUserObj.role === 'superadmin') ? 'dashboard' : 'new_ticket');
      triggerAlert('Contraseña cambiada con éxito. Sesión iniciada.');
      setForceChangePasswordUser(null);
      setNewPasswordVal('');
      setConfirmPasswordVal('');
      await reinitSupabase();
      loadData();
    }
  };

  const handleEmailLinkageSubmit = async (e) => {
    e.preventDefault();
    setLinkageError('');
    
    const email = linkageEmail.trim();
    const password = linkagePassword.trim();
    const confirm = linkageConfirmPassword.trim();
    
    if (!email || !email.includes('@')) {
      setLinkageError('Por favor introduce un correo electrónico válido.');
      return;
    }
    if (!password) {
      setLinkageError('Por favor introduce una contraseña.');
      return;
    }
    if (password.length < 6) {
      setLinkageError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setLinkageError('Las contraseñas no coinciden.');
      return;
    }
    
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      setLinkageError('Error de red: no se pudo inicializar la base de datos.');
      return;
    }
    
    setIsLinking(true);
    try {
      // 1. Registrar al usuario en Supabase Auth
      let authUser = null;
      const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: window.location.origin + window.location.pathname,
          data: {
            role: emailLinkageUser.role,
            label: emailLinkageUser.label
          }
        }
      });
      
      if (error) {
        const errMsg = (error.message || '').toLowerCase();
        if (errMsg.includes('already') || errMsg.includes('registered') || error.code === 'user_already_exists') {
          // Intentar iniciar sesión para verificar que la contraseña es correcta y obtener el UUID
          const { data: signInData, error: signInErr } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
          });
          if (signInErr) {
            setLinkageError(`El correo ya está registrado en Supabase Auth, pero la contraseña introducida no coincide o la cuenta está pendiente de confirmación.`);
            setIsLinking(false);
            return;
          } else if (signInData && signInData.user) {
            authUser = signInData.user;
          }
        } else {
          setLinkageError(`Error de registro: ${error.message}`);
          setIsLinking(false);
          return;
        }
      } else {
        authUser = data.user;
      }
      
      // 2. Actualizar el perfil local y remoto del usuario vinculándole el email y el auth_uid
      const dbUsers = getUsers() || [];
      const updatedUsers = dbUsers.map(u => {
        if (u.id === emailLinkageUser.id) {
          return {
            ...u,
            email: email.toLowerCase(),
            auth_uid: authUser.id,
            mustChangePassword: false
          };
        }
        return u;
      });
      
      const updatedUserObj = updatedUsers.find(u => u.id === emailLinkageUser.id);
      if (updatedUserObj) {
        await saveUsers(updatedUsers);
        
        // 3. Iniciar sesión automáticamente
        setCurrentUser(updatedUserObj);
        localStorage.setItem('delivery_session', JSON.stringify(updatedUserObj));
        setActiveTab((updatedUserObj.role === 'admin' || updatedUserObj.role === 'superadmin') ? 'dashboard' : 'new_ticket');
        
        triggerAlert('¡Cuenta vinculada con éxito y sesión iniciada!');
        
        setEmailLinkageUser(null);
        setLinkageEmail('');
        setLinkagePassword('');
        setLinkageConfirmPassword('');
        
        await reinitSupabase();
        loadData();
      }
    } catch (err) {
      console.error("Email linkage failed:", err);
      setLinkageError('Ocurrió un error inesperado al vincular la cuenta.');
    } finally {
      setIsLinking(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('delivery_session');
    localStorage.removeItem('delivery_active_tab');
    localStorage.removeItem('delivery_form_draft');
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

      // 3. Fallback: Free Nominatim (OSM) / CartoCiudad (Spain)
      const countryCode = searchCountryCode || 'es';
      const cityBias = searchCityBias || 'Barcelona';
      const strictCity = searchStrictCity;

      let searchQuery = normalizeSpanishAddressQuery(queryText);
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
          const cartoUrl = `https://www.cartociudad.es/geocoder/api/geocoder/candidates?q=${encodeURIComponent(cartoQuery)}&limit=5`;
          const cartoRes = await fetch(cartoUrl);
          if (cartoRes.ok) {
            const cartoData = await cartoRes.json();
            if (cartoData && cartoData.length > 0) {
              const formatted = cartoData.map(item => ({
                lat: item.lat.toString(),
                lon: item.lng.toString(),
                display_name: item.muni ? `${item.address}, ${item.muni}, ${item.province}, España` : `${item.address}, ${item.province}, España`,
                address: {
                  road: item.address,
                  postcode: item.postalCode || '',
                  city: item.muni || '',
                  state: item.comunidadAutonoma || ''
                }
              }));
              setSuggestions(formatted);
              setIsSearchingSuggestions(false);
              return;
            }
          }
        } catch (err) {
          console.error("CartoCiudad suggestions failed, falling back to Nominatim:", err);
        }
      }

      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&countrycodes=${countryCode}&q=${encodeURIComponent(searchQueryWithCity)}`;
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
    const shortAddress = getShortAddressString(finalAddress);

    setAddress(shortAddress);

    const extractedPostcode = sug.address && sug.address.postcode ? sug.address.postcode : '';
    if (extractedPostcode) {
      setPostcode(extractedPostcode);
    }

    setAddressVerification({
      status: 'success',
      message: `🟢 Dirección verificada correctamente (GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      coords: { lat, lng }
    });
    setLastVerifiedAddress(shortAddress);
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
        const cleanedAddress = processVoiceAddress(transcript);
        setAddress(cleanedAddress);
        setAddressVerification({ status: 'idle', message: '' });
        
        // Verificar errores de ortografía en el texto dictado
        const corrections = getStreetSpellingSuggestions(cleanedAddress);
        setSpellingSuggestions(corrections);
        
        // Buscar sugerencias de mapas para el texto dictado
        fetchAddressSuggestions(cleanedAddress);
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
        setRouteStartAddr(processVoiceAddress(transcript));
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
        setRouteEndAddr(processVoiceAddress(transcript));
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
    }, 60000);
  };

  const handleMoveTicketOrder = async (ticketId, direction) => {
    const ticketA = tickets.find(t => t.id === ticketId);
    if (!ticketA) return;

    const dayTickets = sortTicketsByRouteOrder(
      tickets.filter(t => t.date === ticketA.date && t.furgoId === ticketA.furgoId)
    );

    const idx = dayTickets.findIndex(t => t.id === ticketId);
    if (idx === -1) return;

    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === dayTickets.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const ticketB = dayTickets[targetIdx];

    const updatedTickets = tickets.map(t => {
      if (t.date === ticketA.date && t.furgoId === ticketA.furgoId) {
        const itemIdx = dayTickets.findIndex(x => x.id === t.id);
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
      saveTickets(updatedTickets);
      saveRouteManualStatus(ticketA.furgoId, ticketA.date, true);
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
      saveTickets(updatedTickets);
      saveRouteManualStatus(ticketToMove.furgoId, ticketToMove.date, true);
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
        const shortDisplayName = coords.displayName ? getShortAddressString(coords.displayName) : trimmed;
        if (coords.displayName && shortDisplayName !== trimmed) {
          setAddress(shortDisplayName);
          setLastVerifiedAddress(shortDisplayName);
        } else {
          setLastVerifiedAddress(trimmed);
        }
        setAddressVerification({ 
          status: 'success', 
          message: `🟢 Verificada como: ${shortDisplayName}`,
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

    const existingTicket = editingTicketId ? tickets.find(t => t.id === editingTicketId) : null;
    const matchedTaskIds = [];
    const getExistingNoCharge = (tariffId, details = {}) => {
      if (!existingTicket || !existingTicket.tasks) return false;
      const idx = existingTicket.tasks.findIndex((t, i) => {
        if (matchedTaskIds.includes(i)) return false;
        const matchesTariff = t.tariffId === tariffId;
        const matchesInches = !details.inches || t.inches === details.inches;
        const matchesBrand = !details.brand || t.brand === details.brand;
        const matchesDesc = !details.desc || (t.name && t.name.includes(`(${details.desc})`));
        return matchesTariff && matchesInches && matchesBrand && matchesDesc;
      });
      if (idx !== -1) {
        matchedTaskIds.push(idx);
        return !!existingTicket.tasks[idx].noCharge;
      }
      return false;
    };

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
        const mainTariff = tariffs.find(t => t.id === mainTariffId);
        let taskName = mainTariff?.name || `TV ${tv.inches}"`;
        
        if (tv.action === 'recogida') {
          taskName = `${taskName} (Recogida)`;
        } else if (tv.action === 'combinado') {
          taskName = `${taskName} (Entrega + Recogida)`;
        } else {
          taskName = `${taskName} (Entrega)`;
        }

        tasksArray.push({
          tariffId: mainTariffId,
          quantity: 1,
          brand: tv.brand || 'Genérica',
          inches: tv.inches || 43,
          action: tv.action,
          name: taskName,
          noCharge: getExistingNoCharge(mainTariffId, { inches: tv.inches, brand: tv.brand })
        });
      }

      // PM
      if (tv.pmType !== 'none') {
        const pmId = tv.pmType === 'basic' ? `PM_BAS_${range}` : `PM_COMP_${range}`;
        tasksArray.push({
          tariffId: pmId,
          quantity: 1,
          brand: tv.brand || 'Genérica',
          inches: tv.inches || 43,
          noCharge: getExistingNoCharge(pmId, { inches: tv.inches, brand: tv.brand })
        });
      }

      // Cuelgue
      if (tv.cuelgue) {
        const cuelgueId = `CUELGUE_${range}`;
        tasksArray.push({
          tariffId: cuelgueId,
          quantity: 1,
          brand: tv.brand || 'Genérica',
          inches: tv.inches || 43,
          noCharge: getExistingNoCharge(cuelgueId, { inches: tv.inches, brand: tv.brand })
        });
      }

      // Recogida vieja
      if (tv.recogidaViejaType !== 'none') {
        const recId = tv.recogidaViejaType === 'urbantz' ? 'TV_VIEJA_URB' : 'TV_VIEJA_NO_URB';
        tasksArray.push({
          tariffId: recId,
          quantity: 1,
          noCharge: getExistingNoCharge(recId)
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
              name: `${originalTariff?.name || 'Paquetería'} (${desc})`,
              noCharge: getExistingNoCharge(tariffId, { desc })
            });
          }
        } else {
          const originalTariff = tariffs.find(t => t.id === tariffId);
          const isElectrodomestico = originalTariff && getNormalizedBlock(originalTariff.block) === 'electrodomesticos varios';
          
          if (isElectrodomestico) {
            const action = otherActions[tariffId] || 'entrega';
            let taskName = originalTariff.name;
            let finalPrice = calculateTaskPrice(tariffId, tariffs, modulePrice);
            
            if (action === 'recogida') {
              taskName = `${taskName} (Recogida)`;
            } else if (action === 'combinado') {
              taskName = `${taskName} (Entrega + Recogida)`;
              finalPrice = finalPrice * 2;
            } else {
              taskName = `${taskName} (Entrega)`;
            }
            
            tasksArray.push({
              tariffId,
              quantity,
              action,
              name: taskName,
              unitPrice: finalPrice,
              price: finalPrice,
              noCharge: getExistingNoCharge(tariffId)
            });
          } else {
            tasksArray.push({
              tariffId,
              quantity,
              noCharge: getExistingNoCharge(tariffId)
            });
          }
        }
      }
    });

    // 3. Añadir conceptos adicionales (extras personalizados)
    customExtras.forEach(extra => {
      tasksArray.push({
        tariffId: extra.id,
        name: extra.name,
        price: extra.price,
        quantity: 1,
        noCharge: getExistingNoCharge(extra.id)
      });
    });

    // 4. Añadir Servicio Urgente si aplica
    if (urgenteType === '100') {
      tasksArray.push({
        tariffId: 'URGENTE_100',
        quantity: 1,
        noCharge: getExistingNoCharge('URGENTE_100')
      });
    } else if (urgenteType === '120') {
      tasksArray.push({
        tariffId: 'URGENTE_120',
        quantity: 1,
        noCharge: getExistingNoCharge('URGENTE_120')
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

    let activeServiceType = serviceType;
    if (activeServiceType === 'entrega' && formTvs.length > 0) {
      const hasDeliveryTv = formTvs.some(tv => tv.action !== 'solo_pm' && tv.action !== 'solo_cuelgue');
      const hasStandardDelivery = Object.values(otherQuantities).some(q => q > 0);
      
      if (!hasDeliveryTv && !hasStandardDelivery) {
        const hasOnlyPm = formTvs.every(tv => tv.action === 'solo_pm');
        const hasOnlyCuelgue = formTvs.every(tv => tv.action === 'solo_cuelgue');
        if (hasOnlyPm) {
          activeServiceType = 'puesta_marcha';
        } else if (hasOnlyCuelgue) {
          activeServiceType = 'cuelgue';
        }
      }
    }

    let finalNotes = notes.trim();
    if (activeServiceType === 'cuelgue') {
      finalNotes = `[CUELGUE] ${finalNotes}`.trim();
    } else if (activeServiceType === 'puesta_marcha') {
      finalNotes = `[PUESTA_MARCHA] ${finalNotes}`.trim();
    } else if (activeServiceType === 'tarde') {
      finalNotes = `[TARDE] ${finalNotes}`.trim();
    }
    
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
      if (coords.displayName) {
        ticketData.address = getShortAddressString(coords.displayName);
      }
      if (coords.postcode && !ticketData.postcode) {
        ticketData.postcode = coords.postcode;
      }
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
      localStorage.removeItem('delivery_form_draft');
      setCustomerName('');
      setPhone('');
      setAddress('');
      setPostcode('');
      setAddressVerification({ status: 'idle', message: '' });
      setLastVerifiedAddress('');
      setFormTvs([]);
      setOtherQuantities({});
      setOtherActions({});
      setCustomExtras([]);
      setCustomExtraName('');
      setCustomExtraPrice('');
      setUrgenteType('none');
      setServiceType('entrega');
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
    
    saveRouteStartAddr(routeStartAddr, targetFurgo);
    saveRouteEndAddr(routeEndAddr, targetFurgo);

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

      // Separar completados y pendientes
      const completedTickets = ticketsWithCoords.filter(t => t.status === 'success' || t.status === 'failed');
      const pendingTickets = ticketsWithCoords.filter(t => t.status !== 'success' && t.status !== 'failed');

      // Preservar el orden de paradas ya completadas
      completedTickets.sort((a, b) => {
        const aOrder = a.routeOrder !== undefined && a.routeOrder !== null && a.routeOrder !== '' ? Number(a.routeOrder) : Infinity;
        const bOrder = b.routeOrder !== undefined && b.routeOrder !== null && b.routeOrder !== '' ? Number(b.routeOrder) : Infinity;
        return aOrder - bOrder;
      });

      // El punto de partida de la optimización será la última parada completada (si existe), o el origen
      let currentPos = startCoords;
      if (completedTickets.length > 0) {
        const lastCompleted = completedTickets[completedTickets.length - 1];
        if (lastCompleted.lat && lastCompleted.lng) {
          currentPos = { lat: parseFloat(lastCompleted.lat), lng: parseFloat(lastCompleted.lng) };
        }
      }

      const parsedPending = pendingTickets.map(t => {
        const parsed = parseTicketNotes(t.notes);
        return { ...t, timeSlot: parsed.timeSlot, estimatedDuration: parsed.estimatedDuration };
      });

      const morningTickets = parsedPending.filter(t => t.timeSlot === 'morning');
      const anyTickets = parsedPending.filter(t => t.timeSlot === 'any' || !t.timeSlot);
      const afternoonTickets = parsedPending.filter(t => t.timeSlot === 'afternoon');

      const morningNN = [];
      const anyNN = [];
      const afternoonNN = [];

      const getInitialNN = (group, nnList) => {
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
            nnList.push(nextTicket);
            currentPos = { lat: nextTicket.lat, lng: nextTicket.lng };
          } else {
            break;
          }
        }
      };

      getInitialNN(morningTickets, morningNN);
      getInitialNN(anyTickets, anyNN);
      getInitialNN(afternoonTickets, afternoonNN);

      const optimize2Opt = (stopsList, start, end) => {
        if (stopsList.length <= 1) return stopsList;
        let bestRoute = [...stopsList];
        let improved = true;
        
        const getPathDistance = (r) => {
          let dist = 0;
          let curr = start;
          for (let i = 0; i < r.length; i++) {
            dist += getDistance(curr, r[i]);
            curr = r[i];
          }
          dist += getDistance(curr, end);
          return dist;
        };

        let bestDist = getPathDistance(bestRoute);
        let iterations = 0;
        const maxIterations = 1000;

        while (improved && iterations < maxIterations) {
          improved = false;
          iterations++;
          for (let i = 0; i < bestRoute.length - 1; i++) {
            for (let j = i + 1; j < bestRoute.length; j++) {
              const newRoute = [...bestRoute];
              let left = i;
              let right = j;
              while (left < right) {
                const temp = newRoute[left];
                newRoute[left] = newRoute[right];
                newRoute[right] = temp;
                left++;
                right--;
              }
              
              const newDist = getPathDistance(newRoute);
              if (newDist < bestDist - 0.0001) {
                bestRoute = newRoute;
                bestDist = newDist;
                improved = true;
                break;
              }
            }
            if (improved) break;
          }
        }
        return bestRoute;
      };

      const getSegmentEndCoords = (nextSegment1, nextSegment2, fallbackEnd) => {
        if (nextSegment1 && nextSegment1.length > 0) {
          return { lat: nextSegment1[0].lat, lng: nextSegment1[0].lng };
        }
        if (nextSegment2 && nextSegment2.length > 0) {
          return { lat: nextSegment2[0].lat, lng: nextSegment2[0].lng };
        }
        return fallbackEnd;
      };

      const morningEnd = getSegmentEndCoords(anyNN, afternoonNN, endCoords);
      const optimizedMorning = optimize2Opt(morningNN, currentPos, morningEnd);

      const anyStart = optimizedMorning.length > 0 
        ? { lat: optimizedMorning[optimizedMorning.length - 1].lat, lng: optimizedMorning[optimizedMorning.length - 1].lng }
        : currentPos;
      const anyEnd = getSegmentEndCoords(afternoonNN, null, endCoords);
      const optimizedAny = optimize2Opt(anyNN, anyStart, anyEnd);

      const afternoonStart = optimizedAny.length > 0
        ? { lat: optimizedAny[optimizedAny.length - 1].lat, lng: optimizedAny[optimizedAny.length - 1].lng }
        : (optimizedMorning.length > 0 
            ? { lat: optimizedMorning[optimizedMorning.length - 1].lat, lng: optimizedMorning[optimizedMorning.length - 1].lng }
            : currentPos);
      const optimizedAfternoon = optimize2Opt(afternoonNN, afternoonStart, endCoords);

      const route = [...completedTickets, ...optimizedMorning, ...optimizedAny, ...optimizedAfternoon];

      const optimizedWithOrder = route.map((ticket, index) => ({
        ...ticket,
        routeOrder: index + 1
      }));
      const updatedAllTickets = tickets.map(t => {
        const match = optimizedWithOrder.find(x => x.id === t.id);
        return match ? match : t;
      });
      setTickets(updatedAllTickets);
      saveTickets(updatedAllTickets);

      saveRouteManualStatus(targetFurgo, targetDate, false);

      triggerAlert(`¡Ruta optimizada con éxito! ${route.length} paradas ordenadas de forma eficiente.`, 'success');
      loadData();
    } catch (err) {
      console.error(err);
      triggerAlert('Ocurrió un error al optimizar la ruta.', 'error');
    } finally {
      setIsOptimizing(false);
    }
  };

  const autoOptimizeRemainingRoute = async (targetFurgoId, targetDate, lastCompletedTicketId) => {
    try {
      const isManual = getRouteManualStatus(targetFurgoId, targetDate);
      if (isManual) {
        loadData();
        return;
      }

      const allTickets = getTickets();
      const dayTickets = allTickets.filter(t => t && t.furgoId === targetFurgoId && t.date === targetDate);
      if (dayTickets.length <= 1) return;

      const completedTickets = dayTickets.filter(t => t.status === 'success' || t.status === 'failed');
      const pendingTickets = dayTickets.filter(t => t.status !== 'success' && t.status !== 'failed');

      if (pendingTickets.length === 0) return;

      completedTickets.sort((a, b) => {
        const aOrder = a.routeOrder !== undefined && a.routeOrder !== null && a.routeOrder !== '' ? Number(a.routeOrder) : Infinity;
        const bOrder = b.routeOrder !== undefined && b.routeOrder !== null && b.routeOrder !== '' ? Number(b.routeOrder) : Infinity;
        return aOrder - bOrder;
      });

      let startCoords = null;
      const lastCompleted = dayTickets.find(t => t.id === lastCompletedTicketId);
      if (lastCompleted) {
        const cLat = lastCompleted.completedLat || lastCompleted.lat;
        const cLng = lastCompleted.completedLng || lastCompleted.lng;
        if (cLat && cLng) {
          startCoords = { lat: parseFloat(cLat), lng: parseFloat(cLng) };
        }
      }

      if (!startCoords && completedTickets.length > 0) {
        const lastInCompleted = completedTickets[completedTickets.length - 1];
        if (lastInCompleted) {
          const cLat = lastInCompleted.completedLat || lastInCompleted.lat;
          const cLng = lastInCompleted.completedLng || lastInCompleted.lng;
          if (cLat && cLng) {
            startCoords = { lat: parseFloat(cLat), lng: parseFloat(cLng) };
          }
        }
      }

      if (!startCoords) {
        const startAddr = getRouteStartAddr(targetFurgoId) || '';
        if (startAddr.trim()) {
          const geocoded = await geocodeAddress(startAddr);
          if (geocoded && geocoded.lat && geocoded.lng) {
            startCoords = { lat: parseFloat(geocoded.lat), lng: parseFloat(geocoded.lng) };
          }
        }
      }

      if (!startCoords) {
        startCoords = { lat: 41.3879, lng: 2.16992 };
      }

      let endCoords = null;
      const endAddr = getRouteEndAddr(targetFurgoId) || '';
      if (endAddr.trim()) {
        const geocoded = await geocodeAddress(endAddr);
        if (geocoded && geocoded.lat && geocoded.lng) {
          endCoords = { lat: parseFloat(geocoded.lat), lng: parseFloat(geocoded.lng) };
        }
      }
      if (!endCoords) {
        endCoords = startCoords;
      }

      // Separar paradas pendientes entre "saltadas" (su orden original era menor al de la completada) y "normales"
      let skippedPending = [];
      let normalPending = [];

      if (lastCompleted && lastCompleted.routeOrder !== undefined && lastCompleted.routeOrder !== null && lastCompleted.routeOrder !== '') {
        const lastOrder = Number(lastCompleted.routeOrder);
        pendingTickets.forEach(t => {
          const tOrder = t.routeOrder !== undefined && t.routeOrder !== null && t.routeOrder !== '' ? Number(t.routeOrder) : Infinity;
          if (tOrder < lastOrder) {
            skippedPending.push(t);
          } else {
            normalPending.push(t);
          }
        });
      } else {
        normalPending = [...pendingTickets];
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

      const geocodeAndFormat = async (ticketsList) => {
        const listWithCoords = [];
        for (const t of ticketsList) {
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
            listWithCoords.push({ ...t, lat, lng });
          } else {
            listWithCoords.push({ ...t, lat: startCoords.lat, lng: startCoords.lng });
          }
        }
        return listWithCoords;
      };

      const normalWithCoords = await geocodeAndFormat(normalPending);
      const skippedWithCoords = await geocodeAndFormat(skippedPending);

      const optimizeList = (listWithCoords, startingPos, endingPos) => {
        const parsedList = listWithCoords.map(t => {
          const parsed = parseTicketNotes(t.notes);
          return { ...t, timeSlot: parsed.timeSlot, estimatedDuration: parsed.estimatedDuration };
        });

        const morningTickets = parsedList.filter(t => t.timeSlot === 'morning');
        const anyTickets = parsedList.filter(t => t.timeSlot === 'any' || !t.timeSlot);
        const afternoonTickets = parsedList.filter(t => t.timeSlot === 'afternoon');

        const morningNN = [];
        const anyNN = [];
        const afternoonNN = [];
        let currentPos = startingPos;

        const getInitialNN = (group, nnList) => {
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
              nnList.push(nextTicket);
              currentPos = { lat: nextTicket.lat, lng: nextTicket.lng };
            } else {
              break;
            }
          }
        };

        getInitialNN(morningTickets, morningNN);
        getInitialNN(anyTickets, anyNN);
        getInitialNN(afternoonTickets, afternoonNN);

        const optimize2Opt = (stopsList, start, end) => {
          if (stopsList.length <= 1) return stopsList;
          let bestRoute = [...stopsList];
          let improved = true;
          
          const getPathDistance = (r) => {
            let dist = 0;
            let curr = start;
            for (let i = 0; i < r.length; i++) {
              dist += getDistance(curr, r[i]);
              curr = r[i];
            }
            dist += getDistance(curr, end);
            return dist;
          };

          let bestDist = getPathDistance(bestRoute);
          let iterations = 0;
          const maxIterations = 1000;

          while (improved && iterations < maxIterations) {
            improved = false;
            iterations++;
            for (let i = 0; i < bestRoute.length - 1; i++) {
              for (let j = i + 1; j < bestRoute.length; j++) {
                const newRoute = [...bestRoute];
                let left = i;
                let right = j;
                while (left < right) {
                  const temp = newRoute[left];
                  newRoute[left] = newRoute[right];
                  newRoute[right] = temp;
                  left++;
                  right--;
                }
                
                const newDist = getPathDistance(newRoute);
                if (newDist < bestDist - 0.0001) {
                  bestRoute = newRoute;
                  bestDist = newDist;
                  improved = true;
                  break;
                }
              }
              if (improved) break;
            }
          }
          return bestRoute;
        };

        const getSegmentEndCoords = (nextSegment1, nextSegment2, fallbackEnd) => {
          if (nextSegment1 && nextSegment1.length > 0) {
            return { lat: nextSegment1[0].lat, lng: nextSegment1[0].lng };
          }
          if (nextSegment2 && nextSegment2.length > 0) {
            return { lat: nextSegment2[0].lat, lng: nextSegment2[0].lng };
          }
          return fallbackEnd;
        };

        const morningEnd = getSegmentEndCoords(anyNN, afternoonNN, endingPos);
        const optimizedMorning = optimize2Opt(morningNN, startingPos, morningEnd);

        const anyStart = optimizedMorning.length > 0 
          ? { lat: optimizedMorning[optimizedMorning.length - 1].lat, lng: optimizedMorning[optimizedMorning.length - 1].lng }
          : startingPos;
        const anyEnd = getSegmentEndCoords(afternoonNN, null, endingPos);
        const optimizedAny = optimize2Opt(anyNN, anyStart, anyEnd);

        const afternoonStart = optimizedAny.length > 0
          ? { lat: optimizedAny[optimizedAny.length - 1].lat, lng: optimizedAny[optimizedAny.length - 1].lng }
          : (optimizedMorning.length > 0 
              ? { lat: optimizedMorning[optimizedMorning.length - 1].lat, lng: optimizedMorning[optimizedMorning.length - 1].lng }
              : startingPos);
        const optimizedAfternoon = optimize2Opt(afternoonNN, afternoonStart, endingPos);

        const optimizedResult = [...optimizedMorning, ...optimizedAny, ...optimizedAfternoon];
        const lastPos = optimizedResult.length > 0 
          ? { lat: optimizedResult[optimizedResult.length - 1].lat, lng: optimizedResult[optimizedResult.length - 1].lng }
          : startingPos;

        return { optimizedResult, lastPos };
      };

      const { optimizedResult: optimizedNormal, lastPos: postNormalPos } = optimizeList(normalWithCoords, startCoords, endCoords);
      const { optimizedResult: optimizedSkipped } = optimizeList(skippedWithCoords, postNormalPos, endCoords);

      const finalSequence = [...completedTickets, ...optimizedNormal, ...optimizedSkipped];

      const orderedSequence = finalSequence.map((ticket, index) => ({
        ...ticket,
        routeOrder: index + 1
      }));
      const updatedAll = allTickets.map(t => {
        const match = orderedSequence.find(x => x.id === t.id);
        return match ? match : t;
      });
      saveTickets(updatedAll);

      loadData();
    } catch (err) {
      console.error("Error in auto-optimizing remaining route:", err);
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
    let cleanNotesText = parsed.cleanNotes;
    let sType = 'entrega';
    if (cleanNotesText.includes('[CUELGUE]')) {
      sType = 'cuelgue';
      cleanNotesText = cleanNotesText.replace('[CUELGUE]', '').trim();
    } else if (cleanNotesText.includes('[PUESTA_MARCHA]')) {
      sType = 'puesta_marcha';
      cleanNotesText = cleanNotesText.replace('[PUESTA_MARCHA]', '').trim();
    } else if (cleanNotesText.includes('[TARDE]')) {
      sType = 'tarde';
      cleanNotesText = cleanNotesText.replace('[TARDE]', '').trim();
    } else {
      sType = getTicketServiceType(ticket);
    }
    setServiceType(sType);
    setNotes(cleanNotesText);
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

      const inches = mTask.inches 
        ? parseInt(mTask.inches) 
        : (mTask.name.match(/(\d+)"/) 
            ? parseInt(mTask.name.match(/(\d+)"/)[1]) 
            : (range === '49' ? 43 : range === '74' ? 55 : 75));
      const brand = mTask.brand || 'Genérica';

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
        brand,
        action: mTask.action || (isComb ? 'combinado' : (mTask.name && mTask.name.includes('Recogida') && !mTask.name.includes('Entrega') ? 'recogida' : 'entrega')),
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
      const inches = pmMatch.inches 
        ? parseInt(pmMatch.inches) 
        : (pmMatch.name.match(/(\d+)"/) 
            ? parseInt(pmMatch.name.match(/(\d+)"/)[1]) 
            : (range === '49' ? 43 : range === '74' ? 55 : 75));
      const brand = pmMatch.brand || 'Genérica';

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
        brand,
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
      const inches = cuelgueMatch.inches 
        ? parseInt(cuelgueMatch.inches) 
        : (cuelgueMatch.name.match(/(\d+)"/) 
            ? parseInt(cuelgueMatch.name.match(/(\d+)"/)[1]) 
            : (range === '49' ? 43 : range === '74' ? 55 : 75));
      const brand = cuelgueMatch.brand || 'Genérica';

      let recogidaViejaType = 'none';
      if (viejaIndex < viejaTasks.length) {
        const viejaMatch = viejaTasks[viejaIndex++];
        recogidaViejaType = viejaMatch.tariffId.includes('URB') && !viejaMatch.tariffId.includes('NO_URB') ? 'urbantz' : 'no_urbantz';
      }

      tempTvs.push({
        id: 'tv_cuelgue_' + cuelgueIndex + Date.now().toString(),
        inches,
        brand,
        action: 'solo_cuelgue',
        pmType: 'none',
        cuelgue: true,
        recogidaViejaType
      });
    }

    const tempCustomExtras = [];
    const tempDescriptions = {};
    const tempActions = {};
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
        if (t.action) {
          tempActions[t.tariffId] = t.action;
        }
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
    setOtherActions(tempActions);
    setOtherDescriptions(tempDescriptions);
    setCustomExtras(tempCustomExtras);
    setUrgenteType(localUrgente);
    setCodAmount(ticket.codAmount ? ticket.codAmount.toString() : '');
    setFormStep(1);
    setActiveTab('new_ticket');
  };

  const cancelEditing = () => {
    localStorage.removeItem('delivery_form_draft');
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
    setOtherActions({});
    setCustomExtras([]);
    setCustomExtraName('');
    setCustomExtraPrice('');
    setUrgenteType('none');
    setServiceType('entrega');
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


  const handleUpdateTariffValue = async (id, newValue) => {
    try {
      const valueNum = parseFloat(newValue) || 0;
      const updated = tariffs.map(t => (t.id === id ? { ...t, value: valueNum } : t));
      saveTariffs(updated);
      setTariffs(updated);
      recalculateAllTickets(updated, modulePrice);
    } catch (error) {
      console.error("Error updating tariff value:", error);
      triggerAlert('Error al guardar, intentando localmente', 'warning');
      const valueNum = parseFloat(newValue) || 0;
      const updated = tariffs.map(t => (t.id === id ? { ...t, value: valueNum } : t));
      setTariffs(updated);
    }
  };

  const handleUpdateTariffDetails = async (id, updatedDetails) => {
    try {
      const updated = tariffs.map(t => {
        if (t.id === id) {
          return {
            ...t,
            name: (updatedDetails.name || '').trim(),
            block: updatedDetails.block || 'Otros',
            type: updatedDetails.type || 'fixed',
            value: parseFloat(updatedDetails.value) || 0
          };
        }
        return t;
      });
      saveTariffs(updated);
      setTariffs(updated);
      recalculateAllTickets(updated, modulePrice);
      triggerAlert('Tarifa actualizada correctamente');
      setEditingTariffId(null);
    } catch (error) {
      console.error("Error updating tariff details:", error);
      triggerAlert('Error al guardar, intentando localmente', 'warning');
      const updated = tariffs.map(t => {
        if (t.id === id) {
          return {
            ...t,
            name: (updatedDetails.name || '').trim(),
            block: updatedDetails.block || 'Otros',
            type: updatedDetails.type || 'fixed',
            value: parseFloat(updatedDetails.value) || 0
          };
        }
        return t;
      });
      setTariffs(updated);
      setEditingTariffId(null);
    }
  };

  const handleCreateTariff = async (e) => {
    e.preventDefault();
    if (!newTariffName.trim() || !newTariffValue.trim()) {
      triggerAlert('Por favor rellena el nombre y precio de la tarifa', 'error');
      return;
    }
    const valNum = parseFloat(newTariffValue) || 0;
    try {
      const res = await addTariff({
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
    } catch (err) {
      console.error(err);
      triggerAlert('Error al añadir tarifa en el servidor, guardado localmente', 'warning');
      loadData();
    }
  };

  const handleDeleteTariff = async (id, name) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la tarifa "${name}"?`)) {
      try {
        await deleteTariff(id);
        triggerAlert(`Tarifa "${name}" eliminada`);
        loadData();
      } catch (err) {
        console.error(err);
        triggerAlert('Error al eliminar tarifa en el servidor, eliminada localmente', 'warning');
        loadData();
      }
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
    const allTickets = getTickets() || [];
    const changedTickets = [];
    const updatedTickets = allTickets.map(ticket => {
      let totalCalculado = 0;
      let hasChanged = false;
      
      const tasks = ticket.tasks.map(task => {
        if (task.tariffId && task.tariffId.startsWith('CUSTOM_')) return task;
        const basePrice = calculateTaskPrice(task.tariffId, activeTariffs, activeModulePrice);
        const price = task.noCharge ? 0 : basePrice;
        
        if (task.unitPrice !== price || task.subtotal !== (price * task.quantity)) {
          hasChanged = true;
        }
        
        return {
          ...task,
          unitPrice: price,
          subtotal: price * task.quantity
        };
      });
      
      totalCalculado = tasks.reduce((sum, t) => sum + t.subtotal, 0);
      const updatedTicket = { ...ticket, tasks, totalPrice: totalCalculado };
      
      if (hasChanged || ticket.totalPrice !== totalCalculado) {
        changedTickets.push(updatedTicket);
      }
      
      return updatedTicket;
    });
    
    localStorage.setItem('delivery_tickets', JSON.stringify(updatedTickets));
    setTickets(updatedTickets);
    
    if (supabase && changedTickets.length > 0) {
      (async () => {
        try {
          const formatted = changedTickets.map(t => ({
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
          console.error("Error saving updated tickets to Supabase:", e);
        }
      })();
    }
  };

  const getShiftSummary = (furgoId, date) => {
    const dayTickets = tickets.filter(t => t.furgoId === furgoId && t.date === date && t.status !== 'failed');
    
    let totalTvs = 0;
    let tvs49 = 0;
    let tvs74 = 0;
    let tvs115 = 0;
    let totalPV = 0;
    let totalGV = 0;
    let totalPM = 0;
    let totalCuelgues = 0;
    let totalVieja = 0;
    let totalOtros = 0;
    let otherDetails = [];
    let totalCODAmount = 0;
    
    dayTickets.forEach(t => {
      totalCODAmount += t.codAmount || 0;
      t.tasks.forEach(task => {
        const tid = task.tariffId || '';
        
        // Handle custom tasks
        if (tid.startsWith('CUSTOM_')) {
          totalOtros += task.quantity;
          const customName = task.name || 'Concepto adicional';
          const existing = otherDetails.find(d => d.name === customName);
          if (existing) {
            existing.quantity += task.quantity;
          } else {
            otherDetails.push({ name: customName, quantity: task.quantity });
          }
          return;
        }
        
        const tariff = tariffs.find(tar => tar.id === tid);
        if (!tariff) return;
        
        if (tariff.block === 'Televisores') {
          if (tid === 'TV_VIEJA_URB' || tid === 'TV_VIEJA_NO_URB') {
            totalVieja += task.quantity;
          } else {
            totalTvs += task.quantity;
            if (tid.endsWith('_49')) {
              tvs49 += task.quantity;
            } else if (tid.endsWith('_74')) {
              tvs74 += task.quantity;
            } else if (tid.endsWith('_115')) {
              tvs115 += task.quantity;
            }
          }
        } else if (tariff.block === 'Paquetería') {
          if (tid.includes('PV')) {
            totalPV += task.quantity;
          } else if (tid.includes('GV')) {
            totalGV += task.quantity;
          }
        } else if (tariff.block === 'Instalaciones' || tid.startsWith('PM_') || tid.startsWith('CUELGUE_')) {
          if (tid.startsWith('PM_')) {
            totalPM += task.quantity;
          } else if (tid.startsWith('CUELGUE_')) {
            totalCuelgues += task.quantity;
          }
        } else {
          totalOtros += task.quantity;
          const existing = otherDetails.find(d => d.name === tariff.name);
          if (existing) {
            existing.quantity += task.quantity;
          } else {
            otherDetails.push({ name: tariff.name, quantity: task.quantity });
          }
        }
      });
    });
    
    return {
      ticketsCount: dayTickets.length,
      totalTvs,
      tvs49,
      tvs74,
      tvs115,
      totalPV,
      totalGV,
      totalPM,
      totalCuelgues,
      totalVieja,
      totalOtros,
      otherDetails,
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

      // Remove from activeRoutes
      setActiveRoutes(prev => {
        const remaining = prev.filter(r => !(r.furgoId === furgoId && r.date === date));
        const targetRouteId = prev.find(r => r.furgoId === furgoId && r.date === date)?.id;
        if (currentRouteId === targetRouteId) {
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
        }
        return remaining;
      });

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

  const handleUpdateUserPermissions = (id, moduleId, isAllowed) => {
    const updated = users.map(u => {
      if (u.id === id) {
        let pObj = u.permissions || {};
        if (typeof pObj === 'string') {
          try { pObj = JSON.parse(pObj); } catch(e) { pObj = {}; }
        }
        const newPerms = { ...pObj, [moduleId]: isAllowed };
        return { ...u, permissions: newPerms };
      }
      return u;
    });
    saveUsers(updated).then(() => {
      setUsers(updated);
      triggerAlert('Permisos de usuario actualizados correctamente');
    }).catch((err) => {
      // Si falla la nube, el estado local ya está guardado en localStorage
      setUsers(updated);
    });
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

  const handleSendSupport = async (ticketId, targetFurgoId) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const targetUser = users.find(u => u.id === targetFurgoId);
    if (!targetUser) return;

    const currentOwnerLabel = ticket.furgoLabel || users.find(u => u.id === ticket.furgoId)?.label || ticket.furgoId;

    if (!window.confirm(`¿Estás seguro de que deseas enviar esta parada a ${targetUser.label} en modo de auxilio/apoyo?`)) {
      return;
    }

    try {
      const parsed = parseTicketNotes(ticket.notes);
      const originalRoute = parsed.originalRouteLabel || currentOwnerLabel;
      
      const updatedNotes = encodeTicketNotes(
        parsed.timeSlot,
        parsed.estimatedDuration,
        parsed.cleanNotes,
        parsed.driverObservations,
        parsed.failedChargeType,
        originalRoute
      );

      const targetDayTickets = tickets.filter(t => t.date === ticket.date && t.furgoId === targetUser.id);

      const updatedTicket = {
        ...ticket,
        furgoId: targetUser.id,
        furgoLabel: targetUser.label,
        routeName: `Ruta ${targetUser.label} (${ticket.date})`,
        notes: updatedNotes,
        routeOrder: targetDayTickets.length + 1
      };

      await updateTicket(updatedTicket);
      triggerAlert(`Parada transferida de apoyo a ${targetUser.label} con éxito`);
      loadData();
    } catch (err) {
      console.error("Error transferring ticket support:", err);
      triggerAlert("Error al realizar la transferencia de apoyo", "error");
    }
  };

  const handleAddHelper = () => {
    if (!newHelperName.trim()) return;
    if (helpersList.some(h => h.name.toLowerCase() === newHelperName.trim().toLowerCase())) {
      triggerAlert('Este ayudante ya está registrado', 'error');
      return;
    }
    const rate = parseFloat(newHelperRate) || 0;
    const updated = [...helpersList, { name: newHelperName.trim(), dailyRate: rate }];
    setHelpersList(updated);
    saveHelpersList(updated);
    setNewHelperName('');
    setNewHelperRate('');
    triggerAlert('Ayudante agregado con éxito');
  };

  const handleRemoveHelper = (name) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar a ${name} de la lista de ayudantes?`)) {
      const updated = helpersList.filter(h => h.name !== name);
      setHelpersList(updated);
      saveHelpersList(updated);
      triggerAlert('Ayudante eliminado');
    }
  };

  const handleAddPlate = () => {
    if (!newPlateVal.trim()) return;
    const cleanPlate = newPlateVal.trim().toUpperCase();
    if (platesList.includes(cleanPlate)) {
      triggerAlert('Esta matrícula ya está registrada', 'error');
      return;
    }
    const updated = [...platesList, cleanPlate];
    setPlatesList(updated);
    savePlatesList(updated);
    setNewPlateVal('');
    triggerAlert('Matrícula agregada con éxito');
  };

  const handleRemovePlate = (plate) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar la matrícula ${plate}?`)) {
      const updated = platesList.filter(p => p !== plate);
      setPlatesList(updated);
      savePlatesList(updated);
      triggerAlert('Matrícula eliminada');
    }
  };

  const handleAddEmployee = () => {
    if (!newEmployeeName.trim()) return;
    if (employeesList.some(e => e.name.toLowerCase() === newEmployeeName.trim().toLowerCase())) {
      triggerAlert('Este empleado ya está registrado', 'error');
      return;
    }
    const rate = parseFloat(newEmployeeRate) || 0;
    const newEmp = {
      id: `emp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: newEmployeeName.trim(),
      role: newEmployeeRole,
      dailyRate: rate
    };
    const updated = [...employeesList, newEmp];
    setEmployeesList(updated);
    saveEmployeesList(updated);
    setNewEmployeeName('');
    setNewEmployeeRate('');
    setNewEmployeeRole('chofer');
    triggerAlert('Empleado registrado con éxito');
  };

  const handleRemoveEmployee = (id, name) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar a ${name} de la lista de empleados?`)) {
      const updated = employeesList.filter(e => e.id !== id);
      setEmployeesList(updated);
      saveEmployeesList(updated);
      triggerAlert('Empleado eliminado');
    }
  };

  const handleReturnToOriginalRoute = async (ticketId) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const parsed = parseTicketNotes(ticket.notes);
    const origLabel = parsed.originalRouteLabel;
    if (!origLabel) return;

    const targetUser = users.find(u => u.label === origLabel);
    if (!targetUser) {
      triggerAlert(`No se pudo encontrar al chofer original (${origLabel})`, 'error');
      return;
    }

    if (!window.confirm(`¿Quieres devolver este cliente a la ruta original de ${targetUser.label}?`)) {
      return;
    }

    try {
      const cleanNotesText = parsed.cleanNotes;
      const updatedNotes = encodeTicketNotes(
        parsed.timeSlot,
        parsed.estimatedDuration,
        cleanNotesText,
        parsed.driverObservations,
        parsed.failedChargeType,
        ''
      );

      const targetDayTickets = tickets.filter(t => t.date === ticket.date && t.furgoId === targetUser.id);

      const updatedTicket = {
        ...ticket,
        furgoId: targetUser.id,
        furgoLabel: targetUser.label,
        routeName: `Ruta ${targetUser.label} (${ticket.date})`,
        notes: updatedNotes,
        routeOrder: targetDayTickets.length + 1
      };

      await updateTicket(updatedTicket);
      triggerAlert(`Cliente devuelto a ${targetUser.label} con éxito`);
      loadData();
    } catch (err) {
      console.error("Error returning ticket to original route:", err);
      triggerAlert("Error al devolver el cliente", "error");
    }
  };

  const handleUpdateTicketStatus = (id, status, failureReason) => {
    if (status === 'success' || status === 'failed') {
      // If failureReason already provided (e.g. from quickFail grid), skip the obsModal
      if (status === 'failed' && failureReason) {
        executeTicketStatusUpdate(id, status, failureReason, '', 'none');
        return;
      }
      const ticket = tickets.find(t => t.id === id);
      const parsed = ticket ? parseTicketNotes(ticket.notes) : { cleanNotes: '', timeSlot: 'any', estimatedDuration: 10, driverObservations: '', failedChargeType: 'none' };
      setObsModalTicketId(id);
      setObsModalStatus(status);
      setObsModalObservations(parsed.driverObservations || '');
      setObsModalFailReason(status === 'failed' ? 'Ausente' : '');
      setObsModalFailedChargeType(status === 'failed' ? (parsed.failedChargeType || 'none') : 'none');
      return;
    }

    // Direct update for other statuses (pending, transit)
    executeTicketStatusUpdate(id, status, '', '');
  };

  const executeTicketStatusUpdate = (id, status, failureReason, observations, failedChargeType = 'none') => {
    // Update local ticket notes before database sync
    const localTickets = JSON.parse(localStorage.getItem('delivery_tickets')) || [];
    const index = localTickets.findIndex(t => t.id === id);
    if (index !== -1) {
      const parsed = parseTicketNotes(localTickets[index].notes);
      localTickets[index].notes = encodeTicketNotes(
        parsed.timeSlot, 
        parsed.estimatedDuration, 
        parsed.cleanNotes, 
        observations, 
        failedChargeType,
        parsed.originalRouteLabel
      );
      localStorage.setItem('delivery_tickets', JSON.stringify(localTickets));
    }

    const performUpdate = async (latitude = null, longitude = null) => {
      const currentTickets = getTickets();
      const ticketObj = currentTickets.find(t => t.id === id);
      const furgoId = ticketObj ? ticketObj.furgoId : null;
      const date = ticketObj ? ticketObj.date : null;

      await updateTicketStatus(id, status, failureReason, latitude, longitude);
      
      if (status === 'success' || status === 'failed') {
        if (furgoId && date) {
          await autoOptimizeRemainingRoute(furgoId, date, id);
        } else {
          loadData();
        }
      } else {
        loadData();
      }
      
      triggerAlert(`Reparto marcado como: ${status === 'success' ? 'Entregado' : status === 'failed' ? 'Fallido' : 'Pendiente'}`);
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          performUpdate(latitude, longitude);
        },
        (error) => {
          console.warn("GPS Location capture failed:", error);
          performUpdate();
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      performUpdate();
    }
  };

  const submitStatusWithObservations = () => {
    if (!obsModalTicketId) return;
    const id = obsModalTicketId;
    const status = obsModalStatus;
    const observations = obsModalObservations;
    const failureReason = status === 'failed' ? obsModalFailReason : '';
    const failedChargeType = status === 'failed' ? obsModalFailedChargeType : 'none';

    executeTicketStatusUpdate(id, status, failureReason, observations, failedChargeType);
    setObsModalTicketId(null);
  };

  const toggleTaskCharge = async (ticketId, taskIndex) => {
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return;
      const updatedTasks = (ticket.tasks || []).map((t, idx) => {
        if (idx === taskIndex) {
          return { ...t, noCharge: !t.noCharge };
        }
        return t;
      });
      const updatedTicket = {
        ...ticket,
        tasks: updatedTasks
      };
      await updateTicket(updatedTicket);
      triggerAlert('Estado de cobro del servicio actualizado', 'success');
      loadData();
    } catch (e) {
      console.error("Error toggling task charge:", e);
      triggerAlert('Error al actualizar el cobro del servicio', 'error');
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
      if (task.tariffId && task.tariffId.startsWith('CUSTOM_')) return task;
      const basePrice = calculateTaskPrice(task.tariffId, tariffs, modulePrice);
      const price = task.noCharge ? 0 : basePrice;
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

  const openInGoogleMaps = (address, latitude, longitude) => {
    let url = '';
    if (latitude && longitude) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    }
    window.open(url, '_blank');
  };

  const openInWaze = (address, latitude, longitude) => {
    let url = '';
    if (latitude && longitude) {
      url = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
    } else {
      url = `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
    }
    window.open(url, '_blank');
  };

  const openStreetView = (address, latitude, longitude) => {
    let url = '';
    if (latitude && longitude) {
      url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }
    window.open(url, '_blank');
  };

  const handleNavigate = (address, latitude = null, longitude = null, ticketId = null) => {
    if (ticketId) {
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket && (!ticket.status || ticket.status === 'pending')) {
        updateTicketStatus(ticketId, 'transit', '');
        loadData();
        triggerAlert('Iniciando viaje de reparto. ¡Buen viaje!', 'success');
      }
    }

    const targetNavigator = localStorage.getItem('delivery_default_navigator') || 'ask';

    if (targetNavigator === 'google') {
      openInGoogleMaps(address, latitude, longitude);
    } else if (targetNavigator === 'waze') {
      openInWaze(address, latitude, longitude);
    } else {
      setNavTarget({ address, latitude, longitude, ticketId });
      setNavModalOpen(true);
    }
  };

  const handleStartTransit = (id) => {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    handleNavigate(ticket.address, ticket.latitude, ticket.longitude, ticket.id);
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
      if (billingFilterFurgo !== 'all' && t.furgoId !== billingFilterFurgo) return false;
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
    const furgos = billingFilterFurgo !== 'all'
      ? activeRepartidores.filter(u => u.id === billingFilterFurgo).map(u => u.id)
      : activeRepartidores.map(u => u.id);

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

    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const formatSpanishDate = (dateStr) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length < 3) return dateStr;
      return `${parts[2]}/${parts[1]}`;
    };

    const handleQuickCreate = (targetDate, label) => {
      const defaultName = `Ruta ${label} (${formatSpanishDate(targetDate)})`;
      const selectedFurgoId = currentUser?.role === 'repartidor' 
        ? currentUser.id 
        : (newRouteFurgoId || (activeRepartidores[0]?.id || ''));
      
      const newRoute = {
        id: `${defaultName}|${targetDate}|${selectedFurgoId}`,
        name: defaultName,
        date: targetDate,
        furgoId: selectedFurgoId
      };

      setActiveRoutes(prev => [...prev, newRoute]);
      setCurrentRouteId(newRoute.id);
      setShowCreateRouteFormFields(false);

      setTicketDate(targetDate);
      setTicketRoute(selectedFurgoId);
      setRouteName(defaultName);
      setFormStep(1);
      setNewRouteName('');
      
      triggerAlert(`🚀 Ruta "${defaultName}" creada para el ${formatSpanishDate(targetDate)}. ¡Añade las paradas!`);
    };

    const handleCreateRouteSubmit = (e) => {
      e.preventDefault();
      const cleanName = newRouteName.trim() || `Ruta ${formatSpanishDate(newRouteDate)}`;
      
      const selectedFurgoId = currentUser?.role === 'repartidor' 
        ? currentUser.id 
        : (newRouteFurgoId || (activeRepartidores[0]?.id || ''));
      if (!selectedFurgoId) {
        triggerAlert('Por favor, asigna una furgoneta o chofer', 'error');
        return;
      }
      if (!newRouteDate) {
        triggerAlert('Por favor, selecciona una fecha para la ruta', 'error');
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

        {/* Botones de creación rápida */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '5px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleQuickCreate(todayStr, 'Hoy')}
            style={{ 
              height: '56px', 
              background: 'rgba(99, 102, 241, 0.1)', 
              color: '#fff', 
              border: '1px solid var(--primary)',
              borderRadius: '10px',
              fontSize: '0.88rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontWeight: '800' }}>📅 Ruta para HOY</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>({formatSpanishDate(todayStr)})</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleQuickCreate(tomorrowStr, 'Mañana')}
            style={{ 
              height: '56px', 
              background: 'rgba(168, 85, 247, 0.1)', 
              color: '#fff', 
              border: '1px solid #a855f7',
              borderRadius: '10px',
              fontSize: '0.88rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontWeight: '800', color: '#c084fc' }}>📅 Ruta para MAÑANA</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.8, color: '#c084fc' }}>({formatSpanishDate(tomorrowStr)})</span>
          </button>
        </div>

        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', margin: '5px 0' }}>
          — O CONFIGURA UNA FECHA PERSONALIZADA ABAJO —
        </div>

        <form onSubmit={handleCreateRouteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div className="input-group">
            <span className="input-label">Nombre de la Ruta (Opcional)</span>
            <input 
              type="text" 
              className="form-input" 
              placeholder={`Ej: Ruta ${formatSpanishDate(newRouteDate)}`}
              value={newRouteName}
              onChange={(e) => setNewRouteName(e.target.value)}
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
              />
            </div>

            {currentUser?.role !== 'repartidor' && (
              <div className="input-group">
                <span className="input-label">Asignar Chofer / Furgoneta</span>
                <select 
                  className="form-input" 
                  value={newRouteFurgoId}
                  onChange={(e) => setNewRouteFurgoId(e.target.value)}
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



    const itemsPaqueteria = tariffs.filter(t => getNormalizedBlock(t.block) === 'paqueteria');
    const itemsGamaBlanca = tariffs.filter(t => getNormalizedBlock(t.block) === 'gama blanca');
    const itemsMuebles = tariffs.filter(t => getNormalizedBlock(t.block) === 'muebles');
    const itemsElectrodomesticosVarios = tariffs.filter(t => getNormalizedBlock(t.block) === 'electrodomesticos varios');
    const itemsOtros = tariffs.filter(t => {
      const isTvInstallation = t.id.startsWith('PM_BAS_') || t.id.startsWith('PM_COMP_') || t.id.startsWith('CUELGUE_');
      const bNorm = getNormalizedBlock(t.block);
      return bNorm === 'otros' || bNorm === 'barras de sonido' || bNorm === 'servicios' || (bNorm === 'instalaciones' && !isTvInstallation);
    });

    const activeCheckFurgo = editingTicketId ? editingFurgoId : currentUser.id;
    const isClosed = getShiftStatus(activeCheckFurgo, ticketDate) === 'closed' && !isAdminOrSuper;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => {
                  setCurrentRouteId(null);
                  setShowCreateRouteFormFields(true);
                }}
                style={{ width: 'auto', margin: 0, padding: '6px 12px', background: '#ffffff', color: '#000000', fontWeight: 'bold', border: '1px solid #ffffff' }}
              >
                ➕ Nueva Ruta / Fecha
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => {
                  if (window.confirm(`¿Seguro que quieres quitar la ruta "${activeRouteContext.name}" de tu lista activa? Esto solo limpia tu vista de planificador, pero NO cerrará el turno del chofer (podrá empezar hoy).`)) {
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
                    triggerAlert('Ruta archivada de la lista activa');
                  }
                }}
                style={{ width: 'auto', margin: 0, padding: '6px 12px', background: 'rgba(255, 255, 255, 0.05)', borderColor: 'var(--panel-border)' }}
              >
                📦 Archivar de la Vista
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => {
                  if (window.confirm(`⚠️ ¡ATENCIÓN! Al Finalizar y Cerrar Turno, se bloqueará permanentemente el registro de entregas para esta furgoneta el día ${activeRouteContext.date}.\n\n¿Estás seguro de que deseas cerrar el turno de este chofer?`)) {
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
                    triggerAlert('Turno cerrado y resumen generado con éxito');
                  }
                }}
                style={{ width: 'auto', margin: 0, padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444' }}
              >
                🏁 Finalizar y Cerrar Turno
              </button>
            </div>
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

                    {/* El mapa se mantiene en el DOM pero oculto para evitar errores de inicialización de Leaflet */}
                    <div style={{ display: 'none' }}>
                      <div 
                        id="form-mini-map" 
                        style={{ 
                          height: '0px', 
                          width: '0px'
                        }}
                      ></div>
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
                  <span className="input-label">🎨 Tipo de Servicio (Color Parada)</span>
                  <select
                    className="form-input"
                    value={serviceType}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setServiceType(newType);
                      if (newType === 'tarde') {
                        setTimeSlot('afternoon');
                      }
                    }}
                    disabled={isClosed}
                    style={{
                      borderLeft: `4px solid ${
                        serviceType === 'cuelgue' ? '#a855f7' :
                        serviceType === 'puesta_marcha' ? '#ec4899' :
                        serviceType === 'tarde' ? '#f97316' : 'var(--primary)'
                      }`
                    }}
                  >
                    <option value="entrega">📦 Entrega Estándar (Azul / Amarillo)</option>
                    <option value="cuelgue">📺 Cuelgue de TV (Violeta)</option>
                    <option value="puesta_marcha">⚙️ Puesta en Marcha (Rosa)</option>
                    <option value="tarde">🌙 Servicio de Tarde (Naranja)</option>
                  </select>
                </div>

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
        {formStep === 2 && (() => {
          const paqueteriaCount = itemsPaqueteria.reduce((sum, t) => sum + (otherQuantities[t.id] || 0), 0);
          const gamaBlancaCount = itemsGamaBlanca.reduce((sum, t) => sum + (otherQuantities[t.id] || 0), 0);
          const mueblesCount = itemsMuebles.reduce((sum, t) => sum + (otherQuantities[t.id] || 0), 0);
          const electrodomesticosCount = itemsElectrodomesticosVarios.reduce((sum, t) => sum + (otherQuantities[t.id] || 0), 0);
          
          const soundbarIds = ['BSND', 'PM_BSND', 'CUELGUE_BSND'];
          const otrosCount = itemsOtros
            .filter(item => !['URGENTE_100', 'URGENTE_120'].includes(item.id))
            .reduce((sum, t) => sum + (otherQuantities[t.id] || 0), 0);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
              
              {/* SECCIÓN A: TELEVISORES */}
              <div className="block-section" style={{ textAlign: 'left', padding: 0 }}>
                <div 
                  onClick={() => toggleSection('tv')} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '18px 20px', 
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: expandedSections.tv ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
                    borderTopLeftRadius: '11px',
                    borderTopRightRadius: '11px',
                    borderBottomLeftRadius: expandedSections.tv ? '0px' : '11px',
                    borderBottomRightRadius: expandedSections.tv ? '0px' : '11px',
                    transition: 'background 0.2s ease'
                  }}
                >
                  {/* Accordion header container */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.25rem' }}>📺</span>
                    <span style={{ fontWeight: '700', fontSize: '1.05rem', color: '#000' }}>Televisores y Servicios</span>
                    {formTvs.length > 0 && (
                      <span className="badge badge-primary" style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', background: 'var(--primary)', color: '#fff' }}>
                        {formTvs.length} {formTvs.length === 1 ? 'TV' : 'TVs'}
                      </span>
                    )}
                  </div>
                  <ChevronDown 
                    size={18} 
                    style={{ 
                      transform: expandedSections.tv ? 'rotate(180deg)' : 'rotate(0deg)', 
                      transition: 'transform 0.25s ease', 
                      color: 'var(--text-muted)' 
                    }} 
                  />
                </div>

                {expandedSections.tv && (
                  <div style={{ padding: '20px', borderTop: '1px solid var(--panel-border)', animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                      Selecciona la medida de la TV y la acción del servicio, luego haz clic en "Añadir".
                    </p>

                    {/* Selector de Pulgadas de la TV */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span className="input-label" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Medida / Pulgadas de la TV:</span>
                        {tempTvInches && (
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            Seleccionado: {tempTvInches}"
                          </span>
                        )}
                      </span>

                      {/* Botones de selección rápida (Chips) */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '5px' }}>
                        {['32', '43', '50', '55', '65', '75', '85'].map((size) => {
                          const isSelected = String(tempTvInches) === size;
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => !isClosed && setTempTvInches(size)}
                              style={{
                                padding: '8px 16px',
                                borderRadius: '20px',
                                border: isSelected ? '1px solid var(--primary)' : '1px solid var(--panel-border)',
                                background: isSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.02)',
                                color: isSelected ? '#fff' : 'var(--text-main)',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: isSelected ? '0 0 10px rgba(99, 102, 241, 0.25)' : 'none'
                              }}
                            >
                              {size}"
                            </button>
                          );
                        })}
                      </div>

                      {/* Buscador / Entrada manual de pulgadas */}
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <span style={{ position: 'absolute', left: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>🔍</span>
                          <input
                            type="number"
                            className="form-input"
                            placeholder="Escribe otra medida de pulgadas... (ej: 24, 98)"
                            value={tempTvInches || ''}
                            onChange={(e) => {
                              if (isClosed) return;
                              setTempTvInches(e.target.value);
                            }}
                            style={{ paddingLeft: '32px', width: '100%' }}
                            min="1"
                            max="200"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Selector de Marca de la TV */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
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

                    {/* Tiempo Estimado en Parada (minutos) */}
                    <div className="input-group" style={{ borderTop: '1px dashed var(--panel-border)', paddingTop: '15px', marginBottom: 0 }}>
                      <span className="input-label" style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⏱️ Tiempo Estimado en Parada
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          onClick={() => {
                            if (isClosed) return;
                            setEstimatedDuration(prev => Math.max(1, prev - 5));
                            setIsDurationManuallyEdited(true);
                          }}
                          style={{ width: '38px', height: '38px', padding: 0, fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                          disabled={isClosed}
                        >
                          -
                        </button>
                        <input 
                          type="number" 
                          className="form-input" 
                          min="1" 
                          value={estimatedDuration} 
                          onChange={(e) => { 
                            setEstimatedDuration(parseInt(e.target.value, 10) || 0); 
                            setIsDurationManuallyEdited(true); 
                          }} 
                          style={{ flex: 1, textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold', height: '38px', margin: 0 }}
                          disabled={isClosed} 
                        />
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          onClick={() => {
                            if (isClosed) return;
                            setEstimatedDuration(prev => prev + 5);
                            setIsDurationManuallyEdited(true);
                          }}
                          style={{ width: '38px', height: '38px', padding: 0, fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                          disabled={isClosed}
                        >
                          +
                        </button>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '5px 0 0 0' }}>
                        Ajusta el tiempo de parada estimado. Se sugiere automáticamente (10 min entrega, 30 min puesta en marcha, 90 min cuelgue), pero puedes cambiarlo libremente.
                      </p>
                    </div>

                    {/* SECCIÓN URGENTE */}
                    <div style={{ borderTop: '1px dashed var(--panel-border)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>⚡ Servicio Urgente Especial</div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                        Si este reparto es un servicio urgente especial que sale en cualquier momento, selecciona la tarifa correspondiente:
                      </p>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '5px' }}>
                        <button
                          type="button"
                          className={`action-pill-opt ${urgenteType === 'none' ? 'active' : ''}`}
                          onClick={() => !isClosed && setUrgenteType('none')}
                          style={{ flex: 1, height: '38px', minWidth: '100px', borderRadius: '8px', cursor: isClosed ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
                        >
                          No es Urgente
                        </button>
                        <button
                          type="button"
                          className={`action-pill-opt ${urgenteType === '100' ? 'active' : ''}`}
                          onClick={() => !isClosed && setUrgenteType('100')}
                          style={{ 
                            flex: 1, 
                            height: '38px', 
                            minWidth: '100px', 
                            borderRadius: '8px', 
                            cursor: isClosed ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem',
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
                            height: '38px', 
                            minWidth: '100px', 
                            borderRadius: '8px', 
                            cursor: isClosed ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem',
                            borderColor: urgenteType === '120' ? '#ef4444' : '', 
                            color: urgenteType === '120' ? '#fff' : '', 
                            background: urgenteType === '120' ? 'rgba(239, 68, 68, 0.2)' : '' 
                          }}
                        >
                          Urgente 120€
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECCIÓN B: PAQUETERÍA */}
              <div className="block-section" style={{ textAlign: 'left', padding: 0 }}>
                <div 
                  onClick={() => toggleSection('paqueteria')} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '18px 20px', 
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: expandedSections.paqueteria ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
                    borderTopLeftRadius: '11px',
                    borderTopRightRadius: '11px',
                    borderBottomLeftRadius: expandedSections.paqueteria ? '0px' : '11px',
                    borderBottomRightRadius: expandedSections.paqueteria ? '0px' : '11px',
                    transition: 'background 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.25rem' }}>📦</span>
                    <span style={{ fontWeight: '700', fontSize: '1.05rem', color: '#000' }}>Paquetería</span>
                    {paqueteriaCount > 0 && (
                      <span className="badge badge-success" style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', background: 'var(--success)', color: '#000' }}>
                        {paqueteriaCount} {paqueteriaCount === 1 ? 'unidad' : 'unidades'}
                      </span>
                    )}
                  </div>
                  <ChevronDown 
                    size={18} 
                    style={{ 
                      transform: expandedSections.paqueteria ? 'rotate(180deg)' : 'rotate(0deg)', 
                      transition: 'transform 0.25s ease', 
                      color: 'var(--text-muted)' 
                    }} 
                  />
                </div>

                {expandedSections.paqueteria && (
                  <div style={{ padding: '20px', borderTop: '1px solid var(--panel-border)', animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                )}
              </div>

              {/* SECCIÓN C: GAMA BLANCA */}
              {itemsGamaBlanca.length > 0 && (
                <div className="block-section" style={{ textAlign: 'left', padding: 0 }}>
                  <div 
                    onClick={() => toggleSection('gamablanca')} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '18px 20px', 
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: expandedSections.gamablanca ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
                      borderTopLeftRadius: '11px',
                      borderTopRightRadius: '11px',
                      borderBottomLeftRadius: expandedSections.gamablanca ? '0px' : '11px',
                      borderBottomRightRadius: expandedSections.gamablanca ? '0px' : '11px',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.25rem' }}>🔌</span>
                      <span style={{ fontWeight: '700', fontSize: '1.05rem', color: '#000' }}>Gama Blanca</span>
                      {gamaBlancaCount > 0 && (
                        <span className="badge badge-success" style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', background: 'var(--success)', color: '#000' }}>
                          {gamaBlancaCount} {gamaBlancaCount === 1 ? 'artículo' : 'artículos'}
                        </span>
                      )}
                    </div>
                    <ChevronDown 
                      size={18} 
                      style={{ 
                        transform: expandedSections.gamablanca ? 'rotate(180deg)' : 'rotate(0deg)', 
                        transition: 'transform 0.25s ease', 
                        color: 'var(--text-muted)' 
                      }} 
                    />
                  </div>

                  {expandedSections.gamablanca && (
                    <div style={{ padding: '20px', borderTop: '1px solid var(--panel-border)', animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {itemsGamaBlanca.map(t => (
                        <div key={t.id} className="task-item-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                          <span className="task-item-label">{t.name}</span>
                          <div className="qty-counter">
                            <button type="button" className="qty-btn" onClick={() => handleOtherQtyChange(t.id, -1)} disabled={isClosed}><Minus size={14} /></button>
                            <span className="qty-val">{otherQuantities[t.id] || 0}</span>
                            <button type="button" className="qty-btn" onClick={() => handleOtherQtyChange(t.id, 1)} disabled={isClosed}><Plus size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SECCIÓN D: MUEBLES */}
              {itemsMuebles.length > 0 && (
                <div className="block-section" style={{ textAlign: 'left', padding: 0 }}>
                  <div 
                    onClick={() => toggleSection('muebles')} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '18px 20px', 
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: expandedSections.muebles ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
                      borderTopLeftRadius: '11px',
                      borderTopRightRadius: '11px',
                      borderBottomLeftRadius: expandedSections.muebles ? '0px' : '11px',
                      borderBottomRightRadius: expandedSections.muebles ? '0px' : '11px',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.25rem' }}>🪑</span>
                      <span style={{ fontWeight: '700', fontSize: '1.05rem', color: '#000' }}>Muebles</span>
                      {mueblesCount > 0 && (
                        <span className="badge badge-success" style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', background: 'var(--success)', color: '#000' }}>
                          {mueblesCount} {mueblesCount === 1 ? 'artículo' : 'artículos'}
                        </span>
                      )}
                    </div>
                    <ChevronDown 
                      size={18} 
                      style={{ 
                        transform: expandedSections.muebles ? 'rotate(180deg)' : 'rotate(0deg)', 
                        transition: 'transform 0.25s ease', 
                        color: 'var(--text-muted)' 
                      }} 
                    />
                  </div>

                  {expandedSections.muebles && (
                    <div style={{ padding: '20px', borderTop: '1px solid var(--panel-border)', animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {itemsMuebles.map(t => (
                        <div key={t.id} className="task-item-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                          <span className="task-item-label">{t.name}</span>
                          <div className="qty-counter">
                            <button type="button" className="qty-btn" onClick={() => handleOtherQtyChange(t.id, -1)} disabled={isClosed}><Minus size={14} /></button>
                            <span className="qty-val">{otherQuantities[t.id] || 0}</span>
                            <button type="button" className="qty-btn" onClick={() => handleOtherQtyChange(t.id, 1)} disabled={isClosed}><Plus size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SECCIÓN E: ELECTRODOMÉSTICOS VARIOS */}
              {itemsElectrodomesticosVarios.length > 0 && (
                <div className="block-section" style={{ textAlign: 'left', padding: 0 }}>
                  <div 
                    onClick={() => toggleSection('electrodomesticos')} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '18px 20px', 
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: expandedSections.electrodomesticos ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
                      borderTopLeftRadius: '11px',
                      borderTopRightRadius: '11px',
                      borderBottomLeftRadius: expandedSections.electrodomesticos ? '0px' : '11px',
                      borderBottomRightRadius: expandedSections.electrodomesticos ? '0px' : '11px',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.25rem' }}>💻</span>
                      <span style={{ fontWeight: '700', fontSize: '1.05rem', color: '#000' }}>Electrodomésticos Varios</span>
                      {electrodomesticosCount > 0 && (
                        <span className="badge badge-success" style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', background: 'var(--success)', color: '#000' }}>
                          {electrodomesticosCount} {electrodomesticosCount === 1 ? 'unidad' : 'unidades'}
                        </span>
                      )}
                    </div>
                    <ChevronDown 
                      size={18} 
                      style={{ 
                        transform: expandedSections.electrodomesticos ? 'rotate(180deg)' : 'rotate(0deg)', 
                        transition: 'transform 0.25s ease', 
                        color: 'var(--text-muted)' 
                      }} 
                    />
                  </div>

                  {expandedSections.electrodomesticos && (
                    <div style={{ padding: '20px', borderTop: '1px solid var(--panel-border)', animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {itemsElectrodomesticosVarios.map(t => {
                        const qty = otherQuantities[t.id] || 0;
                        const action = otherActions[t.id] || 'entrega';
                        
                        return (
                          <div key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div className="task-item-row" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
                              <span className="task-item-label">{t.name}</span>
                              <div className="qty-counter">
                                <button type="button" className="qty-btn" onClick={() => handleOtherQtyChange(t.id, -1)} disabled={isClosed}><Minus size={14} /></button>
                                <span className="qty-val">{qty}</span>
                                <button type="button" className="qty-btn" onClick={() => handleOtherQtyChange(t.id, 1)} disabled={isClosed}><Plus size={14} /></button>
                              </div>
                            </div>
                            
                            {qty > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '8px', animation: 'fadeIn 0.2s ease' }}>
                                <span className="input-label" style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Acción:</span>
                                <div className="action-pills" style={{ margin: 0, scale: '0.9', transformOrigin: 'right center' }}>
                                  <button 
                                    type="button" 
                                    className={`action-pill-opt ${action === 'entrega' ? 'active' : ''}`}
                                    onClick={() => {
                                      if (isClosed) return;
                                      setOtherActions(prev => ({ ...prev, [t.id]: 'entrega' }));
                                    }}
                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                  >
                                    Entrega
                                  </button>
                                  <button 
                                    type="button" 
                                    className={`action-pill-opt ${action === 'recogida' ? 'active' : ''}`}
                                    onClick={() => {
                                      if (isClosed) return;
                                      setOtherActions(prev => ({ ...prev, [t.id]: 'recogida' }));
                                    }}
                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                  >
                                    Recogida
                                  </button>
                                  <button 
                                    type="button" 
                                    className={`action-pill-opt ${action === 'combinado' ? 'active' : ''}`}
                                    onClick={() => {
                                      if (isClosed) return;
                                      setOtherActions(prev => ({ ...prev, [t.id]: 'combinado' }));
                                    }}
                                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                    title="Entrega + Recogida (Cambio)"
                                  >
                                    Ent+Rec (Cambio)
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SECCIÓN E: OTROS ELEMENTOS / ACCESORIOS */}
              <div className="block-section" style={{ textAlign: 'left', padding: 0 }}>
                <div 
                  onClick={() => toggleSection('otros')} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '18px 20px', 
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: expandedSections.otros ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
                    borderTopLeftRadius: '11px',
                    borderTopRightRadius: '11px',
                    borderBottomLeftRadius: expandedSections.otros ? '0px' : '11px',
                    borderBottomRightRadius: expandedSections.otros ? '0px' : '11px',
                    transition: 'background 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.25rem' }}>🔧</span>
                    <span style={{ fontWeight: '700', fontSize: '1.05rem', color: '#000' }}>Otros Elementos / Accesorios</span>
                    {otrosCount > 0 && (
                      <span className="badge badge-success" style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', background: 'var(--success)', color: '#000' }}>
                        {otrosCount} {otrosCount === 1 ? 'unidad' : 'unidades'}
                      </span>
                    )}
                  </div>
                  <ChevronDown 
                    size={18} 
                    style={{ 
                      transform: expandedSections.otros ? 'rotate(180deg)' : 'rotate(0deg)', 
                      transition: 'transform 0.25s ease', 
                      color: 'var(--text-muted)' 
                    }} 
                  />
                </div>

                {expandedSections.otros && (
                  <div style={{ padding: '20px', borderTop: '1px solid var(--panel-border)', animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                )}
              </div>

              {/* SECCIÓN F: CONCEPTOS ADICIONALES (EXTRAS PERSONALIZADOS) */}
              <div className="block-section" style={{ textAlign: 'left', padding: 0 }}>
                <div 
                  onClick={() => toggleSection('extras')} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '18px 20px', 
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: expandedSections.extras ? 'rgba(79, 70, 229, 0.04)' : 'transparent',
                    borderTopLeftRadius: '11px',
                    borderTopRightRadius: '11px',
                    borderBottomLeftRadius: expandedSections.extras ? '0px' : '11px',
                    borderBottomRightRadius: expandedSections.extras ? '0px' : '11px',
                    transition: 'background 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.25rem' }}>➕</span>
                    <span style={{ fontWeight: '700', fontSize: '1.05rem', color: '#000' }}>Conceptos Adicionales (Extras Especiales)</span>
                    {customExtras.length > 0 && (
                      <span className="badge badge-success" style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', background: 'var(--success)', color: '#000' }}>
                        {customExtras.length} {customExtras.length === 1 ? 'extra' : 'extras'}
                      </span>
                    )}
                  </div>
                  <ChevronDown 
                    size={18} 
                    style={{ 
                      transform: expandedSections.extras ? 'rotate(180deg)' : 'rotate(0deg)', 
                      transition: 'transform 0.25s ease', 
                      color: 'var(--text-muted)' 
                    }} 
                  />
                </div>

                {expandedSections.extras && (
                  <div style={{ padding: '20px', borderTop: '1px solid var(--panel-border)', animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                      Registra servicios extras no contemplados en la tarifa estándar (ej. subida por escalera, ayudante adicional, etc.)
                    </p>
                    
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
                          <div key={extra.id} className="task-item-row" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--panel-border)', margin: 0 }}>
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
                )}
              </div>

              {/* COD Reembolso y Observaciones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', borderTop: '1px dashed var(--panel-border)', paddingTop: '15px' }}>
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

              <div className="input-group" style={{ marginTop: '5px' }}>
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
          );
        })()}
      </form>
      
      {!editingTicketId && activeRouteContext && (() => {
        const activeRouteTickets = tickets.filter(t => t && t.date === activeRouteContext.date && t.furgoId === activeRouteContext.furgoId);
        const sortedActiveRouteTickets = sortTicketsByRouteOrder(activeRouteTickets);
        const activeRouteStartTime = getRouteStartTime(activeRouteContext.furgoId, activeRouteContext.date);
        const activeTimelineSchedules = calculateTimelineSchedules(sortedActiveRouteTickets, routeStartCoords, activeRouteStartTime, routeEndCoords);
        
        if (sortedActiveRouteTickets.length === 0) return null;
        
        return (
          <div className="glass-panel" style={{ textAlign: 'left', padding: '20px', marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📋 Paradas registradas en esta ruta ({sortedActiveRouteTickets.length})
              </h3>
              <button
                type="button"
                className="btn btn-danger btn-small"
                style={{ width: 'auto', padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => {
                  const isShiftClosed = getShiftStatus(activeRouteContext.furgoId, activeRouteContext.date) === 'closed';
                  if (isShiftClosed && !isAdminOrSuper) {
                    triggerAlert('El turno para esta ruta está cerrado. No puedes vaciarla.', 'error');
                    return;
                  }
                  if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente TODAS las (${sortedActiveRouteTickets.length}) paradas de la ruta ${activeRouteContext.furgoId} para el día ${activeRouteContext.date}? Esta acción no se puede deshacer.`)) {
                    sortedActiveRouteTickets.forEach(t => deleteTicket(t.id));
                    loadData();
                    triggerAlert('Todas las paradas de la ruta han sido eliminadas');
                  }
                }}
              >
                🗑️ Vaciar Ruta
              </button>
            </div>

            {(() => {
              const lastTicket = sortedActiveRouteTickets[sortedActiveRouteTickets.length - 1];
              const finalSchedule = lastTicket ? activeTimelineSchedules[lastTicket.id] : null;
              if (!finalSchedule) return null;

              return (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(16, 185, 129, 0.05))',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '15px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)'
                }}>
                  <span>🕒 Fin estimado: <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{activeTimelineSchedules.__totals?.endTime || finalSchedule.departure}</strong></span>
                  <span>🛣️ Distancia total: <strong style={{ color: '#10b981', fontSize: '0.88rem' }}>{activeTimelineSchedules.__totals?.totalDistance || finalSchedule.cumulativeDistance} km</strong></span>
                </div>
              );
            })()}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sortedActiveRouteTickets.map((t, index) => {
                const isClosed = getShiftStatus(t.furgoId, t.date) === 'closed';
                
                return (
                  <div 
                    key={t.id} 
                    style={{ 
                      padding: '12px 15px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      gap: '12px',
                      background: 'rgba(255, 255, 255, 0.01)',
                      border: '1px solid var(--panel-border)',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <span style={{ 
                        background: 'var(--primary)', 
                        color: '#fff', 
                        fontWeight: '800', 
                        fontSize: '0.8rem', 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '50%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        #{index + 1}
                      </span>
                      
                      {(!isClosed || isAdminOrSuper) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleMoveTicketOrder(t.id, 'up')}
                            className="btn btn-secondary btn-small"
                            style={{ padding: 0, fontSize: '0.55rem', margin: 0, visibility: index === 0 ? 'hidden' : 'visible', minWidth: '18px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--panel-border)', color: '#fff' }}
                            title="Subir parada"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveTicketOrder(t.id, 'down')}
                            className="btn btn-secondary btn-small"
                            style={{ padding: 0, fontSize: '0.55rem', margin: 0, visibility: index === sortedActiveRouteTickets.length - 1 ? 'hidden' : 'visible', minWidth: '18px', height: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--panel-border)', color: '#fff' }}
                            title="Bajar parada"
                          >
                            ▼
                          </button>
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: '4px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.customerName}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.lat && t.lng ? '🟢 ' : '🔴 '}
                          {(() => {
                            const shortAddr = getShortAddressString(t.address);
                            const town = getTownAndProvinceFromPostcode(t.postcode);
                            const townSuffix = town && !shortAddr.toLowerCase().includes(town.toLowerCase()) ? ` - ${town}` : '';
                            return `${shortAddr}${t.postcode ? ` (CP ${t.postcode}${townSuffix})` : ''}`;
                          })()}
                        </span>
                        {activeTimelineSchedules[t.id] && (
                          <div style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap',
                            gap: '8px', 
                            fontSize: '0.74rem', 
                            color: 'var(--text-muted)',
                            marginTop: '2px'
                          }}>
                            <span>🏁 <strong>Fin:</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{activeTimelineSchedules[t.id].departure}</span></span>
                            <span>📈 <strong>Km acum:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{activeTimelineSchedules[t.id].cumulativeDistance} km</span></span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button 
                        type="button" 
                        onClick={() => startEditing(t)} 
                        className="btn btn-secondary btn-small" 
                        style={{ margin: 0, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', height: '28px', width: '28px' }}
                        title="Editar parada"
                      >
                        <Edit size={12} color="#fbbf24" />
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
                        style={{ margin: 0, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', height: '28px', width: '28px' }}
                        title="Eliminar parada"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {sortedActiveRouteTickets.length > 0 && activeTimelineSchedules.__totals && (() => {
                const totals = activeTimelineSchedules.__totals;
                const endAddrText = routeEndAddr || 'Punto de Llegada';
                return (
                  <div 
                    style={{ 
                      padding: '12px 15px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      gap: '12px',
                      background: 'rgba(99, 102, 241, 0.03)',
                      border: '1px dashed var(--panel-border)',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: '8px' }}>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: 'rgba(99, 102, 241, 0.2)',
                        color: '#818cf8',
                        fontWeight: '800',
                        fontSize: '0.85rem'
                      }}>
                        🏁
                      </span>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: '4px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Retorno al Punto de Llegada
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          🏁 {getShortAddressString(endAddrText)}
                        </span>
                        <div style={{ 
                          display: 'flex', 
                          flexWrap: 'wrap',
                          gap: '8px', 
                          fontSize: '0.74rem', 
                          color: 'var(--text-muted)',
                          marginTop: '2px'
                        }}>
                          <span>🏁 <strong>Llegada (Fin):</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{totals.endTime}</span></span>
                          <span>📈 <strong>Km totales:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{totals.totalDistance} km</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}
    </div>
  );
  };

  // --- RENDERIZADO DEL PORTAL DEL CHOFER (REPARTIDOR) ---
  const renderDriverPortal = () => {
    const userTickets = tickets.filter(t => t.furgoId === currentUser.id);
    const targetDate = shiftSummaryDate || new Date().toISOString().split('T')[0];
    const dateTickets = sortTicketsByRouteOrder(userTickets.filter(t => t.date === targetDate));

    const timelineSchedules = calculateTimelineSchedules(dateTickets, routeStartCoords, routeStartTime, routeEndCoords);

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
          <div className="glass-panel map-tab-panel">
            <h3 className="map-tab-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: 'var(--primary)' }}>
              🗺️ Mapa de Mi Ruta ({targetDate})
            </h3>
            <div className="map-split-container">
              <div className="map-split-left" style={{ position: 'relative' }}>
                <div 
                  id="driver-map" 
                  className="map-element"
                ></div>
                {renderMapCenterControls(false)}
                {renderMapFloatingPanel()}
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

                <div className="input-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                  <span className="input-label" style={{ margin: 0, fontWeight: '700' }}>🗺️ Navegador:</span>
                  <select 
                    className="form-input" 
                    value={defaultNavigator} 
                    onChange={(e) => {
                      setDefaultNavigator(e.target.value);
                      localStorage.setItem('delivery_default_navigator', e.target.value);
                      triggerAlert(`Navegador: ${e.target.value === 'ask' ? 'Preguntar siempre' : e.target.value === 'google' ? 'Google Maps' : 'Waze'}`);
                    }}
                    style={{ width: '150px', padding: '8px 12px', cursor: 'pointer' }}
                  >
                    <option value="ask">Preguntar siempre</option>
                    <option value="google">Google Maps</option>
                    <option value="waze">Waze</option>
                  </select>
                </div>
                
                {(() => {
                  const isClosed = getShiftStatus(currentUser.id, targetDate) === 'closed';
                  const dayTickets = tickets.filter(t => t.furgoId === currentUser.id && t.date === targetDate);
                  const currentShift = shifts.find(s => s.furgoId === currentUser.id && s.date === targetDate);
                  
                  if (isClosed) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span className="badge" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: '700' }}>🔒 Turno Cerrado</span>
                        {currentShift?.helper && (
                          <span className="badge" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)', fontWeight: '700' }}>
                            🤝 Ayudante: {currentShift.helper}
                          </span>
                        )}
                        {currentShift?.helper2 && (
                          <span className="badge" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)', fontWeight: '700' }}>
                            🤝 Ayudante 2: {currentShift.helper2}
                          </span>
                        )}
                        {currentShift?.matricula && (
                          <span className="badge" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(244, 63, 94, 0.08)', color: '#fda4af', border: '1px solid rgba(244, 63, 94, 0.25)', fontWeight: '700' }}>
                            🚐 Vehículo: {currentShift.matricula}
                          </span>
                        )}
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
                        <span className="badge" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: '700' }}>🔓 Turno Abierto</span>
                        {currentShift?.helper && (
                          <span className="badge" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)', fontWeight: '700' }}>
                            🤝 Ayudante: {currentShift.helper}
                          </span>
                        )}
                        {currentShift?.helper2 && (
                          <span className="badge" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)', fontWeight: '700' }}>
                            🤝 Ayudante 2: {currentShift.helper2}
                          </span>
                        )}
                        {currentShift?.matricula && (
                          <span className="badge" style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(244, 63, 94, 0.08)', color: '#fda4af', border: '1px solid rgba(244, 63, 94, 0.25)', fontWeight: '700' }}>
                            🚐 Vehículo: {currentShift.matricula}
                          </span>
                        )}
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
                        <button 
                          type="button" 
                          onClick={() => {
                            setShiftKmsInput('');
                            setShiftSummaryDate(targetDate);
                            setShiftSummaryFurgoId(currentUser.id);
                            setShowShiftModal(true);
                          }} 
                          className="btn btn-secondary btn-small"
                          style={{ margin: 0, padding: '8px 14px', background: '#cbd5e1', color: '#000000', border: '1px solid #94a3b8', fontWeight: '700' }}
                        >
                          📊 Ver Resumen del Día
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
                      {routeStartAddr && routeStartAddr.trim() && (
                        <button
                          type="button"
                          onClick={() => handleNavigate(routeStartAddr)}
                          style={{
                            background: 'transparent', border: 'none', color: '#10b981',
                            fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                            fontWeight: 'bold'
                          }}
                          title="Navegar a esta dirección"
                        >
                          🗺️ Navegar
                        </button>
                      )}
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
                      {routeEndAddr && routeEndAddr.trim() && (
                        <button
                          type="button"
                          onClick={() => handleNavigate(routeEndAddr)}
                          style={{
                            background: 'transparent', border: 'none', color: '#10b981',
                            fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                            fontWeight: 'bold'
                          }}
                          title="Navegar a esta dirección"
                        >
                          🗺️ Navegar
                        </button>
                      )}
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
                      <span style={{ color: 'var(--success)' }}>🟢 {successCount} Entregados | 🔴 {failedCount} Fallos</span>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })()}

              {/* Resumen Estimado de Ruta (Fin y Kilometraje) */}
              {(() => {
                if (dateTickets.length === 0) return null;
                const lastTicket = dateTickets[dateTickets.length - 1];
                const finalSchedule = lastTicket ? timelineSchedules[lastTicket.id] : null;
                if (!finalSchedule) return null;

                return (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(16, 185, 129, 0.08))',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '12px',
                    padding: '15px 20px',
                    marginBottom: '20px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '15px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
                        🏁 Hora Estimada Fin de Ruta (con retorno)
                      </span>
                      <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🕒 <span style={{ color: '#818cf8' }}>{timelineSchedules.__totals?.endTime || finalSchedule.departure}</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>
                        📈 Kilómetros Totales Estimados (con retorno)
                      </span>
                      <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🚚 <span style={{ color: '#10b981' }}>{timelineSchedules.__totals?.totalDistance || finalSchedule.cumulativeDistance} km</span>
                      </span>
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
                        
                        const cardColor = getTicketColor(t);
                        const isSuccess = t.status === 'success';
                        const isFailed = t.status === 'failed';
                        const isTransit = t.status === 'transit';
                        
                        let statusBadge = <span className="badge badge-warning" style={{ fontSize: '0.75rem', fontWeight: 'bold', background: cardColor, color: '#000' }}>🟡 Pendiente</span>;
                        if (isSuccess) {
                          statusBadge = <span className="badge badge-success" style={{ fontSize: '0.75rem', fontWeight: 'bold', background: '#10b981', color: '#fff' }}>🟢 Entregado</span>;
                        } else if (isFailed) {
                          statusBadge = <span className="badge badge-danger" style={{ fontSize: '0.75rem', fontWeight: 'bold', background: '#ef4444', color: '#fff' }}>🔴 Fallido {t.failureReason ? `(${t.failureReason})` : ''}</span>;
                        } else {
                          const sType = getTicketServiceType(t);
                          if (sType === 'cuelgue') {
                            statusBadge = <span className="badge" style={{ fontSize: '0.75rem', fontWeight: 'bold', background: '#a855f7', color: '#fff' }}>📺 Cuelgue</span>;
                          } else if (sType === 'puesta_marcha') {
                            statusBadge = <span className="badge" style={{ fontSize: '0.75rem', fontWeight: 'bold', background: '#ec4899', color: '#fff' }}>⚙️ Puesta en Marcha</span>;
                          } else if (sType === 'tarde') {
                            statusBadge = <span className="badge" style={{ fontSize: '0.75rem', fontWeight: 'bold', background: '#f97316', color: '#fff' }}>🌙 Servicio Tarde</span>;
                          } else {
                            if (isTransit) {
                              statusBadge = <span className="badge" style={{ fontSize: '0.75rem', fontWeight: 'bold', background: '#38bdf8', color: '#0f172a' }}>🔵 En Camino</span>;
                            } else {
                              statusBadge = <span className="badge badge-warning" style={{ fontSize: '0.75rem', fontWeight: 'bold', background: '#fbbf24', color: '#000' }}>🟡 Pendiente</span>;
                            }
                          }
                        }

                        if (isCollapsed) {
                          return (
                            <div 
                              key={t.id} 
                              className="driver-card" 
                              style={{
                                borderLeft: `4px solid ${cardColor}`,
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
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                                    <div className="driver-card-index" style={{ margin: 0, padding: '2px 8px', fontSize: '0.85rem', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>#{stopIndex}</div>
                                    {(!isClosed || isAdminOrSuper) && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMoveTicketOrder(t.id, 'up');
                                          }}
                                          className="btn btn-secondary btn-small"
                                          style={{ 
                                            padding: 0, 
                                            fontSize: '0.55rem', 
                                            margin: 0, 
                                            visibility: stopIndex === 1 ? 'hidden' : 'visible', 
                                            minWidth: '18px', 
                                            height: '12px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            borderRadius: '3px',
                                            background: 'rgba(255,255,255,0.08)',
                                            border: '1px solid var(--panel-border)',
                                            color: '#fff'
                                          }}
                                          title="Subir parada"
                                        >
                                          ▲
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMoveTicketOrder(t.id, 'down');
                                          }}
                                          className="btn btn-secondary btn-small"
                                          style={{ 
                                            padding: 0, 
                                            fontSize: '0.55rem', 
                                            margin: 0, 
                                            visibility: stopIndex === dateTickets.length ? 'hidden' : 'visible', 
                                            minWidth: '18px', 
                                            height: '12px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            borderRadius: '3px',
                                            background: 'rgba(255,255,255,0.08)',
                                            border: '1px solid var(--panel-border)',
                                            color: '#fff'
                                          }}
                                          title="Bajar parada"
                                        >
                                          ▼
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  {(() => {
                                    const shortAddr = getShortAddressString(t.address);
                                    const town = getTownAndProvinceFromPostcode(t.postcode);
                                    const townSuffix = town && !shortAddr.toLowerCase().includes(town.toLowerCase()) ? ` - ${town}` : '';
                                    const formattedLabel = `${shortAddr}${t.postcode ? ` - CP ${t.postcode}${townSuffix}` : ''}`;
                                    return (
                                      <div 
                                        style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }} 
                                        title={formattedLabel}
                                      >
                                        {t.lat && t.lng ? '🟢 ' : '🔴 '}
                                        {formattedLabel}
                                      </div>
                                    );
                                  })()}
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                  {statusBadge}
                                  {(!isClosed || isAdminOrSuper) && (
                                    <button 
                                      type="button" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEditing(t);
                                      }}
                                      className="btn btn-secondary btn-small" 
                                      style={{ margin: 0, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', height: '32px', width: '32px' }}
                                      title="Editar parada"
                                    >
                                      <Edit size={14} color="#fbbf24" />
                                    </button>
                                  )}
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNavigate(t.address, t.latitude, t.longitude, t.id);
                                    }}
                                    className="btn btn-secondary btn-small"
                                    style={{ display: 'inline-flex', padding: '8px', margin: 0, width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', border: '1px solid var(--primary)', alignItems: 'center', justifyContent: 'center' }}
                                    title="Iniciar GPS"
                                  >
                                    <MapPin size={14} color="var(--primary)" />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openStreetView(t.address, t.latitude, t.longitude);
                                    }}
                                    className="btn btn-secondary btn-small"
                                    style={{ display: 'inline-flex', padding: '8px', margin: 0, width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', alignItems: 'center', justifyContent: 'center' }}
                                    title="Ver Calle (Street View)"
                                  >
                                    📸
                                  </button>
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
                              borderLeft: `4px solid ${cardColor}`,
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                                  <div className="driver-card-index">#{stopIndex}</div>
                                  {(!isClosed || isAdminOrSuper) && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveTicketOrder(t.id, 'up');
                                        }}
                                        className="btn btn-secondary btn-small"
                                        style={{ 
                                          padding: 0, 
                                          fontSize: '0.55rem', 
                                          margin: 0, 
                                          visibility: stopIndex === 1 ? 'hidden' : 'visible', 
                                          minWidth: '18px', 
                                          height: '12px', 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center',
                                          borderRadius: '3px',
                                          background: 'rgba(255,255,255,0.08)',
                                          border: '1px solid var(--panel-border)',
                                          color: '#fff'
                                        }}
                                        title="Subir parada"
                                      >
                                        ▲
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveTicketOrder(t.id, 'down');
                                        }}
                                        className="btn btn-secondary btn-small"
                                        style={{ 
                                          padding: 0, 
                                          fontSize: '0.55rem', 
                                          margin: 0, 
                                          visibility: stopIndex === dateTickets.length ? 'hidden' : 'visible', 
                                          minWidth: '18px', 
                                          height: '12px', 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center',
                                          borderRadius: '3px',
                                          background: 'rgba(255,255,255,0.08)',
                                          border: '1px solid var(--panel-border)',
                                          color: '#fff'
                                        }}
                                        title="Bajar parada"
                                      >
                                        ▼
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="driver-card-title">{t.customerName}</div>
                                {t.notes && t.notes.startsWith('[Ruta Original: ') && (() => {
                                   const endIdx = t.notes.indexOf(']');
                                   const label = endIdx !== -1 ? t.notes.substring(16, endIdx) : 'Otra';
                                   return (
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
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
                                       {(!isClosed || isAdminOrSuper) && (
                                         <button
                                           type="button"
                                           onClick={() => handleReturnToOriginalRoute(t.id)}
                                           style={{
                                             fontSize: '0.7rem',
                                             padding: '3px 8px',
                                             background: 'rgba(239, 68, 68, 0.12)',
                                             border: '1px solid rgba(239, 68, 68, 0.35)',
                                             color: '#f87171',
                                             borderRadius: '4px',
                                             cursor: 'pointer',
                                             fontWeight: '700',
                                             transition: 'background 0.2s ease',
                                             display: 'inline-flex',
                                             alignItems: 'center',
                                             gap: '2px'
                                           }}
                                           title={`Devolver esta parada a la ruta original de ${label}`}
                                         >
                                           ↩️ Devolver
                                         </button>
                                       )}
                                     </div>
                                   );
                                 })()}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {statusBadge}
                                {(!isClosed || isAdminOrSuper) && (
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button 
                                      type="button" 
                                      onClick={() => startEditing(t)} 
                                      className="btn btn-secondary btn-small" 
                                      style={{ margin: 0, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', height: '32px', width: '32px' }}
                                      title="Editar parada"
                                    >
                                      <Edit size={14} color="#fbbf24" />
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
                                <span>🛣️ <strong>Distancia:</strong> {timelineSchedules[t.id].distance} km</span>
                                <span>🚗 <strong>Tránsito:</strong> {timelineSchedules[t.id].travelMins} min</span>
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
                              {(() => {
                                const parsed = parseTicketNotes(t.notes);
                                return (
                                  <>
                                    {parsed.cleanNotes && (
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
                                        📝 {parsed.cleanNotes}
                                      </div>
                                    )}
                                    {parsed.driverObservations && (
                                      <div style={{ 
                                        color: '#34d399', 
                                        padding: '6px 10px', 
                                        background: 'rgba(16, 185, 129, 0.08)', 
                                        borderRadius: '6px', 
                                        border: '1px solid rgba(16, 185, 129, 0.25)',
                                        marginTop: '4px',
                                        fontSize: '0.8rem'
                                      }}>
                                        💬 <strong>Mis Observaciones:</strong> {parsed.driverObservations}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
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
                              <div style={{ fontSize: '0.85rem', lineHeight: '1.3', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <strong>
                                  {(() => {
                                    const shortAddr = getShortAddressString(t.address);
                                    const town = getTownAndProvinceFromPostcode(t.postcode);
                                    const townSuffix = town && !shortAddr.toLowerCase().includes(town.toLowerCase()) ? ` - ${town}` : '';
                                    return `${shortAddr}${t.postcode ? ` - CP ${t.postcode}${townSuffix}` : ''}`;
                                  })()}
                                </strong>
                                {t.lat && t.lng ? (
                                  <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '700' }}>🟢 Dirección verificada en el mapa</span>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: '700' }}>🔴 Dirección sin ubicar en el mapa</span>
                                )}
                                {timelineSchedules[t.id] && (
                                  <div style={{ 
                                    display: 'flex', 
                                    flexWrap: 'wrap', 
                                    gap: '10px', 
                                    fontSize: '0.76rem', 
                                    color: 'var(--text-muted)', 
                                    marginTop: '4px',
                                    paddingTop: '4px',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                                  }}>
                                    <span>🏁 <strong>Fin parada:</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{timelineSchedules[t.id].departure}</span></span>
                                    <span>📈 <strong>Km acumulados:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{timelineSchedules[t.id].cumulativeDistance} km</span></span>
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNavigate(t.address, t.latitude, t.longitude, t.id);
                                  }}
                                  className="btn btn-secondary btn-small"
                                  style={{ display: 'inline-flex', padding: '10px', margin: 0, width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', border: '1px solid var(--primary)', alignItems: 'center', justifyContent: 'center' }}
                                  title="Iniciar GPS"
                                >
                                  <MapPin size={16} color="var(--primary)" />
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openStreetView(t.address, t.latitude, t.longitude);
                                  }}
                                  className="btn btn-secondary btn-small"
                                  style={{ display: 'inline-flex', padding: '10px', margin: 0, width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', alignItems: 'center', justifyContent: 'center' }}
                                  title="Ver Calle (Street View)"
                                >
                                  📸
                                </button>
                              </div>
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
                            {(!isClosed || isAdminOrSuper) && (
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
                                      🟢 Entregado
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

                                {(!t.status || t.status === 'pending' || t.status === 'transit') && (allowDriverSupportTransfer || isAdminOrSuper) && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', width: '100%' }}>
                                    <select
                                      className="form-input"
                                      value=""
                                      onChange={(e) => {
                                        const targetId = e.target.value;
                                        if (targetId) {
                                          handleSendSupport(t.id, targetId);
                                        }
                                      }}
                                      style={{ padding: '6px 10px', fontSize: '0.8rem', height: '34px', cursor: 'pointer', width: '100%', border: '1px solid var(--primary)', background: 'rgba(79, 70, 229, 0.05)', color: '#fff' }}
                                    >
                                      <option value="" style={{ background: 'var(--panel-bg)', color: '#fff' }}>🤝 Auxilio/Apoyo: [Seleccionar chofer...]</option>
                                      {users.filter(u => u && u.role === 'repartidor' && u.id !== t.furgoId).map(u => (
                                        <option key={u.id} value={u.id} style={{ background: 'var(--panel-bg)', color: '#fff' }}>{u.label}</option>
                                      ))}
                                    </select>
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
      </div>
    );
  };

  const handleMapControlsDragStart = (e) => {
    // Evitar scroll o comportamiento por defecto en tactil
    if (e.cancelable) {
      e.preventDefault();
    }
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const startX = clientX - mapControlsPos.left;
    const startY = clientY - mapControlsPos.top;

    const handleMove = (moveEvent) => {
      const currentX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

      let newLeft = currentX - startX;
      let newTop = currentY - startY;

      // Mantener dentro del area visible de la pantalla
      const padding = 10;
      newLeft = Math.max(padding, Math.min(window.innerWidth - 60, newLeft));
      newTop = Math.max(padding, Math.min(window.innerHeight - 200, newTop));

      const newPos = { top: newTop, left: newLeft };
      setMapControlsPos(newPos);
      localStorage.setItem('delivery_map_controls_pos', JSON.stringify(newPos));
    };

    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove, true);
      document.removeEventListener('mouseup', handleEnd, true);
      document.removeEventListener('touchmove', handleMove, true);
      document.removeEventListener('touchend', handleEnd, true);
    };

    document.addEventListener('mousemove', handleMove, true);
    document.addEventListener('mouseup', handleEnd, true);
    document.addEventListener('touchmove', handleMove, { capture: true, passive: false });
    document.addEventListener('touchend', handleEnd, true);
  };

  // --- CONTROLES DE CENTRADO DE MAPA ---
  const renderMapCenterControls = (isAdminMap) => {
    const activeFurgo = isAdminMap ? mapFilterFurgo : currentUser?.id;
    const buttonStyle = {
      background: 'var(--panel-bg)',
      border: '1px solid var(--panel-border)',
      backdropFilter: 'blur(12px)',
      color: 'var(--text-main)',
      padding: 0,
      width: '38px',
      height: '38px',
      fontSize: '1.25rem',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      margin: 0,
      transition: 'all 0.2s ease'
    };

    return (
      <div style={{ 
        position: 'absolute', 
        top: `${mapControlsPos.top}px`, 
        left: `${mapControlsPos.left}px`, 
        zIndex: 999, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px' 
      }}>
        <div 
          onMouseDown={handleMapControlsDragStart}
          onTouchStart={handleMapControlsDragStart}
          style={{ 
            ...buttonStyle, 
            cursor: 'grab', 
            fontSize: '1.05rem',
            background: 'rgba(79, 70, 229, 0.25)',
            border: '1px solid var(--primary)',
            color: 'var(--primary)',
            touchAction: 'none'
          }}
          title="Arrastra para mover los controles de posición ✥"
        >
          ✥
        </div>
        <button 
          type="button" 
          onClick={() => {
            const map = mapInstanceRef.current;
            if (!map) return;
            const targetDate = isAdminMap ? mapFilterDate : (shiftSummaryDate || new Date().toISOString().split('T')[0]);
            const dayTickets = tickets.filter(t => {
              if (!t) return false;
              if (t.date !== targetDate) return false;
              if (isAdminMap) {
                if (mapFilterFurgo !== 'all' && t.furgoId !== mapFilterFurgo) return false;
              } else {
                if (t.furgoId !== currentUser?.id) return false;
              }
              const latNum = parseFloat(t.lat);
              const lngNum = parseFloat(t.lng);
              return !isNaN(latNum) && !isNaN(lngNum);
            });
            if (dayTickets.length > 0) {
              const bounds = dayTickets.map(t => [parseFloat(t.lat), parseFloat(t.lng)]);
              map.fitBounds(bounds, { padding: [50, 50] });
            } else {
              triggerAlert('No hay paradas de ruta para centrar');
            }
          }}
          className="btn btn-secondary btn-sm"
          style={buttonStyle}
          title="Centrar mapa en la ruta completa (📍)"
        >
          📍
        </button>
        {activeFurgo && activeFurgo !== 'all' && (
          <button 
            type="button" 
            onClick={() => {
              const map = mapInstanceRef.current;
              if (!map) return;
              const liveLocations = getDriverLocations();
              if (liveLocations[activeFurgo]) {
                const loc = liveLocations[activeFurgo];
                const latNum = parseFloat(loc.lat);
                const lngNum = parseFloat(loc.lng);
                if (!isNaN(latNum) && !isNaN(lngNum)) {
                  map.setView([latNum, lngNum], 16);
                } else {
                  triggerAlert('Coordenadas del repartidor no válidas');
                }
              } else {
                triggerAlert('Sin señal GPS reciente en vivo');
              }
            }}
            className="btn btn-secondary btn-sm"
            style={buttonStyle}
            title="Centrar mapa en el repartidor (🚚)"
          >
            🚚
          </button>
        )}
        <button 
          type="button" 
          onClick={() => {
            const map = mapInstanceRef.current;
            if (!map) return;
            const currentBearing = typeof map.getBearing === 'function' ? map.getBearing() : 0;
            const newBearing = (currentBearing + 90) % 360;
            if (typeof map.setBearing === 'function') {
              map.setBearing(newBearing);
              setMapRotationState(newBearing);
            } else {
              triggerAlert('La rotación del mapa no está disponible');
            }
          }}
          className="btn btn-secondary btn-sm"
          style={buttonStyle}
          title={`Girar mapa +90° (Orientación actual: ${mapRotationState}°) 🧭`}
        >
          <span style={{ 
            display: 'inline-block', 
            transform: `rotate(${-mapRotationState}deg)`, 
            transition: 'transform 0.25s ease-out' 
          }}>
            🧭
          </span>
        </button>
      </div>
    );
  };

  // --- PANEL DE DETALLE FLOTANTE EN EL MAPA ---
  const renderMapFloatingPanel = () => {
    const handleDragStart = (e) => {
      if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input') || e.target.closest('a') || e.target.closest('.map-floating-close-btn') || e.target.closest('.map-floating-toggle-btn')) {
        return;
      }
      
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      
      dragStartRef.current = {
        startX: clientX,
        startY: clientY,
        offsetX: floatingPos.x,
        offsetY: floatingPos.y
      };

      const handleDragMove = (moveEvent) => {
        if (!dragStartRef.current) return;
        const curX = moveEvent.clientX || (moveEvent.touches && moveEvent.touches[0].clientX);
        const curY = moveEvent.clientY || (moveEvent.touches && moveEvent.touches[0].clientY);
        
        const deltaX = curX - dragStartRef.current.startX;
        const deltaY = curY - dragStartRef.current.startY;
        
        setFloatingPos({
          x: dragStartRef.current.offsetX + deltaX,
          y: dragStartRef.current.offsetY + deltaY,
          isDragged: true
        });
      };

      const handleDragEnd = () => {
        dragStartRef.current = null;
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleDragMove);
        document.removeEventListener('touchend', handleDragEnd);
      };

      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: false });
      document.addEventListener('touchend', handleDragEnd);
    };

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

    const isMobile = window.innerWidth < 768;
    const transformStyle = floatingPos.isDragged 
      ? (isMobile ? `translateX(-50%) translate(${floatingPos.x}px, ${floatingPos.y}px)` : `translate(${floatingPos.x}px, ${floatingPos.y}px)`)
      : undefined;

    return (
      <div 
        className="map-floating-details"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        style={{ 
          cursor: dragStartRef.current ? 'grabbing' : 'grab',
          transform: transformStyle,
          userSelect: 'none',
          touchAction: 'none'
        }}
      >
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
              <span className="map-floating-info-text">
                {(() => {
                  const shortAddr = getShortAddressString(ticketToShow.address);
                  const town = getTownAndProvinceFromPostcode(ticketToShow.postcode);
                  const townSuffix = town && !shortAddr.toLowerCase().includes(town.toLowerCase()) ? ` - ${town}` : '';
                  return `${shortAddr}${ticketToShow.postcode ? ` (CP ${ticketToShow.postcode}${townSuffix})` : ''}`;
                })()}
              </span>
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
            <div className="map-floating-actions-container" style={{ display: 'flex', gap: '6px', width: '100%', flexWrap: 'wrap' }}>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigate(ticketToShow.address, ticketToShow.latitude, ticketToShow.longitude, ticketToShow.id);
                }}
                className="btn btn-primary btn-small map-floating-action-btn"
                style={{ margin: 0, padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flex: 1 }}
              >
                <Navigation size={14} style={{ marginRight: '2px' }} /> Navegar
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openStreetView(ticketToShow.address, ticketToShow.latitude, ticketToShow.longitude);
                }}
                className="btn btn-secondary btn-small map-floating-action-btn"
                style={{ margin: 0, padding: '8px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flex: 1, borderColor: '#10b981', color: '#10b981', background: 'rgba(16, 185, 129, 0.05)' }}
              >
                📸 Street View
              </button>
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

            {(() => {
              const isClosed = getShiftStatus(ticketToShow.furgoId, ticketToShow.date) === 'closed';
              const canChangeStatus = activeTab === 'map' ? (isAdminOrSuper || !isClosed) : (!isClosed);
              if (!canChangeStatus) return null;

              return (
                <div className="map-floating-actions-container" style={{ marginTop: '8px' }}>
                  {(!ticketToShow.status || ticketToShow.status === 'pending' || ticketToShow.status === 'transit') ? (
                    <>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateTicketStatus(ticketToShow.id, 'success');
                        }}
                        className="btn btn-success btn-small map-floating-action-btn"
                        style={{ margin: 0, padding: '8px 12px', fontSize: '0.8rem', background: '#10b981', borderColor: '#10b981', color: '#fff', fontWeight: 'bold' }}
                      >
                        🟢 Entregado
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickFailTicketId(ticketToShow.id);
                        }}
                        className="btn btn-danger btn-small map-floating-action-btn"
                        style={{ margin: 0, padding: '8px 12px', fontSize: '0.8rem', background: '#ef4444', borderColor: '#ef4444', color: '#fff', fontWeight: 'bold' }}
                      >
                        🔴 Fallido
                      </button>
                    </>
                  ) : (
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateTicketStatus(ticketToShow.id, 'pending');
                      }}
                      className="btn btn-secondary btn-small map-floating-action-btn"
                      style={{ margin: 0, padding: '8px 12px', fontSize: '0.8rem' }}
                    >
                      🔄 Reabrir / Pendiente
                    </button>
                  )}
                </div>
              );
            })()}
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

    const activeFurgo = isAdminMap ? mapFilterFurgo : currentUser?.id;
    const startTime = getRouteStartTime(activeFurgo, targetDate);
    const timelineSchedules = calculateTimelineSchedules(sortedDayTickets, routeStartCoords, startTime, routeEndCoords);

    const lastTicket = sortedDayTickets[sortedDayTickets.length - 1];
    const finalSchedule = lastTicket ? timelineSchedules[lastTicket.id] : null;

    let totalDistance = 0;
    let totalTransit = 0;
    let isOsrmStats = false;
    
    if (activeFurgo && activeFurgo !== 'all' && routeStats[activeFurgo]) {
      const stats = routeStats[activeFurgo];
      totalDistance = stats.distance / 1000; // a km
      totalTransit = Math.round(stats.duration / 60); // a minutos
      isOsrmStats = true;
    } else if (activeFurgo !== 'all') {
      if (timelineSchedules.__totals) {
        totalDistance = parseFloat(timelineSchedules.__totals.totalDistance) || 0;
        let sumTransit = 0;
        Object.keys(timelineSchedules).forEach(key => {
          if (key !== '__totals') {
            sumTransit += timelineSchedules[key].travelMins || 0;
          }
        });
        totalTransit = sumTransit + (timelineSchedules.__totals.returnTravelMins || 0);
      } else {
        Object.values(timelineSchedules).forEach(s => {
          totalDistance += parseFloat(s.distance) || 0;
          totalTransit += s.travelMins || 0;
        });
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px', margin: '0 0 5px 0' }}>
          <span>📋 Secuencia de Paradas ({sortedDayTickets.length})</span>
          {activeFurgo !== 'all' && sortedDayTickets.length > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>
              {isOsrmStats ? '🛣️ OSRM: ' : '🛣️ '} {totalDistance.toFixed(1)} km | 🚗 {totalTransit} min viaje
            </span>
          )}
        </h3>

        {activeFurgo !== 'all' && finalSchedule && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(16, 185, 129, 0.05))',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.8rem',
            color: 'var(--text-muted)'
          }}>
            <span>🕒 Fin estimado: <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{timelineSchedules.__totals?.endTime || finalSchedule.departure}</strong></span>
            <span>🛣️ Distancia total: <strong style={{ color: '#10b981', fontSize: '0.88rem' }}>{timelineSchedules.__totals?.totalDistance || finalSchedule.cumulativeDistance} km</strong></span>
          </div>
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sortedDayTickets.map((t, index) => {
            const isSuccess = t.status === 'success';
            const isFailed = t.status === 'failed';
            const isTransit = t.status === 'transit';
            
            const statusColor = getTicketColor(t);
            
            let statusLabel = 'Pendiente';
            if (isSuccess) {
              statusLabel = 'Entregado';
            } else if (isFailed) {
              statusLabel = 'Fallido';
            } else {
              const sType = getTicketServiceType(t);
              if (sType === 'cuelgue') {
                statusLabel = 'Cuelgue';
              } else if (sType === 'puesta_marcha') {
                statusLabel = 'Puesta en Marcha';
              } else if (sType === 'tarde') {
                statusLabel = 'Servicio Tarde';
              } else {
                statusLabel = isTransit ? 'En Camino' : 'Pendiente';
              }
            }
            
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
                    <strong style={{ fontSize: '0.95rem', color: '#000' }}>{t.customerName || 'Cliente sin nombre'}</strong>
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
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>
                        {(() => {
                          const shortAddr = getShortAddressString(t.address);
                          const town = getTownAndProvinceFromPostcode(t.postcode);
                          const townSuffix = town && !shortAddr.toLowerCase().includes(town.toLowerCase()) ? ` - ${town}` : '';
                          return `${shortAddr}${t.postcode ? ` (CP ${t.postcode}${townSuffix})` : ''}`;
                        })() /* dynamic postcode mapping */ }
                      </span>
                      {activeFurgo !== 'all' && timelineSchedules[t.id] && (
                        <div style={{ 
                          display: 'flex', 
                          flexWrap: 'wrap',
                          gap: '8px', 
                          fontSize: '0.74rem', 
                          color: 'var(--text-muted)',
                          marginTop: '3px'
                        }}>
                          <span>🏁 <strong>Fin:</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{timelineSchedules[t.id].departure}</span></span>
                          <span>📈 <strong>Km acum:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{timelineSchedules[t.id].cumulativeDistance} km</span></span>
                        </div>
                      )}
                    </div>
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

                {/* Cronograma Estimado */}
                {activeFurgo !== 'all' && timelineSchedules[t.id] && (
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
                    marginTop: '8px',
                    marginBottom: '4px',
                    alignItems: 'center'
                  }}>
                    <span>🕒 <strong>Llegada:</strong> {timelineSchedules[t.id].arrival}</span>
                    <span>⌛ <strong>Parada:</strong> {timelineSchedules[t.id].duration} min</span>
                    <span>🛫 <strong>Salida:</strong> {timelineSchedules[t.id].departure}</span>
                    <span>🛣️ <strong>Distancia:</strong> {timelineSchedules[t.id].distance} km</span>
                    <span>🚗 <strong>Tránsito:</strong> {timelineSchedules[t.id].travelMins} min</span>
                  </div>
                )}

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
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigate(t.address, t.latitude, t.longitude, t.id);
                        }}
                        className="btn btn-primary btn-small"
                        style={{ margin: 0, padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flex: 1, height: 'auto' }}
                      >
                        🧭 Navegar
                      </button>
                      
                      {(() => {
                        const isClosed = getShiftStatus(t.furgoId, t.date) === 'closed';
                        return (isAdminMap || (!isClosed || isAdminOrSuper)) ? (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(t);
                            }}
                            className="btn btn-secondary btn-small"
                            style={{ margin: 0, padding: '6px 10px', fontSize: '0.75rem', flex: 1, height: 'auto' }}
                          >
                            ✏️ Editar
                          </button>
                        ) : null;
                      })()}
                    </div>

                    {(() => {
                      const isClosed = getShiftStatus(t.furgoId, t.date) === 'closed';
                      const canChangeStatus = isAdminMap || (!isClosed || isAdminOrSuper);
                      if (!canChangeStatus) return null;

                      return (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          {(!t.status || t.status === 'pending' || t.status === 'transit') ? (
                            <>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateTicketStatus(t.id, 'success');
                                }}
                                className="btn btn-success btn-small"
                                style={{ margin: 0, padding: '6px 10px', fontSize: '0.75rem', flex: 1, height: 'auto', background: '#10b981', borderColor: '#10b981', color: '#fff', fontWeight: 'bold' }}
                              >
                                🟢 Entregado
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQuickFailTicketId(t.id);
                                }}
                                className="btn btn-danger btn-small"
                                style={{ margin: 0, padding: '6px 10px', fontSize: '0.75rem', flex: 1, height: 'auto', background: '#ef4444', borderColor: '#ef4444', color: '#fff', fontWeight: 'bold' }}
                              >
                                🔴 Fallido
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateTicketStatus(t.id, 'pending');
                              }}
                              className="btn btn-secondary btn-small"
                              style={{ margin: 0, padding: '6px 10px', fontSize: '0.75rem', flex: 1, height: 'auto' }}
                            >
                              🔄 Reabrir / Pendiente
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
          
          {activeFurgo !== 'all' && sortedDayTickets.length > 0 && timelineSchedules.__totals && (() => {
            const totals = timelineSchedules.__totals;
            const endAddrText = isAdminMap ? (getRouteEndAddr(activeFurgo) || 'Punto de Llegada') : (routeEndAddr || 'Punto de Llegada');
            return (
              <div 
                className="glass-panel"
                style={{
                  padding: '15px',
                  border: '1px dashed var(--panel-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: 'rgba(99, 102, 241, 0.03)',
                  textAlign: 'left',
                  borderRadius: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: 'rgba(99, 102, 241, 0.2)',
                      color: '#818cf8',
                      fontWeight: '800',
                      fontSize: '0.85rem'
                    }}>
                      🏁
                    </span>
                    <strong style={{ fontSize: '0.95rem', color: '#fff' }}>Retorno al Punto de Llegada</strong>
                  </div>
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: 'var(--success)',
                    fontWeight: '800'
                  }}>
                    Final
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ flexShrink: 0 }}>📍</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{getShortAddressString(endAddrText)}</span>
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap',
                        gap: '8px', 
                        fontSize: '0.74rem', 
                        color: 'var(--text-muted)',
                        marginTop: '3px'
                      }}>
                        <span>🛣️ <strong>Retorno:</strong> <span style={{ color: '#818cf8', fontWeight: 'bold' }}>+{totals.returnDistance} km</span></span>
                        <span>📈 <strong>Km totales:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{totals.totalDistance} km</span></span>
                      </div>
                    </div>
                  </div>
                </div>

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
                  marginTop: '4px',
                  alignItems: 'center'
                }}>
                  <span>🕒 <strong>Llegada estimada (Fin de Ruta):</strong> <strong style={{ color: '#fff' }}>{totals.endTime}</strong></span>
                  <span>🚗 <strong>Tiempo de viaje de retorno:</strong> {totals.returnTravelMins} min</span>
                </div>
              </div>
            );
          })()}
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

          // Preparar tickets con información expandida para la búsqueda
          const processedTickets = searchTickets.map(t => {
            const driver = users.find(u => u.id === t.furgoId);
            const driverLabel = driver ? driver.label : t.furgoId;
            const taskNames = (t.tasks || []).map(task => {
              const tariff = tariffs.find(tar => tar.id === task.tariffId);
              return task.name || (tariff ? tariff.name : task.tariffId);
            }).join(' ');
            
            return {
              ...t,
              driverLabel,
              taskNames
            };
          });

          // Inicializar Fuse.js para búsqueda difusa (fuzzy search) inteligente
          const fuse = new Fuse(processedTickets, {
            keys: [
              { name: 'customerName', weight: 0.4 },
              { name: 'address', weight: 0.25 },
              { name: 'phone', weight: 0.15 },
              { name: 'notes', weight: 0.1 },
              { name: 'driverLabel', weight: 0.05 },
              { name: 'taskNames', weight: 0.05 }
            ],
            threshold: 0.35, // 0.35 permite errores tipográficos leves pero mantiene alta precisión
            ignoreLocation: true,
          });

          const searchResults = fuse.search(query);
          const matches = searchResults.map(res => res.item);

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
                      statusBadge = <span className="badge badge-success" style={{ background: '#10b981', color: '#fff' }}>🟢 Entregado</span>;
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
                          <div style={{ fontWeight: '600', color: '#000' }}>{ticket.customerName}</div>
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
                              CP {ticket.postcode}{getTownAndProvinceFromPostcode(ticket.postcode) ? ` - ${getTownAndProvinceFromPostcode(ticket.postcode)}` : ''}
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
                          {(() => {
                            const parsed = parseTicketNotes(ticket.notes);
                            return (
                              <>
                                {parsed.cleanNotes && (
                                  <div style={{ 
                                    fontSize: '0.78rem', 
                                    color: 'var(--text-muted)', 
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid var(--panel-border)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    marginTop: '6px'
                                  }}>
                                    📝 {parsed.cleanNotes}
                                  </div>
                                )}
                                {parsed.driverObservations && (
                                  <div style={{ 
                                    fontSize: '0.78rem', 
                                    color: '#34d399', 
                                    background: 'rgba(16, 185, 129, 0.08)',
                                    border: '1px solid rgba(16, 185, 129, 0.25)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    marginTop: '6px'
                                  }}>
                                    💬 <strong>Observaciones Chofer:</strong> {parsed.driverObservations}
                                  </div>
                                )}
                                {ticket.failureReason && (
                                  <div style={{ 
                                    fontSize: '0.78rem', 
                                    color: '#f87171', 
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    marginTop: '6px'
                                  }}>
                                    ⚠️ <strong>Motivo de Fallo:</strong> {ticket.failureReason}
                                  </div>
                                )}
                              </>
                            );
                          })()}
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

  const renderChangelog = () => {
    const query = changelogSearch.trim().toLowerCase();
    const filteredChangelog = changelogData.filter(item => {
      if (!query) return true;
      return (
        item.version.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.changes.some(change => change.toLowerCase().includes(query))
      );
    });

    return (
      <div className="glass-panel" style={{ textAlign: 'left' }}>
        <h2>🚀 Novedades y Actualizaciones</h2>
        <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
          Mantente al día con las últimas mejoras, correcciones de errores y nuevas funcionalidades introducidas en la plataforma.
        </p>

        {/* Input de Búsqueda */}
        <div style={{ marginBottom: '25px', position: 'relative' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Buscar actualizaciones por versión, título, componente o descripción..."
            value={changelogSearch}
            onChange={(e) => setChangelogSearch(e.target.value)}
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

        {/* Lista de Versiones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {filteredChangelog.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontSize: '0.95rem' }}>No se encontraron actualizaciones que coincidan con la búsqueda.</p>
            </div>
          ) : (
            filteredChangelog.map((item) => {
              // Estilo del badge según la categoría
              let categoryBg = 'rgba(79, 70, 229, 0.1)';
              let categoryColor = 'var(--primary)';
              let categoryBorder = '1px solid rgba(79, 70, 229, 0.2)';
              
              if (item.category.includes('Fix')) {
                categoryBg = 'rgba(239, 68, 68, 0.1)';
                categoryColor = 'var(--danger)';
                categoryBorder = '1px solid rgba(239, 68, 68, 0.2)';
              } else if (item.category.includes('UI') || item.category.includes('Doc')) {
                categoryBg = 'rgba(16, 185, 129, 0.1)';
                categoryColor = 'var(--success)';
                categoryBorder = '1px solid rgba(16, 185, 129, 0.2)';
              } else if (item.category.includes('GPS') || item.category.includes('Usabilidad')) {
                categoryBg = 'rgba(245, 158, 11, 0.1)';
                categoryColor = '#f59e0b';
                categoryBorder = '1px solid rgba(245, 158, 11, 0.2)';
              }

              return (
                <div 
                  key={item.id} 
                  style={{ 
                    border: '1px solid var(--panel-border)', 
                    borderRadius: '12px', 
                    padding: '20px',
                    background: 'rgba(255, 255, 255, 0.01)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)' }}>v{item.version}</span>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '2px 8px', 
                          borderRadius: '6px', 
                          fontWeight: '600',
                          background: categoryBg,
                          color: categoryColor,
                          border: categoryBorder
                        }}>
                          {item.category}
                        </span>
                      </div>
                      <h3 style={{ margin: '6px 0 0 0', fontSize: '1.05rem', fontWeight: '700', color: '#fff' }}>{item.title}</h3>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div>📅 {item.date}</div>
                      <div style={{ marginTop: '2px' }}>👤 {item.developer}</div>
                    </div>
                  </div>
                  
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    {item.changes.map((change, idx) => (
                      <li key={idx} style={{ marginBottom: '6px' }}>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // --- PORTAL DE GESTIÓN DE PERSONAL Y EMPLEADOS ---
  const renderEmployeesPortal = () => {
    // Filter employees based on search & filter state
    const filteredEmployees = employeesList.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(empSearchQuery.toLowerCase());
      
      const matchesRole = empFilterRole === 'all' || 
        (empFilterRole === 'chofer' && (emp.role === 'chofer' || emp.role === 'ambos')) ||
        (empFilterRole === 'ayudante' && (emp.role === 'ayudante' || emp.role === 'ambos'));
      
      const matchesStatus = empFilterStatus === 'all' ||
        (empFilterStatus === 'active' && emp.active !== false) ||
        (empFilterStatus === 'inactive' && emp.active === false);
        
      return matchesSearch && matchesRole && matchesStatus;
    });

    const handleStartEdit = (emp) => {
      setEditingEmployeeId(emp.id);
      setEditEmpName(emp.name);
      setEditEmpRole(emp.role || 'chofer');
      setEditEmpRate(emp.dailyRate || '');
    };

    const handleSaveEdit = (id) => {
      if (!editEmpName.trim()) {
        triggerAlert('El nombre no puede estar vacío', 'error');
        return;
      }
      const rate = parseFloat(editEmpRate) || 0;
      const updated = employeesList.map(e => {
        if (e.id === id) {
          return { ...e, name: editEmpName.trim(), role: editEmpRole, dailyRate: rate };
        }
        return e;
      });
      setEmployeesList(updated);
      saveEmployeesList(updated);
      setEditingEmployeeId(null);
      triggerAlert('Datos de empleado actualizados');
      loadData();
    };

    const handleToggleActive = (emp) => {
      const newStatus = emp.active === false ? true : false;
      const confirmMsg = newStatus 
        ? `¿Estás seguro de que deseas dar de alta nuevamente a ${emp.name}?`
        : `¿Estás seguro de que deseas dar de baja a ${emp.name}? No aparecerá en las planificaciones futuras, pero se conservará su historial de nóminas.`;
      
      if (window.confirm(confirmMsg)) {
        const updated = employeesList.map(e => {
          if (e.id === emp.id) {
            return { ...e, active: newStatus };
          }
          return e;
        });
        setEmployeesList(updated);
        saveEmployeesList(updated);
        triggerAlert(newStatus ? `${emp.name} está de alta` : `${emp.name} ha sido dado de baja`);
        loadData();
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
        
        {/* Header Block */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--panel-border)',
          borderRadius: '12px',
          padding: '16px 20px',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              👥 Directorio de Personal y Empleados
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Administra de forma independiente choferes y ayudantes, edita sus perfiles, ajusta tarifas y gestiona altas/bajas.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '20px', alignItems: 'start' }}>
          
          {/* Left Column: Form to Add Employee */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--panel-border)' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--primary)', borderBottom: '1px solid var(--panel-border)', paddingBottom: '10px' }}>
              ➕ Registrar Empleado
            </h3>
            
            <div className="input-group" style={{ marginBottom: 0 }}>
              <span className="input-label">Nombre Completo</span>
              <input 
                type="text" 
                className="form-input" 
                value={newEmployeeName}
                onChange={(e) => setNewEmployeeName(e.target.value)}
                placeholder="Ej: Pedro Martínez..."
                style={{ margin: 0 }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <span className="input-label">Rol Predeterminado</span>
              <select
                className="form-input"
                value={newEmployeeRole}
                onChange={(e) => setNewEmployeeRole(e.target.value)}
                style={{ margin: 0 }}
              >
                <option value="chofer">Chofer</option>
                <option value="ayudante">Ayudante</option>
                <option value="ambos">Chofer y Ayudante</option>
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <span className="input-label">Tarifa Diaria (€)</span>
              <input 
                type="number" 
                className="form-input" 
                value={newEmployeeRate}
                onChange={(e) => setNewEmployeeRate(e.target.value)}
                placeholder="Ej: 80"
                style={{ margin: 0 }}
              />
            </div>

            <button 
              type="button" 
              onClick={handleAddEmployee}
              className="btn btn-primary"
              style={{ width: '100%', margin: 0 }}
            >
              Registrar Empleado
            </button>
          </div>

          {/* Right Column: Search, Filter, and Employees List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* Search & Filter Bar */}
            <div className="glass-panel" style={{ padding: '15px 20px', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--panel-border)' }}>
              
              <div style={{ flex: 1, minWidth: '200px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  value={empSearchQuery}
                  onChange={(e) => setEmpSearchQuery(e.target.value)}
                  placeholder="🔍 Buscar empleado por nombre..."
                  style={{ margin: 0 }}
                />
              </div>

              {/* Role filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rol:</span>
                <select
                  className="form-input"
                  value={empFilterRole}
                  onChange={(e) => setEmpFilterRole(e.target.value)}
                  style={{ width: '140px', margin: 0, padding: '4px 8px', fontSize: '0.82rem', height: '32px' }}
                >
                  <option value="all">Todos</option>
                  <option value="chofer">Choferes</option>
                  <option value="ayudante">Ayudantes</option>
                </select>
              </div>

              {/* Status filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estado:</span>
                <select
                  className="form-input"
                  value={empFilterStatus}
                  onChange={(e) => setEmpFilterStatus(e.target.value)}
                  style={{ width: '140px', margin: 0, padding: '4px 8px', fontSize: '0.82rem', height: '32px' }}
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">De Baja</option>
                </select>
              </div>
            </div>

            {/* Employee Directory List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredEmployees.length === 0 ? (
                <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--panel-border)', borderRadius: '12px' }}>
                  No se encontraron empleados que coincidan con la búsqueda.
                </div>
              ) : (
                filteredEmployees.map(emp => {
                  const isEditing = editingEmployeeId === emp.id;
                  
                  return (
                    <div 
                      key={emp.id}
                      style={{
                        background: emp.active === false ? 'rgba(239, 68, 68, 0.02)' : 'rgba(255, 255, 255, 0.01)',
                        border: emp.active === false ? '1px dashed rgba(239, 68, 68, 0.2)' : '1px solid var(--panel-border)',
                        borderRadius: '12px',
                        padding: '16px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '15px',
                        transition: 'all 0.2s ease',
                        opacity: emp.active === false ? 0.7 : 1
                      }}
                    >
                      {isEditing ? (
                        /* Editing Layout */
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', flex: 1 }}>
                          <div style={{ flex: 2, minWidth: '180px' }}>
                            <span className="input-label" style={{ fontSize: '0.72rem' }}>Nombre Completo</span>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={editEmpName}
                              onChange={(e) => setEditEmpName(e.target.value)}
                              style={{ margin: 0 }}
                            />
                          </div>

                          <div style={{ flex: 1, minWidth: '120px' }}>
                            <span className="input-label" style={{ fontSize: '0.72rem' }}>Rol</span>
                            <select
                              className="form-input"
                              value={editEmpRole}
                              onChange={(e) => setEditEmpRole(e.target.value)}
                              style={{ margin: 0 }}
                            >
                              <option value="chofer">Chofer</option>
                              <option value="ayudante">Ayudante</option>
                              <option value="ambos">Chofer y Ayudante</option>
                            </select>
                          </div>

                          <div style={{ flex: 1, minWidth: '100px' }}>
                            <span className="input-label" style={{ fontSize: '0.72rem' }}>Tarifa Diaria (€)</span>
                            <input 
                              type="number" 
                              className="form-input" 
                              value={editEmpRate}
                              onChange={(e) => setEditEmpRate(e.target.value)}
                              style={{ margin: 0 }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
                            <button 
                              type="button" 
                              onClick={() => handleSaveEdit(emp.id)}
                              className="btn btn-primary"
                              style={{ margin: 0, padding: '8px 16px', fontSize: '0.82rem' }}
                            >
                              💾 Guardar
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setEditingEmployeeId(null)}
                              className="btn btn-secondary"
                              style={{ margin: 0, padding: '8px 16px', fontSize: '0.82rem' }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Standard Layout */
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: emp.role === 'chofer' ? 'rgba(99, 102, 241, 0.1)' : emp.role === 'ayudante' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.2rem'
                            }}>
                              {emp.role === 'chofer' ? '🚚' : emp.role === 'ayudante' ? '🤝' : '🔄'}
                            </div>

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong style={{ fontSize: '1.05rem', color: emp.active === false ? 'var(--text-muted)' : '#fff' }}>{emp.name}</strong>
                                <span style={{ 
                                  fontSize: '0.68rem', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px',
                                  background: emp.role === 'chofer' ? 'rgba(99, 102, 241, 0.15)' : emp.role === 'ayudante' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                  color: emp.role === 'chofer' ? 'var(--primary)' : emp.role === 'ayudante' ? '#34d399' : '#fbbf24',
                                  fontWeight: '700'
                                }}>
                                  {emp.role === 'chofer' ? 'Chofer' : emp.role === 'ayudante' ? 'Ayudante' : 'Chofer/Ayudante'}
                                </span>

                                <span style={{
                                  fontSize: '0.68rem',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: emp.active === false ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                  color: emp.active === false ? '#f87171' : '#34d399',
                                  fontWeight: '700'
                                }}>
                                  {emp.active === false ? 'De Baja' : 'Activo'}
                                </span>
                              </div>
                              
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Tarifa Diaria: <strong style={{ color: 'var(--primary)' }}>{emp.dailyRate} €</strong>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              type="button" 
                              onClick={() => handleStartEdit(emp)}
                              className="btn btn-secondary btn-small"
                              style={{ margin: 0, padding: '6px 12px', fontSize: '0.78rem' }}
                            >
                              ✏️ Editar
                            </button>

                            <button 
                              type="button" 
                              onClick={() => handleToggleActive(emp)}
                              className="btn btn-secondary btn-small"
                              style={{ 
                                margin: 0, 
                                padding: '6px 12px', 
                                fontSize: '0.78rem',
                                color: emp.active === false ? '#34d399' : '#f87171',
                                border: emp.active === false ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                                background: 'transparent'
                              }}
                            >
                              {emp.active === false ? '🟢 Dar de Alta' : '🔴 Dar de Baja'}
                            </button>

                            <button 
                              type="button" 
                              onClick={() => handleRemoveEmployee(emp.id, emp.name)}
                              className="btn btn-danger btn-small"
                              style={{ margin: 0, padding: '6px 12px', fontSize: '0.78rem' }}
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    );
  };

  // --- RENDERIZADO DEL CALENDARIO DE TURNOS ---
  const renderShiftCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const getMonday = (d) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(date.setDate(diff));
    };

    // Calculate start and end of week for title/renders
    const weekStart = getMonday(calendarDate);
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      weekDays.push(d);
    }
    const weekEnd = weekDays[6];

    // Navigation Handlers based on Active View Mode
    const prevTime = () => {
      const d = new Date(calendarDate);
      if (calendarViewMode === 'month') {
        d.setMonth(d.getMonth() - 1);
      } else if (calendarViewMode === 'week') {
        d.setDate(d.getDate() - 7);
      } else {
        d.setDate(d.getDate() - 1);
      }
      setCalendarDate(d);
    };

    const nextTime = () => {
      const d = new Date(calendarDate);
      if (calendarViewMode === 'month') {
        d.setMonth(d.getMonth() + 1);
      } else if (calendarViewMode === 'week') {
        d.setDate(d.getDate() + 7);
      } else {
        d.setDate(d.getDate() + 1);
      }
      setCalendarDate(d);
    };

    const goToToday = () => {
      setCalendarDate(new Date());
    };

    const formatDateShort = (d) => {
      return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const getFormattedDateStr = (dateObj) => {
      return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    };

    // Format header title based on active view mode
    let headerTitle = '';
    if (calendarViewMode === 'month') {
      headerTitle = `${monthNames[month]} ${year}`;
    } else if (calendarViewMode === 'week') {
      headerTitle = `Semana del ${formatDateShort(weekStart)}/${weekStart.getFullYear()} al ${formatDateShort(weekEnd)}/${weekEnd.getFullYear()}`;
    } else {
      const weekdayName = calendarDate.toLocaleDateString('es-ES', { weekday: 'long' });
      const capitalized = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);
      headerTitle = `${capitalized}, ${calendarDate.getDate()} de ${monthNames[month]} de ${year}`;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
        
        {/* Navigation & View Selection Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--panel-border)',
          borderRadius: '12px',
          padding: '16px 20px',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              📅 Calendario de Turnos y Personal
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Planifica turnos para días futuros y gestiona los equipos diarios (Chofer y Ayudante).
            </p>
          </div>

          {/* View Mode Selector */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '3px' }}>
            <button 
              type="button" 
              onClick={() => setCalendarViewMode('month')} 
              className={`btn btn-small ${calendarViewMode === 'month' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ margin: 0, padding: '6px 12px', fontSize: '0.78rem', borderRadius: '6px', border: 'none', background: calendarViewMode === 'month' ? '' : 'transparent' }}
            >
              Mes
            </button>
            <button 
              type="button" 
              onClick={() => setCalendarViewMode('week')} 
              className={`btn btn-small ${calendarViewMode === 'week' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ margin: 0, padding: '6px 12px', fontSize: '0.78rem', borderRadius: '6px', border: 'none', background: calendarViewMode === 'week' ? '' : 'transparent' }}
            >
              Semana
            </button>
            <button 
              type="button" 
              onClick={() => setCalendarViewMode('day')} 
              className={`btn btn-small ${calendarViewMode === 'day' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ margin: 0, padding: '6px 12px', fontSize: '0.78rem', borderRadius: '6px', border: 'none', background: calendarViewMode === 'day' ? '' : 'transparent' }}
            >
              Día
            </button>
            <button 
              type="button" 
              onClick={() => setCalendarViewMode('payroll')} 
              className={`btn btn-small ${calendarViewMode === 'payroll' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ margin: 0, padding: '6px 12px', fontSize: '0.78rem', borderRadius: '6px', border: 'none', background: calendarViewMode === 'payroll' ? '' : 'transparent' }}
            >
              💰 Nóminas y Fichas
            </button>
          </div>
          
          {/* Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="button" className="btn btn-secondary btn-small" onClick={prevTime} style={{ padding: '8px 12px' }}>◀</button>
            <span style={{ fontSize: '1.05rem', fontWeight: '700', minWidth: '180px', textAlign: 'center', color: 'var(--text-main)' }}>
              {headerTitle}
            </span>
            <button type="button" className="btn btn-secondary btn-small" onClick={nextTime} style={{ padding: '8px 12px' }}>▶</button>
            <button type="button" className="btn btn-primary btn-small" onClick={goToToday} style={{ padding: '8px 12px' }}>Hoy</button>
          </div>
        </div>

        {/* -------------------- 1. MONTH VIEW -------------------- */}
        {calendarViewMode === 'month' && (() => {
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const firstDayIndex = new Date(year, month, 1).getDay();
          const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

          const calendarCells = [];
          for (let i = 0; i < adjustedFirstDay; i++) {
            calendarCells.push(null);
          }
          for (let d = 1; d <= daysInMonth; d++) {
            calendarCells.push(d);
          }

          const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

          const getCellDateStr = (dayNum) => {
            if (!dayNum) return '';
            return `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          };

          return (
            <div style={{
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid var(--panel-border)',
              borderRadius: '12px',
              overflowX: 'auto'
            }}>
              <div style={{ minWidth: '720px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderBottom: '1px solid var(--panel-border)',
                  textAlign: 'center',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)'
                }}>
                  {weekdays.map(wd => (
                    <div key={wd} style={{ padding: '12px 6px' }}>{wd}</div>
                  ))}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gridAutoRows: 'minmax(120px, auto)'
                }}>
                  {calendarCells.map((dayNum, idx) => {
                    const cellDateStr = getCellDateStr(dayNum);
                    const cellShifts = cellDateStr ? shifts.filter(s => s.date === cellDateStr && ((s.customDriver && s.customDriver.trim()) || (s.helper && s.helper.trim()))) : [];
                    const isToday = cellDateStr === new Date().toISOString().split('T')[0];

                    return (
                      <div 
                        key={idx} 
                        onClick={() => {
                          if (dayNum) {
                            setSelectedCalendarDay(cellDateStr);
                            setPlannedFurgoId('');
                            setPlannedHelper('');
                            setPlannedMatricula('');
                            setPlannedShiftModalOpen(true);
                          }
                        }}
                        style={{
                          padding: '8px',
                          borderRight: (idx % 7 === 6) ? 'none' : '1px solid var(--panel-border)',
                          borderBottom: '1px solid var(--panel-border)',
                          background: !dayNum ? 'transparent' : isToday ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                          cursor: dayNum ? 'pointer' : 'default',
                          transition: 'background 0.2s ease',
                          position: 'relative',
                          minHeight: '120px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                        className={dayNum ? 'calendar-day-cell' : ''}
                        onMouseEnter={(e) => {
                          if (dayNum) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                        }}
                        onMouseLeave={(e) => {
                          if (dayNum) e.currentTarget.style.background = isToday ? 'rgba(99, 102, 241, 0.05)' : 'transparent';
                        }}
                      >
                        {dayNum && (
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            marginBottom: '6px' 
                          }}>
                            <span style={{ 
                              fontSize: '0.9rem', 
                              fontWeight: '700', 
                              color: isToday ? 'var(--primary)' : 'var(--text-muted)',
                              background: isToday ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                              padding: isToday ? '2px 6px' : '0',
                              borderRadius: '4px'
                            }}>
                              {dayNum}
                            </span>
                            <span className="plus-indicator" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0 }}>
                              ➕ Asignar
                            </span>
                          </div>
                        )}

                        {cellShifts.map(s => {
                          const driverName = s.customDriver || users.find(usr => usr.id === s.furgoId)?.label || s.furgoId;
                          
                          return (
                            <div 
                              key={s.id} 
                              style={{
                                fontSize: '0.72rem',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: s.status === 'closed' ? 'var(--shift-closed-bg)' : s.openedAt ? 'var(--shift-active-bg)' : 'var(--shift-planned-bg)',
                                border: s.status === 'closed' ? '1px solid var(--shift-closed-border)' : s.openedAt ? '1px solid var(--shift-active-border)' : '1px solid var(--shift-planned-border)',
                                color: s.status === 'closed' ? 'var(--shift-closed-text)' : s.openedAt ? 'var(--shift-active-text)' : 'var(--shift-planned-text)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1px'
                              }}
                            >
                              <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ 
                                  width: '5px', 
                                  height: '5px', 
                                  borderRadius: '50%', 
                                  background: s.status === 'closed' ? '#ef4444' : s.openedAt ? '#10b981' : '#9ca3af',
                                  display: 'inline-block' 
                                }}></span>
                                🚚 {driverName}
                              </div>
                              {(s.matricula || s.helper || s.helper2) && (
                                <div style={{ color: 'var(--shift-planned-detail)', paddingLeft: '8px', fontSize: '0.66rem', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                  {s.matricula && <span>🚐 {s.matricula}</span>}
                                  {s.helper && <span>🤝 {s.helper}</span>}
                                  {s.helper2 && <span>🤝 {s.helper2}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* -------------------- 2. WEEK VIEW -------------------- */}
        {calendarViewMode === 'week' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px'
          }}>
            {weekDays.map((dayDate, idx) => {
              const dayStr = getFormattedDateStr(dayDate);
              const dayShifts = shifts.filter(s => s.date === dayStr && ((s.customDriver && s.customDriver.trim()) || (s.helper && s.helper.trim())));
              const isToday = dayStr === new Date().toISOString().split('T')[0];
              const weekdayName = dayDate.toLocaleDateString('es-ES', { weekday: 'long' });
              const capitalized = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);

              return (
                <div 
                  key={idx}
                  onClick={() => {
                    setSelectedCalendarDay(dayStr);
                    setPlannedFurgoId('');
                    setPlannedHelper('');
                    setPlannedMatricula('');
                    setPlannedShiftModalOpen(true);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: isToday ? '1px solid var(--primary)' : '1px solid var(--panel-border)',
                    borderRadius: '12px',
                    padding: '12px',
                    minHeight: '220px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease, transform 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--panel-border)',
                    paddingBottom: '8px',
                    marginBottom: '4px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: isToday ? 'var(--primary)' : '#fff' }}>
                        {capitalized}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {dayStr.split('-').reverse().slice(0, 2).join('/')}
                      </span>
                    </div>
                    {isToday && (
                      <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', borderRadius: '4px', fontWeight: 'bold' }}>
                        Hoy
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    {dayShifts.length === 0 ? (
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '10px' }}>
                        Sin turnos planificados
                      </span>
                    ) : (
                      dayShifts.map(s => {
                        const driverName = s.customDriver || users.find(usr => usr.id === s.furgoId)?.label || s.furgoId;

                        return (
                          <div 
                            key={s.id} 
                            style={{
                              fontSize: '0.74rem',
                              padding: '6px 8px',
                              borderRadius: '8px',
                              background: s.status === 'closed' ? 'var(--shift-closed-bg)' : s.openedAt ? 'var(--shift-active-bg)' : 'var(--shift-planned-bg)',
                              border: s.status === 'closed' ? '1px solid var(--shift-closed-border)' : s.openedAt ? '1px solid var(--shift-active-border)' : '1px solid var(--shift-planned-border)',
                              color: s.status === 'closed' ? 'var(--shift-closed-text)' : s.openedAt ? 'var(--shift-active-text)' : 'var(--shift-planned-text)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px'
                            }}
                          >
                            <strong style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              🚚 {driverName}
                            </strong>
                            {s.matricula && <span style={{ color: 'var(--shift-planned-detail)', fontSize: '0.68rem', paddingLeft: '8px' }}>🚐 {s.matricula}</span>}
                            {s.helper && <span style={{ color: 'var(--shift-planned-detail)', fontSize: '0.68rem', paddingLeft: '8px' }}>🤝 {s.helper}</span>}
                            {s.helper2 && <span style={{ color: 'var(--shift-planned-detail)', fontSize: '0.68rem', paddingLeft: '8px' }}>🤝 {s.helper2}</span>}
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px', alignSelf: 'flex-end', marginTop: 'auto' }}>
                    <span>➕ Asignar</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* -------------------- 3. DAY VIEW -------------------- */}
        {calendarViewMode === 'day' && (() => {
          const dayStr = getFormattedDateStr(calendarDate);
          const dayShifts = shifts.filter(s => s.date === dayStr && ((s.customDriver && s.customDriver.trim()) || (s.helper && s.helper.trim()) || (s.helper2 && s.helper2.trim())));
          const activeRepartidores = users.filter(usr => usr && usr.role === 'repartidor');
          const availableDrivers = activeRepartidores.filter(d => !dayShifts.some(s => s.furgoId === d.id));

          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              alignItems: 'start'
            }}>
              
              {/* Day Shifts List Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--panel-border)',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.05rem', fontWeight: '700', color: '#fff', borderBottom: '1px solid var(--panel-border)', paddingBottom: '10px' }}>
                  Turnos Planificados ({dayShifts.length})
                </h3>

                {dayShifts.length === 0 ? (
                  <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '15px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed var(--panel-border)', textAlign: 'center' }}>
                    No hay choferes ni equipos programados para este día.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {dayShifts.map(s => {
                      const driverName = s.customDriver || users.find(usr => usr.id === s.furgoId)?.label || s.furgoId;

                      return (
                        <div 
                          key={s.id} 
                          style={{
                            background: 'rgba(255, 255, 255, 0.01)',
                            border: '1px solid var(--panel-border)',
                            borderRadius: '8px',
                            padding: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '10px'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              🚚 {driverName}
                              <span style={{ 
                                fontSize: '0.65rem', 
                                padding: '2px 5px', 
                                borderRadius: '4px',
                                background: s.status === 'closed' ? 'rgba(239, 68, 68, 0.15)' : s.openedAt ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                                color: s.status === 'closed' ? '#f87171' : s.openedAt ? '#34d399' : '#9ca3af'
                              }}>
                                {s.status === 'closed' ? 'Cerrado' : s.openedAt ? 'Activo' : 'Planificado'}
                              </span>
                              {s.status === 'closed' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`¿Estás seguro de que deseas reabrir el turno del día ${s.date} para esta furgoneta?`)) {
                                      reopenShift(s.furgoId, s.date);
                                      setTimeout(() => {
                                        loadData();
                                        triggerAlert('Turno reabierto correctamente');
                                      }, 100);
                                    }
                                  }}
                                  style={{
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    color: '#34d399',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.68rem',
                                    cursor: 'pointer',
                                    marginLeft: '8px',
                                    fontWeight: '600',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    height: '20px'
                                  }}
                                >
                                  🔓 Reabrir
                                </button>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '15px', marginTop: '8px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                <span>Chofer:</span>
                                <select
                                  className="form-input"
                                  value={s.customDriver || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    let newCustom = val;
                                    if (val === 'custom_input') {
                                      const typed = window.prompt('Escribe el nombre del chofer:');
                                      if (typed === null) return;
                                      newCustom = typed.trim() || 'Por asignar';
                                    }
                                    const updatedShifts = shifts.map(curr => {
                                      if (curr.id === s.id) {
                                        return { ...curr, customDriver: newCustom };
                                      }
                                      return curr;
                                    });
                                    setShifts(updatedShifts);
                                    saveShifts(updatedShifts);
                                    triggerAlert('Chofer actualizado');
                                  }}
                                  disabled={s.status === 'closed'}
                                  style={{ 
                                    padding: '2px 6px', 
                                    fontSize: '0.75rem', 
                                    height: '24px', 
                                    width: 'auto', 
                                    margin: 0,
                                    color: '#ffffff',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--panel-border)',
                                    borderRadius: '4px'
                                  }}
                                >
                                  <option value="" style={{ color: '#000000', background: '#ffffff' }}>Por asignar</option>
                                  <option value="custom_input" style={{ color: '#000000', background: '#ffffff' }}>✍️ Escribir...</option>
                                  {s.customDriver && !employeesList.some(emp => emp.name === s.customDriver) && (
                                    <option value={s.customDriver} style={{ color: '#000000', background: '#ffffff' }}>{s.customDriver}</option>
                                  )}
                                  {employeesList.filter(emp => emp.active !== false && (emp.role === 'chofer' || emp.role === 'ambos')).map(emp => (
                                    <option key={emp.id} value={emp.name} style={{ color: '#000000', background: '#ffffff' }}>{emp.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                <span>Ayudante:</span>
                                 <select
                                   className="form-input"
                                    value={s.helper || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      let newHelper = val;
                                      if (val === 'custom_input') {
                                        const typed = window.prompt('Escribe el nombre del ayudante:');
                                        if (typed === null) return;
                                        newHelper = typed.trim() || '';
                                      }
                                      const updatedShifts = shifts.map(curr => {
                                        if (curr.id === s.id) {
                                          return { ...curr, helper: newHelper };
                                        }
                                        return curr;
                                      });
                                      setShifts(updatedShifts);
                                      saveShifts(updatedShifts);
                                      triggerAlert('Ayudante actualizado');
                                    }}
                                    disabled={s.status === 'closed'}
                                    style={{ 
                                      padding: '2px 6px', 
                                      fontSize: '0.75rem', 
                                      height: '24px', 
                                      width: 'auto', 
                                      margin: 0,
                                      color: '#ffffff',
                                      background: 'rgba(255, 255, 255, 0.05)',
                                      border: '1px solid var(--panel-border)',
                                      borderRadius: '4px'
                                    }}
                                  >
                                    <option value="" style={{ color: '#000000', background: '#ffffff' }}>Sin ayudante</option>
                                    <option value="custom_input" style={{ color: '#000000', background: '#ffffff' }}>✍️ Escribir...</option>
                                    {s.helper && !employeesList.some(emp => emp.name === s.helper) && (
                                      <option value={s.helper} style={{ color: '#000000', background: '#ffffff' }}>{s.helper}</option>
                                    )}
                                    {employeesList.filter(emp => emp.active !== false).map(emp => (
                                      <option key={emp.id} value={emp.name} style={{ color: '#000000', background: '#ffffff' }}>{emp.name}</option>
                                    ))}
                                  </select>
                                </div>
  
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  <span>Ayudante 2:</span>
                                  <select
                                    className="form-input"
                                    value={s.helper2 || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      let newHelper2 = val;
                                      if (val === 'custom_input') {
                                        const typed = window.prompt('Escribe el nombre del segundo ayudante:');
                                        if (typed === null) return;
                                        newHelper2 = typed.trim() || '';
                                      }
                                      const updatedShifts = shifts.map(curr => {
                                        if (curr.id === s.id) {
                                          return { ...curr, helper2: newHelper2 };
                                        }
                                        return curr;
                                      });
                                      setShifts(updatedShifts);
                                      saveShifts(updatedShifts);
                                      triggerAlert('Segundo ayudante actualizado');
                                    }}
                                    disabled={s.status === 'closed'}
                                    style={{ 
                                      padding: '2px 6px', 
                                      fontSize: '0.75rem', 
                                      height: '24px', 
                                      width: 'auto', 
                                      margin: 0,
                                      color: '#ffffff',
                                      background: 'rgba(255, 255, 255, 0.05)',
                                      border: '1px solid var(--panel-border)',
                                      borderRadius: '4px'
                                    }}
                                  >
                                    <option value="" style={{ color: '#000000', background: '#ffffff' }}>Sin ayudante 2</option>
                                    <option value="custom_input" style={{ color: '#000000', background: '#ffffff' }}>✍️ Escribir...</option>
                                    {s.helper2 && !employeesList.some(emp => emp.name === s.helper2) && (
                                      <option value={s.helper2} style={{ color: '#000000', background: '#ffffff' }}>{s.helper2}</option>
                                    )}
                                    {employeesList.filter(emp => emp.active !== false).map(emp => (
                                      <option key={emp.id} value={emp.name} style={{ color: '#000000', background: '#ffffff' }}>{emp.name}</option>
                                    ))}
                                  </select>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                <span>Matrícula:</span>
                                <select
                                  className="form-input"
                                  value={s.matricula || ''}
                                  onChange={(e) => {
                                    const updatedShifts = shifts.map(curr => {
                                      if (curr.id === s.id) {
                                        return { ...curr, matricula: e.target.value };
                                      }
                                      return curr;
                                    });
                                    setShifts(updatedShifts);
                                    saveShifts(updatedShifts);
                                    triggerAlert('Matrícula actualizada');
                                  }}
                                  disabled={s.status === 'closed'}
                                  style={{ 
                                    padding: '2px 6px', 
                                    fontSize: '0.75rem', 
                                    height: '24px', 
                                    width: 'auto', 
                                    margin: 0,
                                    color: '#ffffff',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--panel-border)',
                                    borderRadius: '4px'
                                  }}
                                >
                                  <option value="" style={{ color: '#000000', background: '#ffffff' }}>Sin matrícula</option>
                                  {s.matricula && !platesList.includes(s.matricula) && (
                                    <option value={s.matricula} style={{ color: '#000000', background: '#ffffff' }}>{s.matricula}</option>
                                  )}
                                  {platesList.map(plate => (
                                    <option key={plate} value={plate} style={{ color: '#000000', background: '#ffffff' }}>{plate}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          <button 
                            type="button" 
                            onClick={() => {
                              if (window.confirm(`¿Seguro que deseas eliminar el turno de ${driverName}?`)) {
                                deletePlannedShift(s.furgoId, dayStr);
                                setTimeout(() => {
                                  loadData();
                                  triggerAlert('Turno eliminado');
                                }, 100);
                              }
                            }}
                            style={{ 
                              background: 'rgba(239, 68, 68, 0.1)', 
                              border: '1px solid rgba(239, 68, 68, 0.2)', 
                              color: '#f87171',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.75rem'
                            }}
                            title="Eliminar turno"
                          >
                            🗑️
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Inline Planning Form Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--panel-border)',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.05rem', fontWeight: '700', color: 'var(--primary)', borderBottom: '1px solid var(--panel-border)', paddingBottom: '10px' }}>
                  ➕ Planificar Turno para Hoy
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <span className="input-label">Furgoneta / Dispositivo</span>
                    <select
                      className="form-input"
                      value={plannedFurgoId}
                      onChange={(e) => setPlannedFurgoId(e.target.value)}
                      style={{ margin: 0, color: '#ffffff', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--panel-border)' }}
                    >
                      <option value="" style={{ color: '#000000', background: '#ffffff' }}>Por asignar / Sin furgoneta</option>
                      {activeRepartidores.map(d => (
                        <option key={d.id} value={d.id} style={{ color: '#000000', background: '#ffffff' }}>{d.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <span className="input-label">Chofer (Persona)</span>
                    <select
                      className="form-input"
                      value={plannedDriverName}
                      onChange={(e) => {
                        setPlannedDriverName(e.target.value);
                        setCustomDriverNameInput('');
                      }}
                      style={{ margin: 0, color: '#ffffff', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--panel-border)' }}
                    >
                      <option value="" style={{ color: '#000000', background: '#ffffff' }}>Por asignar</option>
                      <option value="custom_input" style={{ color: '#000000', background: '#ffffff' }}>✍️ Escribir otro...</option>
                      {employeesList.filter(e => e.active !== false && (e.role === 'chofer' || e.role === 'ambos')).map(emp => (
                        <option key={emp.id} value={emp.name} style={{ color: '#000000', background: '#ffffff' }}>{emp.name}</option>
                      ))}
                    </select>
                    {plannedDriverName === 'custom_input' && (
                      <div style={{ marginTop: '10px' }}>
                        <span className="input-label" style={{ fontSize: '0.75rem' }}>Nombre del Chofer</span>
                        <input
                          type="text"
                          className="form-input"
                          value={customDriverNameInput}
                          onChange={(e) => setCustomDriverNameInput(e.target.value)}
                          placeholder="Ej: Chofer de refuerzo, etc."
                          style={{ margin: 0 }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <span className="input-label">Ayudante (Persona)</span>
                    <select
                      className="form-input"
                      value={plannedHelper}
                      onChange={(e) => setPlannedHelper(e.target.value)}
                      style={{ margin: 0, color: '#ffffff', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--panel-border)' }}
                    >
                      <option value="" style={{ color: '#000000', background: '#ffffff' }}>Sin ayudante</option>
                      {employeesList.filter(e => e.active !== false).map(emp => (
                        <option key={emp.id} value={emp.name} style={{ color: '#000000', background: '#ffffff' }}>{emp.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <span className="input-label">Ayudante 2 (Persona)</span>
                    <select
                      className="form-input"
                      value={plannedHelper2}
                      onChange={(e) => setPlannedHelper2(e.target.value)}
                      style={{ margin: 0, color: '#ffffff', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--panel-border)' }}
                    >
                      <option value="" style={{ color: '#000000', background: '#ffffff' }}>Sin segundo ayudante</option>
                      {employeesList.filter(e => e.active !== false).map(emp => (
                        <option key={emp.id} value={emp.name} style={{ color: '#000000', background: '#ffffff' }}>{emp.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <span className="input-label">Matrícula (Vehículo)</span>
                    <select
                      className="form-input"
                      value={plannedMatricula}
                      onChange={(e) => setPlannedMatricula(e.target.value)}
                      style={{ margin: 0, color: '#ffffff', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--panel-border)' }}
                    >
                      <option value="" style={{ color: '#000000', background: '#ffffff' }}>Selecciona matrícula (Opcional)...</option>
                      {platesList.map(plate => (
                        <option key={plate} value={plate} style={{ color: '#000000', background: '#ffffff' }}>{plate}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      let targetFurgoId = plannedFurgoId;
                      if (!targetFurgoId) {
                        targetFurgoId = `custom_temp_${Date.now()}`;
                      }
                      let targetCustom = '';
                      if (plannedDriverName === 'custom_input') {
                        targetCustom = customDriverNameInput.trim() || 'Por asignar';
                      } else {
                        targetCustom = plannedDriverName;
                      }
                      savePlannedShift(targetFurgoId, dayStr, plannedHelper, plannedMatricula, targetCustom, currentUser?.id, plannedHelper2);
                      setTimeout(() => {
                        loadData();
                        setPlannedFurgoId('');
                        setPlannedHelper('');
                        setPlannedHelper2('');
                        setPlannedMatricula('');
                        setPlannedDriverName('');
                        setCustomDriverNameInput('');
                        triggerAlert('Turno planificado con éxito');
                      }, 100);
                    }}
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '5px', margin: 0 }}
                  >
                    Planificar y Asignar Turno
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal stylesheet for hover effects */}
        <style dangerouslySetInnerHTML={{__html: `
          .calendar-day-cell:hover .plus-indicator {
            opacity: 1 !important;
          }
        `}} />

        {/* -------------------- 4. PAYROLL VIEW -------------------- */}
        {calendarViewMode === 'payroll' && (() => {
          const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
          const monthShifts = shifts.filter(s => s.date.startsWith(monthPrefix));

          const payrollList = [];

          employeesList.forEach(emp => {
            // Count dates worked as driver
            const driverDates = monthShifts
              .filter(s => s.customDriver && s.customDriver.toLowerCase() === emp.name.toLowerCase())
              .map(s => ({ date: s.date, role: 'Chofer' }));

            // Count dates worked as helper
            const helperDates = monthShifts
              .filter(s => (s.helper && s.helper.toLowerCase() === emp.name.toLowerCase()) || (s.helper2 && s.helper2.toLowerCase() === emp.name.toLowerCase()))
              .map(s => ({ date: s.date, role: 'Ayudante' }));

            // Merge and sort
            const combined = [...driverDates, ...helperDates];
            combined.sort((a, b) => a.date.localeCompare(b.date));

            // Unique by date
            const unique = [];
            const seen = new Set();
            combined.forEach(item => {
              if (!seen.has(item.date)) {
                seen.add(item.date);
                unique.push(item);
              }
            });

            payrollList.push({
              id: emp.id,
              name: emp.name,
              role: emp.role,
              rate: emp.dailyRate || 0,
              days: unique.length,
              dates: unique
            });
          });

          const totalDays = payrollList.reduce((sum, item) => sum + item.days, 0);
          const totalAmount = payrollList.reduce((sum, item) => sum + (item.days * item.rate), 0);

          const saveRate = (item, newRateStr) => {
            const newRate = parseFloat(newRateStr);
            if (isNaN(newRate) || newRate < 0) {
              triggerAlert('Introduce una tarifa válida', 'error');
              return;
            }
            const updatedEmployees = employeesList.map(emp => {
              if (emp.id === item.id) {
                return { ...emp, dailyRate: newRate };
              }
              return emp;
            });
            setEmployeesList(updatedEmployees);
            saveEmployeesList(updatedEmployees);
            triggerAlert(`Tarifa de ${item.name} actualizada a ${newRate} €`);
            
            const updatedEditing = { ...editingRates };
            delete updatedEditing[`${item.role}_${item.id}`];
            setEditingRates(updatedEditing);
            loadData();
          };

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Días Trabajados (${monthNames[month]}):</span>
                  <strong style={{ fontSize: '1.6rem', color: 'var(--primary)' }}>{totalDays} jornadas</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Nóminas a Pagar:</span>
                  <strong style={{ fontSize: '1.6rem', color: '#10b981' }}>{totalAmount.toFixed(2)} €</strong>
                </div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid var(--panel-border)',
                borderRadius: '12px',
                overflowX: 'auto'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--panel-border)' }}>
                      <th style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600' }}>Empleado</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600' }}>Rol</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600' }}>Tarifa por Día (€)</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600', textAlign: 'center' }}>Días Trabajados</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600', textAlign: 'right' }}>Total a Pagar</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollList.map(item => {
                      const editKey = `${item.role}_${item.id}`;
                      const activeVal = editingRates[editKey] !== undefined ? editingRates[editKey] : item.rate;
                      const hasChanged = parseFloat(activeVal) !== item.rate;

                      return (
                        <tr key={editKey} style={{ borderBottom: '1px solid var(--panel-border)' }}>
                          <td style={{ padding: '12px 16px', fontSize: '0.9rem', fontWeight: '700', color: '#fff' }}>
                            {item.role === 'chofer' ? '🚚' : '🤝'} {item.name}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {item.role === 'chofer' ? 'Chofer' : 'Ayudante'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input 
                                type="number" 
                                className="form-input" 
                                value={activeVal}
                                onChange={(e) => setEditingRates({ ...editingRates, [editKey]: e.target.value })}
                                style={{ width: '80px', padding: '4px 8px', fontSize: '0.85rem', margin: 0, height: '28px' }}
                              />
                              {hasChanged && (
                                <button 
                                  type="button" 
                                  onClick={() => saveRate(item, activeVal)}
                                  className="btn btn-primary"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', margin: 0, height: '28px', whiteSpace: 'nowrap' }}
                                >
                                  💾 Guardar
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '0.9rem', textAlign: 'center', fontWeight: '600', color: 'var(--primary)' }}>
                            {item.days} días
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '0.95rem', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                            {(item.days * item.rate).toFixed(2)} €
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <button 
                              type="button" 
                              onClick={() => setSelectedPayrollEmployee(item)}
                              className="btn btn-secondary btn-small"
                              style={{ margin: 0, padding: '4px 10px', fontSize: '0.78rem' }}
                            >
                              👁️ Ver Fechas
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Modal de Detalle de Fechas de Empleado */}
        {selectedPayrollEmployee && (
          <div className="obs-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, padding: '15px', backdropFilter: 'blur(4px)' }}>
            <div className="obs-modal" style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '14px', width: '100%', maxWidth: '400px', padding: '24px', position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', textAlign: 'left' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: 'var(--primary)' }}>
                  📅 Fechas: {selectedPayrollEmployee.name}
                </h3>
                <button 
                  type="button" 
                  onClick={() => setSelectedPayrollEmployee(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: 0 }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', marginBottom: '15px' }}>
                {selectedPayrollEmployee.dates.length === 0 ? (
                  <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '10px' }}>
                    No hay días registrados para este mes.
                  </div>
                ) : (
                  selectedPayrollEmployee.dates.map(dObj => {
                    const dateObj = new Date(dObj.date + 'T00:00:00');
                    const weekday = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
                    const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
                    return (
                      <div 
                        key={dObj.date}
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          padding: '8px 12px', 
                          background: 'rgba(255,255,255,0.01)', 
                          border: '1px solid var(--panel-border)', 
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          color: '#fff'
                        }}
                      >
                        <div>
                          <strong>{capitalized}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '10px' }}>({dObj.role})</span>
                        </div>
                        <span style={{ color: 'var(--text-muted)' }}>{dObj.date.split('-').reverse().join('/')}</span>
                      </div>
                    );
                  })
                )}
              </div>

              <button 
                type="button" 
                onClick={() => setSelectedPayrollEmployee(null)} 
                className="btn btn-secondary" 
                style={{ width: '100%', margin: 0 }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* -------------------- COMMON PLAN MODAL (For Month/Week Views) -------------------- */}
        {plannedShiftModalOpen && selectedCalendarDay && (() => {
          const dateShifts = shifts.filter(s => s.date === selectedCalendarDay);
          const activeRepartidores = users.filter(usr => usr && usr.role === 'repartidor');
          const availableDrivers = activeRepartidores.filter(d => !dateShifts.some(s => s.furgoId === d.id));

          return (
            <div className="obs-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, padding: '15px', backdropFilter: 'blur(4px)' }}>
              <div className="obs-modal" style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '14px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', textAlign: 'left' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)' }}>
                    📅 Turnos: {selectedCalendarDay.split('-').reverse().join('/')}
                  </h3>
                  <button 
                    type="button" 
                    onClick={() => {
                      setPlannedShiftModalOpen(false);
                      setSelectedCalendarDay(null);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', padding: 0 }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: '700', color: '#fff' }}>
                    Turnos Asignados ({dateShifts.length})
                  </h4>

                  {dateShifts.length === 0 ? (
                    <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '10px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed var(--panel-border)' }}>
                      No hay choferes asignados para este día.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {dateShifts.map(s => {
                        const driverName = s.customDriver || users.find(usr => usr.id === s.furgoId)?.label || s.furgoId;

                        return (
                          <div 
                            key={s.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              background: 'rgba(255,255,255,0.02)', 
                              border: '1px solid var(--panel-border)', 
                              borderRadius: '8px', 
                              padding: '10px 12px',
                              gap: '10px'
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                🚚 {driverName}
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  padding: '1px 5px', 
                                  borderRadius: '4px',
                                  background: s.status === 'closed' ? 'rgba(239, 68, 68, 0.15)' : s.openedAt ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                                  color: s.status === 'closed' ? '#f87171' : s.openedAt ? '#34d399' : '#9ca3af'
                                }}>
                                  {s.status === 'closed' ? 'Cerrado' : s.openedAt ? 'Activo' : 'Planificado'}
                                </span>
                                {s.status === 'closed' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`¿Estás seguro de que deseas reabrir el turno del día ${s.date} para esta furgoneta?`)) {
                                        reopenShift(s.furgoId, s.date);
                                        setTimeout(() => {
                                          loadData();
                                          triggerAlert('Turno reabierto correctamente');
                                        }, 100);
                                      }
                                    }}
                                    style={{
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                      color: '#34d399',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '0.68rem',
                                      cursor: 'pointer',
                                      marginLeft: '6px',
                                      fontWeight: '600',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      height: '18px'
                                    }}
                                  >
                                    🔓 Reabrir
                                  </button>
                                )}
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Chofer:</span>
                                <select
                                  className="form-input"
                                  value={s.customDriver || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    let newCustom = val;
                                    if (val === 'custom_input') {
                                      const typed = window.prompt('Escribe el nombre del chofer:');
                                      if (typed === null) return;
                                      newCustom = typed.trim() || 'Por asignar';
                                    }
                                    const updatedShifts = shifts.map(curr => {
                                      if (curr.id === s.id) {
                                        return { ...curr, customDriver: newCustom };
                                      }
                                      return curr;
                                    });
                                    setShifts(updatedShifts);
                                    saveShifts(updatedShifts);
                                    triggerAlert('Chofer actualizado');
                                  }}
                                  disabled={s.status === 'closed'}
                                  style={{ 
                                    padding: '2px 6px', 
                                    fontSize: '0.75rem', 
                                    height: '24px', 
                                    width: 'auto', 
                                    margin: 0,
                                    color: '#ffffff',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--panel-border)',
                                    borderRadius: '4px'
                                  }}
                                >
                                  <option value="" style={{ color: '#000000', background: '#ffffff' }}>Por asignar</option>
                                  <option value="custom_input" style={{ color: '#000000', background: '#ffffff' }}>✍️ Escribir...</option>
                                  {s.customDriver && !employeesList.some(emp => emp.name === s.customDriver) && (
                                    <option value={s.customDriver} style={{ color: '#000000', background: '#ffffff' }}>{s.customDriver}</option>
                                  )}
                                  {employeesList.filter(emp => emp.active !== false && (emp.role === 'chofer' || emp.role === 'ambos')).map(emp => (
                                    <option key={emp.id} value={emp.name} style={{ color: '#000000', background: '#ffffff' }}>{emp.name}</option>
                                  ))}
                                </select>

                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>Ayudante:</span>
                                <select
                                  className="form-input"
                                  value={s.helper || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    let newHelper = val;
                                    if (val === 'custom_input') {
                                      const typed = window.prompt('Escribe el nombre del ayudante:');
                                      if (typed === null) return;
                                      newHelper = typed.trim() || '';
                                    }
                                    const updatedShifts = shifts.map(curr => {
                                      if (curr.id === s.id) {
                                        return { ...curr, helper: newHelper };
                                      }
                                      return curr;
                                    });
                                    setShifts(updatedShifts);
                                    saveShifts(updatedShifts);
                                    triggerAlert('Ayudante actualizado');
                                  }}
                                  disabled={s.status === 'closed'}
                                  style={{ 
                                    padding: '2px 6px', 
                                    fontSize: '0.75rem', 
                                    height: '24px', 
                                    width: 'auto', 
                                    margin: 0,
                                    color: '#ffffff',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--panel-border)',
                                    borderRadius: '4px'
                                  }}
                                >
                                  <option value="" style={{ color: '#000000', background: '#ffffff' }}>Sin ayudante</option>
                                  <option value="custom_input" style={{ color: '#000000', background: '#ffffff' }}>✍️ Escribir...</option>
                                  {s.helper && !employeesList.some(emp => emp.name === s.helper) && (
                                    <option value={s.helper} style={{ color: '#000000', background: '#ffffff' }}>{s.helper}</option>
                                  )}
                                  {employeesList.filter(emp => emp.active !== false).map(emp => (
                                    <option key={emp.id} value={emp.name} style={{ color: '#000000', background: '#ffffff' }}>{emp.name}</option>
                                  ))}
                                </select>

                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>Ayudante 2:</span>
                                <select
                                  className="form-input"
                                  value={s.helper2 || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    let newHelper2 = val;
                                    if (val === 'custom_input') {
                                      const typed = window.prompt('Escribe el nombre del segundo ayudante:');
                                      if (typed === null) return;
                                      newHelper2 = typed.trim() || '';
                                    }
                                    const updatedShifts = shifts.map(curr => {
                                      if (curr.id === s.id) {
                                        return { ...curr, helper2: newHelper2 };
                                      }
                                      return curr;
                                    });
                                    setShifts(updatedShifts);
                                    saveShifts(updatedShifts);
                                    triggerAlert('Segundo ayudante actualizado');
                                  }}
                                  disabled={s.status === 'closed'}
                                  style={{ 
                                    padding: '2px 6px', 
                                    fontSize: '0.75rem', 
                                    height: '24px', 
                                    width: 'auto', 
                                    margin: 0,
                                    color: '#ffffff',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--panel-border)',
                                    borderRadius: '4px'
                                  }}
                                >
                                  <option value="" style={{ color: '#000000', background: '#ffffff' }}>Sin ayudante 2</option>
                                  <option value="custom_input" style={{ color: '#000000', background: '#ffffff' }}>✍️ Escribir...</option>
                                  {s.helper2 && !employeesList.some(emp => emp.name === s.helper2) && (
                                    <option value={s.helper2} style={{ color: '#000000', background: '#ffffff' }}>{s.helper2}</option>
                                  )}
                                  {employeesList.filter(emp => emp.active !== false).map(emp => (
                                    <option key={emp.id} value={emp.name} style={{ color: '#000000', background: '#ffffff' }}>{emp.name}</option>
                                  ))}
                                </select>

                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>Matrícula:</span>
                                <select
                                  className="form-input"
                                  value={s.matricula || ''}
                                  onChange={(e) => {
                                    const updatedShifts = shifts.map(curr => {
                                      if (curr.id === s.id) {
                                        return { ...curr, matricula: e.target.value };
                                      }
                                      return curr;
                                    });
                                    setShifts(updatedShifts);
                                    saveShifts(updatedShifts);
                                    triggerAlert('Matrícula actualizada');
                                  }}
                                  disabled={s.status === 'closed'}
                                  style={{ 
                                    padding: '2px 6px', 
                                    fontSize: '0.75rem', 
                                    height: '24px', 
                                    width: 'auto', 
                                    margin: 0,
                                    color: '#ffffff',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--panel-border)',
                                    borderRadius: '4px'
                                  }}
                                >
                                  <option value="" style={{ color: '#000000', background: '#ffffff' }}>Sin matrícula</option>
                                  {s.matricula && !platesList.includes(s.matricula) && (
                                    <option value={s.matricula} style={{ color: '#000000', background: '#ffffff' }}>{s.matricula}</option>
                                  )}
                                  {platesList.map(plate => (
                                    <option key={plate} value={plate} style={{ color: '#000000', background: '#ffffff' }}>{plate}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`¿Seguro que deseas eliminar el turno de ${driverName}?`)) {
                                  deletePlannedShift(s.furgoId, selectedCalendarDay);
                                  setTimeout(() => {
                                    loadData();
                                    triggerAlert('Turno eliminado');
                                  }, 100);
                                }
                              }}
                              style={{ 
                                background: 'rgba(239, 68, 68, 0.1)', 
                                border: '1px solid rgba(239, 68, 68, 0.2)', 
                                color: '#f87171',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.75rem'
                              }}
                              title="Eliminar turno"
                            >
                              🗑️
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: '700', color: 'var(--primary)' }}>
                    ➕ Planificar Nuevo Turno
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <span className="input-label">Furgoneta / Dispositivo</span>
                      <select
                        className="form-input"
                        value={plannedFurgoId}
                        onChange={(e) => setPlannedFurgoId(e.target.value)}
                        style={{ margin: 0, color: '#ffffff', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--panel-border)' }}
                      >
                        <option value="" style={{ color: '#000000', background: '#ffffff' }}>Por asignar / Sin furgoneta</option>
                        {activeRepartidores.map(d => (
                          <option key={d.id} value={d.id} style={{ color: '#000000', background: '#ffffff' }}>{d.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <span className="input-label">Chofer (Persona)</span>
                      <select
                        className="form-input"
                        value={plannedDriverName}
                        onChange={(e) => {
                          setPlannedDriverName(e.target.value);
                          setCustomDriverNameInput('');
                        }}
                        style={{ margin: 0, color: '#ffffff', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--panel-border)' }}
                      >
                        <option value="" style={{ color: '#000000', background: '#ffffff' }}>Por asignar</option>
                        <option value="custom_input" style={{ color: '#000000', background: '#ffffff' }}>✍️ Escribir otro...</option>
                        {employeesList.filter(e => e.active !== false && (e.role === 'chofer' || e.role === 'ambos')).map(emp => (
                          <option key={emp.id} value={emp.name} style={{ color: '#000000', background: '#ffffff' }}>{emp.name}</option>
                        ))}
                      </select>
                      {plannedDriverName === 'custom_input' && (
                        <div style={{ marginTop: '10px' }}>
                          <span className="input-label" style={{ fontSize: '0.75rem' }}>Nombre del Chofer</span>
                          <input
                            type="text"
                            className="form-input"
                            value={customDriverNameInput}
                            onChange={(e) => setCustomDriverNameInput(e.target.value)}
                            placeholder="Ej: Chofer de refuerzo, etc."
                            style={{ margin: 0 }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <span className="input-label">Ayudante (Persona)</span>
                      <select
                        className="form-input"
                        value={plannedHelper}
                        onChange={(e) => setPlannedHelper(e.target.value)}
                        style={{ margin: 0, color: '#ffffff', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--panel-border)' }}
                      >
                        <option value="" style={{ color: '#000000', background: '#ffffff' }}>Sin ayudante</option>
                        {employeesList.filter(e => e.active !== false).map(emp => (
                          <option key={emp.id} value={emp.name} style={{ color: '#000000', background: '#ffffff' }}>{emp.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <span className="input-label">Ayudante 2 (Persona)</span>
                      <select
                        className="form-input"
                        value={plannedHelper2}
                        onChange={(e) => setPlannedHelper2(e.target.value)}
                        style={{ margin: 0, color: '#ffffff', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--panel-border)' }}
                      >
                        <option value="" style={{ color: '#000000', background: '#ffffff' }}>Sin segundo ayudante</option>
                        {employeesList.filter(e => e.active !== false).map(emp => (
                          <option key={emp.id} value={emp.name} style={{ color: '#000000', background: '#ffffff' }}>{emp.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <span className="input-label">Matrícula (Vehículo)</span>
                      <select
                        className="form-input"
                        value={plannedMatricula}
                        onChange={(e) => setPlannedMatricula(e.target.value)}
                        style={{ margin: 0, color: '#ffffff', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--panel-border)' }}
                      >
                        <option value="" style={{ color: '#000000', background: '#ffffff' }}>Selecciona matrícula (Opcional)...</option>
                        {platesList.map(plate => (
                          <option key={plate} value={plate} style={{ color: '#000000', background: '#ffffff' }}>{plate}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        let targetFurgoId = plannedFurgoId;
                        if (!targetFurgoId) {
                          targetFurgoId = `custom_temp_${Date.now()}`;
                        }
                        let targetCustom = '';
                        if (plannedDriverName === 'custom_input') {
                          targetCustom = customDriverNameInput.trim() || 'Por asignar';
                        } else {
                          targetCustom = plannedDriverName;
                        }
                        savePlannedShift(targetFurgoId, selectedCalendarDay, plannedHelper, plannedMatricula, targetCustom, currentUser?.id, plannedHelper2);
                        setTimeout(() => {
                          loadData();
                          setPlannedFurgoId('');
                          setPlannedHelper('');
                          setPlannedHelper2('');
                          setPlannedMatricula('');
                          setPlannedDriverName('');
                          setCustomDriverNameInput('');
                          triggerAlert('Turno planificado con éxito');
                        }, 100);
                      }}
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: '4px', margin: 0 }}
                    >
                      Crear y Asignar Turno
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };
  // --- RENDERIZADO DEL INFORME DIARIO (Trigger rebuild v99) ---
  const renderDailyReport = () => {
    const prevDay = () => {
      const d = new Date(reportDate + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      setReportDate(d.toISOString().split('T')[0]);
    };
    const nextDay = () => {
      const d = new Date(reportDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      setReportDate(d.toISOString().split('T')[0]);
    };



    const reportTickets = visibleTickets.filter(t => {
      if (t.date !== reportDate) return false;
      if (reportFilterFurgo !== 'all' && t.furgoId !== reportFilterFurgo) return false;
      if (t.status === 'success') return true;
      if (t.status === 'failed') {
        const parsed = parseTicketNotes(t.notes);
        return parsed.failedChargeType && parsed.failedChargeType !== 'none';
      }
      return false;
    });

    const furgoIds = [...new Set(reportTickets.map(t => t.furgoId))];

    const exportToExcel = async () => {
      try {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const allRows = [
          [`INFORME DIARIO: ${reportDate}`],
          []
        ];

        furgoIds.forEach(furgoId => {
          const furgoUser = users.find(u => u.id === furgoId);
          const furgoLabel = furgoUser?.label || furgoId;
          const fTickets = reportTickets.filter(t => t.furgoId === furgoId);
          const existingShift = shifts.find(s => s.furgoId === furgoId && s.date === reportDate);
          const routeName = existingShift?.routeName || (fTickets.length > 0 ? fTickets[0].routeName : '');
          
          allRows.push([`FURGONETA: ${furgoLabel}${routeName ? ` | Ruta: ${routeName}` : ''}`]);
          allRows.push(['Cliente', 'Servicio', 'Marca/Detalle', 'Cantidad', 'Precio Unitario', 'Total']);

          let furgoTotal = 0;
          let furgoTotalQty = 0;
          fTickets.forEach(ticket => {
            const billableTasks = getBillableTasks(ticket);
            const taskCount = billableTasks.length;
            billableTasks.forEach((task, ti) => {
              const unitP = task.unitPrice;
              const totalP = task.totalPrice;
              furgoTotal += totalP;
              furgoTotalQty += task.quantity || 0;
              allRows.push([
                ti === 0 ? ticket.customerName : '',
                task.name,
                task.detail || '',
                task.quantity,
                unitP.toFixed(2) + ' €',
                totalP.toFixed(2) + ' €'
              ]);
            });
            if (taskCount === 0) {
              allRows.push([ticket.customerName, '(sin servicios)', '', '', '', '']);
            }
          });

          const recordedKms = existingShift ? getRouteKms(furgoId, reportDate) : 0;
          const kmsTotal = recordedKms * kmPrice;

          allRows.push(['', '', 'Subtotal entregas:', furgoTotalQty, '', furgoTotal.toFixed(2) + ' €']);
          if (recordedKms > 0) {
            allRows.push(['', '', `Kilometraje (${recordedKms}km × ${kmPrice.toFixed(2)}€):`, '', '', kmsTotal.toFixed(2) + ' €']);
            allRows.push(['', '', 'TOTAL FURGONETA:', furgoTotalQty, '', (furgoTotal + kmsTotal).toFixed(2) + ' €']);
          } else {
            allRows.push(['', '', 'TOTAL FURGONETA:', furgoTotalQty, '', furgoTotal.toFixed(2) + ' €']);
          }
          allRows.push([]);
        });

        const ws = XLSX.utils.aoa_to_sheet(allRows);
        ws['!cols'] = [{ wch: 28 }, { wch: 32 }, { wch: 18 }, { wch: 8 }, { wch: 20 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, `Informe ${reportDate}`);
        XLSX.writeFile(wb, `informe_diario_${reportDate}.xlsx`);
      } catch (e) {
        console.error('Error exportando Excel:', e);
        triggerAlert('Error al exportar el informe', 'error');
      }
    };

    const grandTotal = reportTickets.reduce((sum, t) => {
      const billable = getBillableTasks(t);
      return sum + billable.reduce((s, task) => s + task.totalPrice, 0);
    }, 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Cabecera */}
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem' }}>📊</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)' }}>Informe Diario de Servicios</h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Solo se muestran entregas completadas o intentos fallidos con cobro</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={prevDay} className="btn btn-secondary btn-small" style={{ width: 'auto', padding: '6px 10px' }}>◀</button>
            <input
              type="date"
              className="form-input"
              value={reportDate}
              onChange={e => setReportDate(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '0.95rem', width: 'auto', fontWeight: '600' }}
            />
            <button onClick={nextDay} className="btn btn-secondary btn-small" style={{ width: 'auto', padding: '6px 10px' }}>▶</button>
            
            <select
              className="form-input"
              value={reportFilterFurgo}
              onChange={e => setReportFilterFurgo(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '0.95rem', width: 'auto', fontWeight: '600', minWidth: '150px', height: '35px' }}
            >
              <option value="all">Todas las furgonetas</option>
              {activeRepartidores.map(u => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>

            {reportTickets.length > 0 && (
              <button onClick={exportToExcel} className="btn btn-primary btn-small" style={{ width: 'auto', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                📥 Exportar Excel
              </button>
            )}
          </div>
        </div>

        {reportTickets.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '1.05rem', fontWeight: '600' }}>
              {reportFilterFurgo !== 'all' 
                ? `No hay entregas completadas para el ${reportDate} con la furgoneta "${users.find(u => u.id === reportFilterFurgo)?.label || reportFilterFurgo}"`
                : `No hay entregas completadas para el ${reportDate}`}
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>Selecciona otra fecha, cambia de furgoneta o verifica que los repartos estén registrados</div>
          </div>
        ) : (
          <>
            {furgoIds.map(furgoId => {
              const furgoUser = users.find(u => u.id === furgoId);
              const furgoLabel = furgoUser?.label || furgoId;
              const fTickets = reportTickets.filter(t => t.furgoId === furgoId);
              const existingShift = shifts.find(s => s.furgoId === furgoId && s.date === reportDate);
              const routeName = existingShift?.routeName || (fTickets.length > 0 ? fTickets[0].routeName : '');
              
              let furgoDeliveryTotal = 0;
              let furgoTotalQty = 0;
              fTickets.forEach(t => {
                const billable = getBillableTasks(t);
                billable.forEach(task => {
                  furgoDeliveryTotal += task.totalPrice;
                  furgoTotalQty += task.quantity || 0;
                });
              });

              const recordedKms = getRouteKms(furgoId, reportDate);
              const kmsTotal = recordedKms * kmPrice;
              const furgoGrandTotal = furgoDeliveryTotal + kmsTotal;

              return (
                <div key={furgoId} className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                  {/* Cabecera de furgoneta */}
                  <div style={{ padding: '14px 20px', background: 'rgba(99,102,241,0.1)', borderBottom: '1px solid var(--panel-border)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.3rem' }}>🚚</span>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-main)' }}>{furgoLabel}</div>
                        {routeName && <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600' }}>📍 {routeName}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>✅ {fTickets.length} entregas</span>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)' }}>💰 {furgoGrandTotal.toFixed(2)} €</span>
                    </div>
                  </div>

                  {/* Tabla de servicios */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--panel-border)' }}>
                          <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Servicio</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalle</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cant.</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>P. Unit.</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fTickets.map((ticket, tIdx) => {
                          const tasks = getBillableTasks(ticket);
                          if (tasks.length === 0) return (
                            <tr key={ticket.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '10px 16px', fontWeight: '600', color: '#000' }}>{ticket.customerName}</td>
                              <td colSpan={5} style={{ padding: '10px 16px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin servicios registrados</td>
                            </tr>
                          );
                          return tasks.map((task, sIdx) => {
                            const name = task.name;
                            const detail = task.detail;
                            const unitP = task.unitPrice;
                            const totalP = task.totalPrice;
                            const isFirstRow = sIdx === 0;
                            const isLastTask = sIdx === tasks.length - 1;
                            const isLastTicket = tIdx === fTickets.length - 1;
                            const rowBorder = (isLastTask && !isLastTicket) ? '2px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.03)';
                            return (
                              <tr key={`${ticket.id}-${sIdx}`} style={{ borderBottom: rowBorder, background: isFirstRow && tIdx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                                <td style={{ padding: '9px 16px', verticalAlign: 'top', fontWeight: isFirstRow ? '600' : '400', color: isFirstRow ? '#000' : 'transparent', fontSize: isFirstRow ? '0.86rem' : '0.85rem', whiteSpace: 'nowrap' }}>
                                  {isFirstRow ? ticket.customerName : ''}
                                </td>
                                <td style={{ padding: '9px 16px', color: 'var(--text-main)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                    <span>{name}</span>
                                    {ticket.status === 'success' && (
                                      <span 
                                        onClick={() => toggleTaskCharge(ticket.id, sIdx)} 
                                        style={{ 
                                          cursor: 'pointer', 
                                          fontSize: '0.7rem', 
                                          padding: '1px 6px', 
                                          borderRadius: '4px',
                                          userSelect: 'none',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          fontWeight: '600',
                                          background: task.noCharge ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                                          color: task.noCharge ? '#f87171' : '#34d399',
                                          border: task.noCharge ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.25)',
                                          transition: 'all 0.15s ease'
                                        }}
                                        title={task.noCharge ? "Hacer cobrable" : "Quitar coste (Gratuito)"}
                                      >
                                        {task.noCharge ? '❌ Sin Coste' : '💶 Cobrar'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '9px 16px' }}>
                                  {detail && (
                                    <span style={{ fontSize: '0.75rem', padding: '2px 7px', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)', borderRadius: '5px', fontWeight: '600' }}>
                                      {ticket.status === 'success' ? '📺 ' : ''}{detail}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '9px 16px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600' }}>{task.quantity}</td>
                                <td style={{ padding: '9px 16px', textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                  {unitP > 0 ? `${unitP.toFixed(2)} €` : '—'}
                                </td>
                                <td style={{ padding: '9px 16px', textAlign: 'right', color: 'var(--primary)', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
                                  {totalP > 0 ? `${totalP.toFixed(2)} €` : '—'}
                                </td>
                              </tr>
                            );
                          });
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'rgba(99,102,241,0.06)', borderTop: '2px solid rgba(99,102,241,0.2)' }}>
                          <td colSpan={3} style={{ padding: '10px 16px', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Subtotal Servicios de Entrega</td>
                          <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '700', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{furgoTotalQty}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{furgoDeliveryTotal.toFixed(2)} €</td>
                        </tr>
                        {recordedKms > 0 && (
                          <tr style={{ background: 'rgba(99,102,241,0.04)' }}>
                            <td colSpan={3} style={{ padding: '8px 16px', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.85rem' }}>🛣️ Kilometraje ({recordedKms} km × {kmPrice.toFixed(2)} €/km)</td>
                            <td style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>—</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{kmsTotal.toFixed(2)} €</td>
                          </tr>
                        )}
                        <tr style={{ background: 'rgba(99,102,241,0.12)', borderTop: '1px solid rgba(99,102,241,0.3)' }}>
                          <td colSpan={3} style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--primary)', fontSize: '0.95rem' }}>🏆 TOTAL FURGONETA</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', color: 'var(--primary)', fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' }}>{furgoTotalQty}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--primary)' }}>—</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '800', color: 'var(--primary)', fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums' }}>{furgoGrandTotal.toFixed(2)} €</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* Resumen global (solo si hay más de una furgoneta) */}
            {furgoIds.length > 1 && (
              <div className="glass-panel" style={{ padding: '20px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '1.05rem', fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📈 Resumen Global del Día — {reportDate}
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase' }}>Furgoneta</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase' }}>Entregas</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase' }}>Cant. Serv.</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase' }}>Imp. Servicios</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase' }}>Kms</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.78rem', textTransform: 'uppercase' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {furgoIds.map(furgoId => {
                      const furgoUser = users.find(u => u.id === furgoId);
                      const furgoLabel = furgoUser?.label || furgoId;
                      const fTickets = reportTickets.filter(t => t.furgoId === furgoId);
                      let fTotal = 0;
                      let fQty = 0;
                      fTickets.forEach(t => { 
                        const billable = getBillableTasks(t);
                        billable.forEach(task => { 
                          fTotal += task.totalPrice; 
                          fQty += task.quantity || 0;
                        }); 
                      });
                      const fKms = getRouteKms(furgoId, reportDate);
                      const fKmsTotal = fKms * kmPrice;
                      return (
                        <tr key={furgoId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '9px 12px', fontWeight: '600', color: 'var(--text-main)' }}>🚚 {furgoLabel}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>{fTickets.length}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'center', color: 'var(--text-main)', fontWeight: '600' }}>{fQty}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{fTotal.toFixed(2)} €</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fKms > 0 ? `${fKms} km` : '—'}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{(fTotal + fKmsTotal).toFixed(2)} €</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'rgba(99,102,241,0.15)', borderTop: '2px solid rgba(99,102,241,0.3)' }}>
                      <td style={{ padding: '12px', fontWeight: '800', color: 'var(--primary)', fontSize: '1rem' }}>💰 TOTAL GLOBAL</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: '800', color: 'var(--primary)' }}>
                        {reportTickets.length}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: '800', color: 'var(--primary)' }}>
                        {(() => {
                          let tq = 0;
                          reportTickets.forEach(t => { 
                            const billable = getBillableTasks(t);
                            billable.forEach(task => { tq += task.quantity || 0; }); 
                          });
                          return tq;
                        })()}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {(() => {
                          let ts = 0;
                          reportTickets.forEach(t => { 
                            const billable = getBillableTasks(t);
                            billable.forEach(task => { ts += task.totalPrice; }); 
                          });
                          return ts.toFixed(2) + ' €';
                        })()}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {(() => {
                          let tk = 0;
                          furgoIds.forEach(fId => {
                            const fKms = getRouteKms(fId, reportDate);
                            tk += fKms;
                          });
                          return tk > 0 ? `${tk} km` : '—';
                        })()}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: 'var(--primary)', fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums' }}>
                        {(() => {
                          let gt = 0;
                          furgoIds.forEach(fId => {
                            const fT = reportTickets.filter(t => t.furgoId === fId);
                            fT.forEach(t => { 
                              const billable = getBillableTasks(t);
                              billable.forEach(task => { gt += task.totalPrice; }); 
                            });
                            const fKms = getRouteKms(fId, reportDate);
                            gt += fKms * kmPrice;
                          });
                          return gt.toFixed(2) + ' €';
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // --- RENDERIZADO DEL PORTAL DE ADMINISTRADOR ---
  const renderAdminPortal = () => {
    const filteredAdminTickets = visibleTickets.filter(t => {
      if (adminStartDate && t.date < adminStartDate) return false;
      if (adminEndDate && t.date > adminEndDate) return false;
      if (billingFilterFurgo !== 'all' && t.furgoId !== billingFilterFurgo) return false;
      return true;
    });

    const exportSingleFurgoDailyReport = async (fid) => {
      const label = users.find(u => u.id === fid)?.label || fid;
      
      const datesSet = new Set();
      filteredAdminTickets.filter(t => t.furgoId === fid).forEach(t => datesSet.add(t.date));
      shifts.filter(s => 
        s.furgoId === fid && 
        s.status === 'closed' &&
        (!adminStartDate || s.date >= adminStartDate) &&
        (!adminEndDate || s.date <= adminEndDate)
      ).forEach(s => datesSet.add(s.date));

      const sortedDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));

      const rows = [];
      let totalBase = 0;
      let totalMileage = 0;
      let totalKms = 0;
      let totalNet = 0;

      sortedDates.forEach(date => {
        const fTickets = filteredAdminTickets.filter(t => t.furgoId === fid && t.date === date);
        const fSuccess = fTickets.filter(t => t.status === 'success' || !t.status);
        
        let pms = 0;
        let deliveries = 0;
        fSuccess.forEach(t => {
          t.tasks.forEach(task => {
            const tid = task.tariffId || '';
            if (tid.startsWith('PM_')) pms += task.quantity;
            if (tid.startsWith('ENTREGA_') || tid.startsWith('TV_ENT_') || tid.startsWith('TV_COMB_')) deliveries += task.quantity;
          });
        });

        const shift = shifts.find(s => s.furgoId === fid && s.date === date && s.status === 'closed');
        const kms = shift ? getRouteKms(fid, date) : 0;
        const mileage = kms * kmPrice;
        const base = fSuccess.reduce((sum, t) => sum + t.totalPrice, 0);
        const dailyTotal = base + mileage;
        const iva = dailyTotal * 0.21;
        const retencion = dailyTotal * 0.01;
        const net = dailyTotal + iva - retencion;

        totalBase += base;
        totalMileage += mileage;
        totalKms += kms;
        totalNet += net;

        const dateObj = new Date(date + 'T00:00:00');
        const weekday = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
        const formattedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

        rows.push({
          'Fecha': `${formattedWeekday}, ${date}`,
          'Éxitos / Total': `${fSuccess.length} / ${fTickets.length}`,
          'Puestas en Marcha': pms,
          'Entregas': deliveries,
          'Kilómetros': `${kms.toFixed(1)} km`,
          'Kilometraje (€)': mileage.toFixed(2),
          'Base Imponible (€)': base.toFixed(2),
          'Total Neto (€)': net.toFixed(2)
        });
      });

      rows.push({});
      rows.push({
        'Fecha': 'TOTALES ACUMULADOS',
        'Éxitos / Total': '',
        'Puestas en Marcha': '',
        'Entregas': '',
        'Kilómetros': `${totalKms.toFixed(1)} km`,
        'Kilometraje (€)': totalMileage.toFixed(2),
        'Base Imponible (€)': totalBase.toFixed(2),
        'Total Neto (€)': totalNet.toFixed(2)
      });

      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Detalle Diario');
      XLSX.writeFile(wb, `Facturacion_Diaria_${label.replace(/\s+/g, '_')}_${adminStartDate || 'inicio'}_a_${adminEndDate || 'hoy'}.xlsx`);
    };

    const renderDrilldownModal = () => {
      if (!selectedDrilldownFurgoId) return null;
      const fid = selectedDrilldownFurgoId;
      const label = users.find(u => u.id === fid)?.label || fid;

      const datesSet = new Set();
      filteredAdminTickets.filter(t => t.furgoId === fid).forEach(t => datesSet.add(t.date));
      shifts.filter(s => 
        s.furgoId === fid && 
        s.status === 'closed' &&
        (!adminStartDate || s.date >= adminStartDate) &&
        (!adminEndDate || s.date <= adminEndDate)
      ).forEach(s => datesSet.add(s.date));

      const sortedDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));

      let totalBase = 0;
      let totalMileage = 0;
      let totalKms = 0;
      let totalPms = 0;
      let totalDeliveries = 0;
      let totalTickets = 0;
      let totalSuccess = 0;

      const dailyStats = sortedDates.map(date => {
        const fTickets = filteredAdminTickets.filter(t => t.furgoId === fid && t.date === date);
        const fSuccess = fTickets.filter(t => t.status === 'success' || !t.status);
        
        let pms = 0;
        let deliveries = 0;
        fSuccess.forEach(t => {
          t.tasks.forEach(task => {
            const tid = task.tariffId || '';
            if (tid.startsWith('PM_')) pms += task.quantity;
            if (tid.startsWith('ENTREGA_') || tid.startsWith('TV_ENT_') || tid.startsWith('TV_COMB_')) deliveries += task.quantity;
          });
        });

        const shift = shifts.find(s => s.furgoId === fid && s.date === date && s.status === 'closed');
        const kms = shift ? getRouteKms(fid, date) : 0;
        const mileage = kms * kmPrice;
        const base = fSuccess.reduce((sum, t) => sum + t.totalPrice, 0);
        const dailyTotal = base + mileage;
        const iva = dailyTotal * 0.21;
        const retencion = dailyTotal * 0.01;
        const net = dailyTotal + iva - retencion;

        totalBase += base;
        totalMileage += mileage;
        totalKms += kms;
        totalPms += pms;
        totalDeliveries += deliveries;
        totalTickets += fTickets.length;
        totalSuccess += fSuccess.length;

        const dateObj = new Date(date + 'T00:00:00');
        const weekday = dateObj.toLocaleDateString('es-ES', { weekday: 'long' });
        const formattedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

        return {
          date,
          formattedWeekday,
          successCount: fSuccess.length,
          totalCount: fTickets.length,
          pms,
          deliveries,
          kms,
          mileage,
          base,
          net
        };
      });

      const overallTotalNet = (totalBase + totalMileage) * 1.20;

      return (
        <div className="drilldown-overlay" onClick={() => setSelectedDrilldownFurgoId(null)}>
          <div className="drilldown-content" onClick={(e) => e.stopPropagation()}>
            <div className="drilldown-header">
              <div className="drilldown-title" style={{ textAlign: 'left' }}>
                <h3>📈 Desglose Diario: {label} <span style={{ fontSize: '0.75rem', opacity: 0.5, color: '#fff', marginLeft: '5px' }}>(v99)</span></h3>
                <p>Periodo del {adminStartDate || 'Inicio'} al {adminEndDate || 'Hoy'}</p>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setSelectedDrilldownFurgoId(null)}
                style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="dashboard-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div className="stat-card success" style={{ padding: '15px' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>Total Neto Acumulado</p>
                <div className="stat-val" style={{ fontSize: '1.4rem', marginTop: '5px' }}>{overallTotalNet.toFixed(2)} €</div>
              </div>
              <div className="stat-card info" style={{ padding: '15px' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>Entregas / Éxitos</p>
                <div className="stat-val" style={{ fontSize: '1.4rem', marginTop: '5px' }}>{totalSuccess} / {totalTickets}</div>
              </div>
              <div className="stat-card warning" style={{ padding: '15px' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>Kilometraje Total</p>
                <div className="stat-val" style={{ fontSize: '1.4rem', marginTop: '5px' }}>{totalKms.toFixed(1)} km</div>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({totalMileage.toFixed(2)} €)</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)' }}>Detalle Diario</h4>
              <button 
                type="button" 
                className="btn btn-primary btn-small"
                onClick={() => exportSingleFurgoDailyReport(fid)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', height: '34px', margin: 0 }}
              >
                <Download size={14} /> Exportar Excel
              </button>
            </div>

            {dailyStats.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No hay actividad registrada en este periodo.
              </div>
            ) : (
              <div className="table-container">
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th style={{ textAlign: 'center' }}>Éxitos / Total</th>
                      <th style={{ textAlign: 'center' }}>PMs</th>
                      <th style={{ textAlign: 'center' }}>Entregas</th>
                      <th style={{ textAlign: 'center' }}>Kms</th>
                      <th style={{ textAlign: 'right' }}>Kilometraje</th>
                      <th style={{ textAlign: 'right' }}>Base Imponible</th>
                      <th style={{ textAlign: 'right' }}>Total Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyStats.map(stat => {
                      const dailyTotal = stat.base + stat.mileage;
                      const iva = dailyTotal * 0.21;
                      const retencion = dailyTotal * 0.01;
                      const net = dailyTotal + iva - retencion;

                      return (
                        <tr key={stat.date}>
                          <td style={{ fontWeight: '600' }}>{stat.formattedWeekday}, {stat.date}</td>
                          <td style={{ textAlign: 'center' }}>{stat.successCount} / {stat.totalCount}</td>
                          <td style={{ textAlign: 'center' }}>{stat.pms}</td>
                          <td style={{ textAlign: 'center' }}>{stat.deliveries}</td>
                          <td style={{ textAlign: 'center' }}>{stat.kms.toFixed(1)} km</td>
                          <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{stat.mileage.toFixed(2)} €</td>
                          <td style={{ textAlign: 'right' }}>{stat.base.toFixed(2)} €</td>
                          <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>{net.toFixed(2)} €</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      );
    };

    const successTickets = filteredAdminTickets.filter(t => t.status === 'success' || !t.status);
    const furgos = billingFilterFurgo !== 'all' 
      ? activeRepartidores.filter(u => u.id === billingFilterFurgo).map(u => u.id)
      : activeRepartidores.map(u => u.id);

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
          {showReportDay && (
            <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('dashboard'); }}>Dashboard</button>
          )}
          {showReportDay && (
            <button className={`tab-btn ${activeTab === 'daily_report' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('daily_report'); }}>📊 Informe del Día</button>
          )}
          {showDeliveriesPeriod && (
            <button className={`tab-btn ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>Repartos del Periodo ({filteredAdminTickets.length})</button>
          )}
          {showMapControl && (
            <button className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('map'); }}>🗺️ Mapa de Control</button>
          )}
          {showShiftCalendar && (
            <button className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('calendar'); }}>📅 Calendario de Turnos</button>
          )}
          {hasSearchPermission && (
            <button className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('search'); }}>🔍 Buscador General</button>
          )}
          {editingTicketId && (
            <button className={`tab-btn active`} onClick={() => setActiveTab('new_ticket')}>✏️ Editando...</button>
          )}
          {showStaff && (
            <button className={`tab-btn ${activeTab === 'employees' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('employees'); }}>👥 Personal</button>
          )}
          {showVanPricing && (
            <button className={`tab-btn ${activeTab === 'tariffs' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('tariffs'); }}>Precios Corte Inglés</button>
          )}
          {(showStaff || showSecurity) && (
            <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('users'); }}>Furgonetas y Seguridad</button>
          )}
          <button className={`tab-btn ${activeTab === 'changelog' ? 'active' : ''}`} onClick={() => { if(editingTicketId) cancelEditing(); setActiveTab('changelog'); }}>🚀 Actualizaciones</button>
        </div>

        {activeTab === 'employees' && renderEmployeesPortal()}
        {activeTab === 'daily_report' && renderDailyReport()}
        {activeTab === 'calendar' && renderShiftCalendar()}

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Furgoneta:</span>
                  <select 
                    className="form-input" 
                    style={{ padding: '6px 12px', fontSize: '0.9rem', width: 'auto', minWidth: '150px', height: '36px' }}
                    value={billingFilterFurgo} 
                    onChange={(e) => setBillingFilterFurgo(e.target.value)}
                  >
                    <option value="all">Todas las furgonetas</option>
                    {activeRepartidores.map(u => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </select>
                </div>
                {(adminStartDate || adminEndDate || billingFilterFurgo !== 'all') && (
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-small" 
                    style={{ padding: '6px 12px' }}
                    onClick={() => {
                      setAdminStartDate('');
                      setAdminEndDate('');
                      setBillingFilterFurgo('all');
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '100%' }}>
              <div className="glass-panel" style={{ textAlign: 'left' }}>
                <h2>Ganancias Acumuladas por Furgoneta</h2>
                <div className="chart-bar-container">
                  {furgos.map(fid => {
                    const data = furgoData[fid];
                    const percent = (data.earnings / maxEarnings) * 80;
                    const uIdx = users.findIndex(u => u.id === fid);
                    const barColor = uIdx % 3 === 0 ? 'var(--primary)' : uIdx % 3 === 1 ? 'var(--warning)' : 'var(--success)';
                    return (
                      <div className="chart-bar-column" key={fid} onClick={() => setSelectedDrilldownFurgoId(fid)} title={`Ver detalle diario de ${users.find(u => u.id === fid)?.label || fid}`}>
                        <span className="chart-val-label">{data.earnings.toFixed(2)} €</span>
                        <div className="chart-bar" style={{ height: `${percent || 2}%`, backgroundColor: barColor }}></div>
                        <span className="chart-label">{(users.find(u => u.id === fid)?.label) || fid} ({data.successCount}/{data.count} éxitos)</span>
                      </div>
                    );
                  })}
                </div>

                <div className="table-container" style={{ marginTop: '30px' }}>
                  <table style={{ width: '100%', minWidth: '1000px' }}>
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
                          <tr key={fid} className="interactive-row" onClick={() => setSelectedDrilldownFurgoId(fid)} title={`Ver detalle diario de ${label}`}>
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
                    <strong> (del {adminStartDate || 'inicio'} al {adminEndDate || 'hoy'}</strong>
                  ) : (
                    <strong> (todo el historial</strong>
                  )}
                  {billingFilterFurgo !== 'all' ? (
                    <span> - Furgoneta: <strong>{users.find(u => u.id === billingFilterFurgo)?.label || billingFilterFurgo}</strong>)</span>
                  ) : (
                    <span>)</span>
                  )}
                  .
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
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShiftKmsInput('');
                    setShiftSummaryDate(ticketFilterDate);
                    setShiftSummaryFurgoId(ticketFilterFurgo);
                    setShowShiftModal(true);
                  }}
                  className="btn btn-secondary btn-small"
                  style={{ width: 'auto', margin: 0, padding: '8px 16px', background: '#c7d2fe', color: '#000000', border: '1px solid #a5b4fc', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
                >
                  📊 Ver Resumen en Directo ({ticketFilterDate})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewRouteDateInput(ticketFilterDate);
                    setShowMoveRouteModal(true);
                  }}
                  className="btn btn-secondary btn-small"
                  style={{ width: 'auto', margin: 0, padding: '8px 16px', background: '#e9d5ff', color: '#000000', border: '1px solid #d8b4fe', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
                >
                  📅 Cambiar Fecha de esta Ruta
                </button>
              </div>
            )}

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
                        {routeStartAddr && routeStartAddr.trim() && (
                          <button
                            type="button"
                            onClick={() => handleNavigate(routeStartAddr)}
                            style={{
                              background: 'transparent', border: 'none', color: '#10b981',
                              fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                              fontWeight: 'bold'
                            }}
                            title="Navegar a esta dirección"
                          >
                            🗺️ Navegar
                          </button>
                        )}
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
                        {routeEndAddr && routeEndAddr.trim() && (
                          <button
                            type="button"
                            onClick={() => handleNavigate(routeEndAddr)}
                            style={{
                              background: 'transparent', border: 'none', color: '#10b981',
                              fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                              fontWeight: 'bold'
                            }}
                            title="Navegar a esta dirección"
                          >
                            🗺️ Navegar
                          </button>
                        )}
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
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <span className="input-label">🕒 Hora de Salida (Inicio)</span>
                    <input 
                      type="time" 
                      className="form-input" 
                      value={routeStartTime} 
                      onChange={(e) => {
                        const newTime = e.target.value;
                        setRouteStartTime(newTime);
                        saveRouteStartTime(ticketFilterFurgo, ticketFilterDate, newTime);
                      }} 
                      style={{ height: '45px', padding: '8px 12px' }}
                    />
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {(() => {
                              const uIdx = users.findIndex(u => u.id === t.furgoId);
                              const badgeClass = uIdx % 3 === 0 ? 'badge-primary' : uIdx % 3 === 1 ? 'badge-warning' : 'badge-success';
                              return <span className={`badge ${badgeClass}`} style={{ width: 'fit-content' }}>{t.furgoLabel || t.furgoId || ''}</span>;
                            })()}
                            {(!t.status || t.status === 'pending' || t.status === 'transit') && (
                              <select
                                className="form-input"
                                value=""
                                onChange={(e) => {
                                  const targetId = e.target.value;
                                  if (targetId) {
                                    handleSendSupport(t.id, targetId);
                                  }
                                }}
                                style={{ padding: '2px 4px', fontSize: '0.75rem', height: '26px', cursor: 'pointer', marginTop: '2px', width: 'auto', minWidth: '100px' }}
                              >
                                <option value="">🤝 Auxilio/Apoyo: [Seleccionar chofer...]</option>
                                {users.filter(u => u && u.role === 'repartidor' && u.id !== t.furgoId).map(u => (
                                  <option key={u.id} value={u.id}>{u.label}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          <div style={{ color: '#000' }}>{t.customerName || ''}</div>
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
                                 CP {t.postcode}{getTownAndProvinceFromPostcode(t.postcode) ? ` - ${getTownAndProvinceFromPostcode(t.postcode)}` : ''}
                               </span>
                             )}
                             {t.lat && t.lng ? '🟢 ' : '🔴 '}
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
                            let cleanNotesText = parsed.cleanNotes;
                            let sType = 'entrega';
                            if (cleanNotesText.includes('[CUELGUE]')) {
                              sType = 'cuelgue';
                              cleanNotesText = cleanNotesText.replace('[CUELGUE]', '').trim();
                            } else if (cleanNotesText.includes('[PUESTA_MARCHA]')) {
                              sType = 'puesta_marcha';
                              cleanNotesText = cleanNotesText.replace('[PUESTA_MARCHA]', '').trim();
                            } else if (cleanNotesText.includes('[TARDE]')) {
                              sType = 'tarde';
                              cleanNotesText = cleanNotesText.replace('[TARDE]', '').trim();
                            } else {
                              sType = getTicketServiceType(t);
                            }
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {sType !== 'entrega' && (
                                    <span className="badge" style={{
                                      fontSize: '0.65rem',
                                      padding: '1px 5px',
                                      background: sType === 'cuelgue' ? 'rgba(168, 85, 247, 0.15)' : sType === 'puesta_marcha' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                                      color: sType === 'cuelgue' ? '#a855f7' : sType === 'puesta_marcha' ? '#ec4899' : '#f97316',
                                      border: sType === 'cuelgue' ? '1px solid rgba(168, 85, 247, 0.25)' : sType === 'puesta_marcha' ? '1px solid rgba(236, 72, 153, 0.25)' : '1px solid rgba(249, 115, 22, 0.25)',
                                      fontWeight: 'bold',
                                      borderRadius: '4px'
                                    }}>
                                      {sType === 'cuelgue' ? '📺 Cuelgue' : sType === 'puesta_marcha' ? '⚙️ Puesta en Marcha' : '🌙 Servicio Tarde'}
                                    </span>
                                  )}
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
                                  title={cleanNotesText}
                                >
                                  {cleanNotesText || '-'}
                                </span>
                                {parsed.driverObservations && (
                                  <div style={{ 
                                    background: 'rgba(16, 185, 129, 0.08)', 
                                    border: '1px solid rgba(16, 185, 129, 0.25)', 
                                    borderRadius: '6px', 
                                    padding: '4px 8px', 
                                    fontSize: '0.78rem', 
                                    color: '#34d399',
                                    marginTop: '4px',
                                    fontStyle: 'normal',
                                    whiteSpace: 'normal',
                                    wordBreak: 'break-word',
                                    maxWidth: '220px'
                                  }}>
                                    <strong>💬 Obs:</strong> {parsed.driverObservations}
                                  </div>
                                )}
                                {t.failureReason && (
                                  <div style={{ 
                                    background: 'rgba(239, 68, 68, 0.08)', 
                                    border: '1px solid rgba(239, 68, 68, 0.25)', 
                                    borderRadius: '6px', 
                                    padding: '4px 8px', 
                                    fontSize: '0.78rem', 
                                    color: '#f87171',
                                    marginTop: '4px',
                                    fontStyle: 'normal',
                                    whiteSpace: 'normal',
                                    wordBreak: 'break-word',
                                    maxWidth: '220px'
                                  }}>
                                    <strong>⚠️ Fallo:</strong> {t.failureReason}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {(() => {
                              const billable = getBillableTasks(t);
                              if (t.status === 'success' || (t.status === 'failed' && billable.length > 0)) {
                                return billable.map((task, idx) => (
                                  <span key={idx} className="badge badge-secondary" style={{ border: '1px solid var(--panel-border)', fontSize: '0.7rem' }}>
                                    {task.name} (x{task.quantity || 1})
                                  </span>
                                ));
                              } else if (t.status === 'failed') {
                                return (
                                  <span className="badge badge-secondary" style={{ border: '1px solid var(--panel-border)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    🔴 Fallido (Sin Cobro)
                                  </span>
                                );
                              } else {
                                return (t.tasks || []).map((task, idx) => {
                                  if (!task) return null;
                                  const tariff = tariffs.find(tar => tar.id === task.tariffId);
                                  const name = task.name || (tariff ? tariff.name : task.tariffId);
                                  return (
                                    <span key={idx} className="badge badge-secondary" style={{ border: '1px solid var(--panel-border)', fontSize: '0.7rem' }}>
                                      {name} (x{task.quantity || 1})
                                    </span>
                                  );
                                });
                              }
                            })()}
                          </div>
                        </td>
                        <td style={{ 
                          fontWeight: '700', 
                          color: (() => {
                            if (t.status === 'failed') {
                              const billable = getBillableTasks(t);
                              const failedTotal = billable.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
                              return failedTotal > 0 ? 'var(--success)' : 'var(--text-muted)';
                            }
                            return 'var(--success)';
                          })()
                        }}>
                          {(() => {
                            if (t.status === 'failed') {
                              const billable = getBillableTasks(t);
                              const failedTotal = billable.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
                              return failedTotal.toFixed(2);
                            }
                            return (t.totalPrice || 0).toFixed(2);
                          })()} €
                        </td>
                        <td>
                          {(() => {
                            const isSuccess = t.status === 'success';
                            const isFailed = t.status === 'failed';
                            const isTransit = t.status === 'transit';
                            
                            let badgeClass = 'badge-warning';
                            let badgeText = '🟡 Pendiente';
                            let badgeStyle = { fontSize: '0.75rem' };
                            
                            if (isSuccess) {
                              badgeClass = 'badge-success';
                              badgeText = '🟢 Entregado';
                            } else if (isFailed) {
                              badgeClass = 'badge-danger';
                              badgeText = `🔴 Fallido ${t.failureReason ? `(${t.failureReason})` : ''}`;
                            } else {
                              const sType = getTicketServiceType(t);
                              if (sType === 'cuelgue') {
                                badgeStyle = { fontSize: '0.75rem', background: '#a855f7', color: '#fff', border: '1px solid rgba(168, 85, 247, 0.4)' };
                                badgeText = '📺 Cuelgue';
                              } else if (sType === 'puesta_marcha') {
                                badgeStyle = { fontSize: '0.75rem', background: '#ec4899', color: '#fff', border: '1px solid rgba(236, 72, 153, 0.4)' };
                                badgeText = '⚙️ Puesta en Marcha';
                              } else if (sType === 'tarde') {
                                badgeStyle = { fontSize: '0.75rem', background: '#f97316', color: '#fff', border: '1px solid rgba(249, 115, 22, 0.4)' };
                                badgeText = '🌙 Servicio Tarde';
                              } else {
                                if (isTransit) {
                                  badgeStyle = { fontSize: '0.75rem', background: '#38bdf8', color: '#0f172a', border: '1px solid rgba(56, 189, 248, 0.4)' };
                                  badgeText = '🔵 En Camino';
                                } else {
                                  badgeClass = 'badge-warning';
                                  badgeText = '🟡 Pendiente';
                                }
                              }
                            }
                            
                            return (
                              <span className={`badge ${badgeClass}`} style={badgeStyle} title={t.failureReason}>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0 }}>Turnos Diarios Cerrados (Repartidores)</h3>
                <button
                  onClick={() => { loadData(); triggerAlert('Lista de turnos actualizada'); }}
                  className="btn btn-secondary btn-small"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px' }}
                  title="Sincronizar con la base de datos"
                >
                  🔄 Actualizar
                </button>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                Aquí se muestran los cierres de turno realizados por los choferes. Si un chofer se equivocó o necesita registrar algo más, puedes "Reabrir Turno".
              </p>

              {/* Filtros de Búsqueda de Turnos */}
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap', alignItems: 'flex-end', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--panel-border)', width: '100%' }}>
                <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '150px' }}>
                  <span className="input-label" style={{ fontSize: '0.8rem' }}>📅 Filtrar por Fecha:</span>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={shiftFilterDate} 
                    onChange={(e) => setShiftFilterDate(e.target.value)} 
                    style={{ height: '38px' }}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '150px' }}>
                  <span className="input-label" style={{ fontSize: '0.8rem' }}>🚚 Filtrar por Furgoneta/Chofer:</span>
                  <select 
                    className="form-input" 
                    value={shiftFilterFurgo} 
                    onChange={(e) => setShiftFilterFurgo(e.target.value)} 
                    style={{ height: '38px' }}
                  >
                    <option value="all">Todas las furgonetas</option>
                    {users.filter(u => u && u.role === 'repartidor').map(u => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </select>
                </div>
                {(shiftFilterDate || shiftFilterFurgo !== 'all') && (
                  <button 
                    type="button" 
                    onClick={() => { setShiftFilterDate(''); setShiftFilterFurgo('all'); }} 
                    className="btn btn-secondary" 
                    style={{ height: '38px', padding: '0 15px', width: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    ✕ Limpiar
                  </button>
                )}
              </div>
              
              {shifts.length === 0 ? (
                <div style={{ padding: '20px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--panel-border)', borderRadius: '8px', textAlign: 'center' }}>
                  No se ha registrado ningún cierre de turno todavía.
                </div>
              ) : visibleShifts.length === 0 ? (
                <div style={{ padding: '20px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--panel-border)', borderRadius: '8px', textAlign: 'center' }}>
                  No se encontraron cierres de turno que coincidan con los filtros aplicados.
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
                        const summary = (s.summary && Object.keys(s.summary).length > 0) ? s.summary : getShiftSummary(s.furgoId, s.date);
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
                                <span>Cli: <strong>{summary ? summary.ticketsCount : 0}</strong></span> |
                                <span>TV: <strong>{summary ? summary.totalTvs : 0}</strong></span> |
                                <span>PV/GV: <strong>{summary ? summary.totalPV : 0}/{summary ? summary.totalGV : 0}</strong></span> |
                                <span>PM/Cuelgues: <strong>{summary ? summary.totalPM : 0}/{summary ? summary.totalCuelgues : 0}</strong></span>
                                {summary && summary.totalCODAmount > 0 && (
                                  <> | <span>Cobrado: <strong style={{ color: 'var(--success)' }}>{summary.totalCODAmount.toFixed(2)} €</strong></span></>
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
          <div className="glass-panel map-tab-panel">
            <h2 className="map-tab-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🗺️ Mapa de Control de Rutas</h2>
            <p className="map-tab-subtitle" style={{ marginBottom: '20px' }}>
              Visualiza en tiempo real la ubicación de tus repartidores en vivo y el recorrido ordenado de sus paradas en el mapa.
            </p>

            <div className="map-filters-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '20px' }}>
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

            <div className="map-legend-container" style={{ display: 'flex', gap: '15px', marginTop: '5px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                <span>Entregado</span>
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

            <div className="map-split-container">
              <div className="map-split-left" style={{ position: 'relative' }}>
                <div 
                  id="admin-map" 
                  className="map-element"
                ></div>
                {renderMapCenterControls(true)}
                {renderMapFloatingPanel()}
              </div>
              
              <div className="map-split-right">
                {renderMapStopsList(true)}
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
                        {routeStartAddr && routeStartAddr.trim() && (
                          <button
                            type="button"
                            onClick={() => handleNavigate(routeStartAddr)}
                            style={{
                              background: 'transparent', border: 'none', color: '#10b981',
                              fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                              fontWeight: 'bold'
                            }}
                            title="Navegar a esta dirección"
                          >
                            🗺️ Navegar
                          </button>
                        )}
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
                        {routeEndAddr && routeEndAddr.trim() && (
                          <button
                            type="button"
                            onClick={() => handleNavigate(routeEndAddr)}
                            style={{
                              background: 'transparent', border: 'none', color: '#10b981',
                              fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                              fontWeight: 'bold'
                            }}
                            title="Navegar a esta dirección"
                          >
                            🗺️ Navegar
                          </button>
                        )}
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
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <span className="input-label">🕒 Hora de Salida (Inicio)</span>
                    <input 
                      type="time" 
                      className="form-input" 
                      value={routeStartTime} 
                      onChange={(e) => {
                        const newTime = e.target.value;
                        setRouteStartTime(newTime);
                        saveRouteStartTime(mapFilterFurgo, mapFilterDate, newTime);
                      }} 
                      style={{ height: '45px', padding: '8px 12px' }}
                    />
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

            {currentUser?.role === 'superadmin' && (
              <div className="input-group" style={{ marginBottom: '25px', maxWidth: '350px' }}>
                <span className="input-label" style={{ fontWeight: '700' }}>📂 Filtrar Categoría de Tarifas:</span>
                <select 
                  className="form-input" 
                  value={selectedTariffOwner} 
                  onChange={(e) => setSelectedTariffOwner(e.target.value)}
                  style={{ background: '#1e1e2e', color: '#fff', border: '1px solid var(--panel-border)', padding: '8px 12px', borderRadius: '8px' }}
                >
                  <option value="base">📌 Tarifas Base (Originales / Por Defecto)</option>
                  {users.filter(u => u.role === 'admin').map(u => (
                    <option key={u.id} value={u.id}>🚚 Customizadas de: {u.label}</option>
                  ))}
                </select>
              </div>
            )}
            
            {selectedTariffOwner !== 'base' && tariffs.filter(t => t.createdBy === selectedTariffOwner || t.id.endsWith('_' + selectedTariffOwner)).length === 0 && (
              <div className="glass-panel" style={{ padding: '20px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', marginBottom: '20px' }}>
                <p style={{ color: '#f87171', fontWeight: '600', marginBottom: '15px' }}>
                  ⚠️ Este administrador no tiene tarifas inicializadas en el sistema.
                </p>
                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={async () => {
                      if (window.confirm('¿Deseas inicializar las tarifas de este administrador con los precios base actuales?')) {
                        try {
                          await initializeAdminTariffs(selectedTariffOwner, 'copy_default', tariffs);
                          loadData();
                          triggerAlert('Tarifas inicializadas correctamente');
                        } catch (err) {
                          triggerAlert('Error al inicializar en Supabase. Se guardó localmente.', 'warning');
                          loadData();
                        }
                      }
                    }}
                    style={{ width: 'auto', margin: 0, padding: '8px 16px' }}
                  >
                    ⚙️ Inicializar con Tarifas Base
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={async () => {
                      if (window.confirm('¿Deseas inicializar las tarifas de este administrador a 0,00 €?')) {
                        try {
                          await initializeAdminTariffs(selectedTariffOwner, 'zero', tariffs);
                          loadData();
                          triggerAlert('Tarifas inicializadas a 0,00 € correctamente');
                        } catch (err) {
                          triggerAlert('Error al inicializar en Supabase. Se guardó localmente.', 'warning');
                          loadData();
                        }
                      }
                    }}
                    style={{ width: 'auto', margin: 0, padding: '8px 16px' }}
                  >
                    💸 Inicializar a 0,00 €
                  </button>
                </div>
              </div>
            )}
            
            <div className="settings-grid">
              <div>
                {['Paquetería', 'Televisores', 'Instalaciones', 'Barras de Sonido', 'Electrodomésticos Varios', 'Servicios', 'Gama Blanca', 'Muebles'].map(block => {
                  const blockTariffs = tariffs.filter(t => {
                    const matchesBlock = t.block === block;
                    if (!matchesBlock) return false;
                    
                    if (currentUser?.role === 'superadmin') {
                      if (selectedTariffOwner === 'base') {
                        const isPredefinedCopy = ['ENTREGA_PV', 'ENTREGA_GV', 'RECOGIDA_PV', 'RECOGIDA_GV', 'TV_ENT_49', 'TV_ENT_74', 'TV_ENT_115', 'TV_COMB_49', 'TV_COMB_74', 'TV_COMB_115', 'TV_VIEJA_URB', 'TV_VIEJA_NO_URB', 'PM_BAS_49', 'PM_BAS_74', 'PM_BAS_115', 'PM_COMP_49', 'PM_COMP_74', 'PM_COMP_115', 'CUELGUE_49', 'CUELGUE_74', 'CUELGUE_115', 'BSND', 'PM_BSND', 'CUELGUE_BSND', 'MFRA', 'SPAR', 'SSUE', 'ALTA', 'TDIC', 'PROY', 'VTEC', 'URGENTE_100', 'URGENTE_120', 'ORDE', 'PANT', 'MCAD'].some(pid => t.id.startsWith(pid + '_'));
                        if (isPredefinedCopy) return false;
                        return !t.createdBy || t.createdBy === 'admin';
                      } else {
                        return t.createdBy === selectedTariffOwner || t.id.endsWith('_' + selectedTariffOwner);
                      }
                    }
                    return true;
                  });
                  if (blockTariffs.length === 0) return null;
                  const isExpanded = !!expandedBlocks[block];
                  return (
                    <div key={block} style={{ marginBottom: '15px', borderRadius: '10px', border: '1px solid var(--panel-border)', background: 'rgba(255,255,255,0.01)', overflow: 'hidden' }}>
                      <div 
                        onClick={() => setExpandedBlocks(prev => ({ ...prev, [block]: !prev[block] }))}
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '12px 18px', 
                          background: isExpanded ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)', 
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.2s ease',
                          borderBottom: isExpanded ? '1px solid var(--panel-border)' : 'none'
                        }}
                        className="collapsible-block-header"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.1rem' }}>
                            {block === 'Paquetería' ? '📦' : 
                             block === 'Televisores' ? '📺' : 
                             block === 'Instalaciones' ? '🔧' : 
                             block === 'Barras de Sonido' ? '🔊' :
                             block === 'Electrodomésticos Varios' ? '💻' :
                             block === 'Servicios' ? '🛠️' :
                             block === 'Gama Blanca' ? '🔌' : 
                             block === 'Muebles' ? '🛋️' : '🏷️'}
                          </span>
                          <span style={{ fontWeight: '700', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.5px', color: isExpanded ? 'var(--primary)' : 'var(--text)' }}>
                            {block}
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: '500', padding: '1px 6px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                            {blockTariffs.length} {blockTariffs.length === 1 ? 'artículo' : 'artículos'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: isExpanded ? 'var(--primary)' : 'var(--text-muted)', transition: 'transform 0.2s ease' }}>
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </div>
                      
                      {isExpanded && (
                        <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.1)' }}>
                          {blockTariffs.map(t => {
                            const isEditing = editingTariffId === t.id;
                            if (isEditing) {
                              return (
                                <div className="tariff-edit-card" key={t.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '8px', border: '1px solid var(--primary)', marginBottom: '10px' }}>
                                  <div className="input-group" style={{ marginBottom: 0 }}>
                                    <span className="input-label" style={{ fontSize: '0.75rem' }}>Nombre del Artículo:</span>
                                    <input 
                                      type="text" 
                                      className="form-input" 
                                      value={editTariffName} 
                                      onChange={(e) => setEditTariffName(e.target.value)} 
                                      style={{ padding: '6px 10px', fontSize: '0.85rem' }} 
                                    />
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                      <span className="input-label" style={{ fontSize: '0.75rem' }}>Bloque / Categoría:</span>
                                      <select 
                                        className="form-input" 
                                        value={editTariffBlock} 
                                        onChange={(e) => setEditTariffBlock(e.target.value)} 
                                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                      >
                                        <option value="Paquetería">Paquetería</option>
                                        <option value="Televisores">Televisores</option>
                                        <option value="Instalaciones">Instalaciones</option>
                                        <option value="Barras de Sonido">Barras de Sonido</option>
                                        <option value="Electrodomésticos Varios">Electrodomésticos Varios</option>
                                        <option value="Servicios">Servicios</option>
                                        <option value="Gama Blanca">Gama Blanca</option>
                                        <option value="Muebles">Muebles</option>
                                        <option value="Otros">Otros</option>
                                      </select>
                                    </div>
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                      <span className="input-label" style={{ fontSize: '0.75rem' }}>Tipo:</span>
                                      <select 
                                        className="form-input" 
                                        value={editTariffType} 
                                        onChange={(e) => setEditTariffType(e.target.value)} 
                                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                      >
                                        <option value="fixed">Precio Fijo (€)</option>
                                        <option value="modules">Por Módulos</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="input-group" style={{ marginBottom: 0 }}>
                                    <span className="input-label" style={{ fontSize: '0.75rem' }}>Valor:</span>
                                    <input 
                                      type="number" 
                                      step="0.01" 
                                      className="form-input" 
                                      value={editTariffValue} 
                                      onChange={(e) => setEditTariffValue(e.target.value)} 
                                      style={{ padding: '6px 10px', fontSize: '0.85rem' }} 
                                    />
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '5px' }}>
                                    <button 
                                      type="button" 
                                      className="btn btn-success btn-small" 
                                      onClick={() => handleUpdateTariffDetails(t.id, { name: editTariffName, block: editTariffBlock, type: editTariffType, value: editTariffValue })} 
                                      style={{ margin: 0, padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
                                    >
                                      💾 Guardar
                                    </button>
                                    <button 
                                      type="button" 
                                      className="btn btn-secondary btn-small" 
                                      onClick={() => setEditingTariffId(null)} 
                                      style={{ margin: 0, padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
                                    >
                                      ❌ Cancelar
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            const canDelete = t.id.startsWith('CUSTOM_') || currentUser?.role === 'superadmin';

                            return (
                              <div className="tariff-edit-card" key={t.id}>
                                <div>
                                  <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                    <span>{t.name}</span>
                                    {currentUser?.role === 'superadmin' && (
                                      <span style={{ fontSize: '0.72rem', fontWeight: '500', padding: '1px 6px', borderRadius: '4px', background: !t.createdBy || t.createdBy === 'admin' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(168, 85, 247, 0.15)', color: !t.createdBy || t.createdBy === 'admin' ? '#34d399' : '#e9d5ff', border: !t.createdBy || t.createdBy === 'admin' ? '1px solid rgba(52, 211, 153, 0.25)' : '1px solid rgba(168, 85, 247, 0.25)' }}>
                                        {!t.createdBy || t.createdBy === 'admin' ? 'Original / Base' : `Admin: ${users.find(u => u.id === t.createdBy)?.label || t.createdBy}`}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.type === 'fixed' ? 'Precio Fijo' : `Multiplicador Módulo: ${t.value} módulos`}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--primary)', marginRight: '5px' }}>
                                    {t.value} {t.type === 'fixed' ? '€' : 'mód.'}
                                  </span>
                                  
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      setEditingTariffId(t.id);
                                      setEditTariffName(t.name || '');
                                      setEditTariffBlock(t.block || 'Otros');
                                      setEditTariffType(t.type || 'fixed');
                                      setEditTariffValue(t.value !== undefined && t.value !== null ? t.value.toString() : '0');
                                    }}
                                    className="btn btn-secondary btn-small"
                                    style={{ padding: '6px 8px', margin: 0, display: 'inline-flex', alignItems: 'center', width: 'auto', background: 'rgba(99, 102, 241, 0.12)', color: '#c7d2fe', border: '1px solid rgba(99, 102, 241, 0.3)' }}
                                    title="Editar artículo"
                                  >
                                    ✏️
                                  </button>

                                  {canDelete && (
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
                            );
                          })}
                        </div>
                      )}
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
                        <option value="Barras de Sonido">Barras de Sonido</option>
                        <option value="Electrodomésticos Varios">Electrodomésticos Varios</option>
                        <option value="Servicios">Servicios</option>
                        <option value="Paquetería">Paquetería</option>
                        <option value="Televisores">Televisores</option>
                        <option value="Instalaciones">Instalaciones</option>
                        <option value="Gama Blanca">Gama Blanca</option>
                        <option value="Muebles">Muebles</option>
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
            {localStorage.getItem('delivery_supabase_needs_permissions_col') === 'true' && (
              <div className="glass-panel" style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #f87171',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                color: '#fca5a5',
                fontSize: '0.85rem'
              }}>
                <strong style={{ color: '#ef4444', display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>
                  ⚠️ Acción requerida en Supabase
                </strong>
                Para guardar y sincronizar los permisos de los coordinadores en la nube, debes añadir la columna de permisos a tu tabla de usuarios. 
                Por favor, abre el **SQL Editor** en tu panel de Supabase y ejecuta la siguiente consulta:
                <code style={{
                  display: 'block',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  marginTop: '10px',
                  fontFamily: 'monospace',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  ALTER TABLE delivery_users ADD COLUMN permissions text;
                </code>
              </div>
            )}
            <p style={{ marginBottom: '20px' }}>Personaliza el nombre de tu aplicación y gestiona las cuentas de tus repartidores.</p>

            {/* Ajuste de Nombre de la Aplicación */}
            {showSecurity && (
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
            )}

            {/* Control de Transferencias de Apoyo */}
            {showSecurity && (
              <div className="block-section" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', marginBottom: '30px', textAlign: 'left' }}>
                <div className="block-title">🤝 Auxilio / Apoyo entre Choferes</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                  Activa o desactiva la posibilidad de que los propios choferes se transfieran paradas de apoyo directamente desde sus paneles.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="checkbox" 
                    id="allow_driver_support_transfer" 
                    checked={allowDriverSupportTransfer} 
                    onChange={(e) => {
                      const val = e.target.checked;
                      setAllowDriverSupportTransfer(val);
                      saveAllowDriverSupportTransfer(val);
                      triggerAlert(val ? 'Permiso de transferencia de apoyo activado' : 'Permiso de transferencia de apoyo desactivado');
                    }} 
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <label htmlFor="allow_driver_support_transfer" style={{ fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', userSelect: 'none' }}>
                    Permitir a los repartidores transferir clientes de apoyo entre ellos
                  </label>
                </div>
              </div>
            )}
            


            {/* Gestión de Matrículas */}
            {showStaff && (
              <div className="block-section" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', marginBottom: '30px', textAlign: 'left' }}>
                <div className="block-title">🚐 Gestión de Matrículas (Vehículos)</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                  Registra la lista de matrículas de las furgonetas para llevar un control de qué vehículo se utilizó en cada jornada.
                </p>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newPlateVal}
                    onChange={(e) => setNewPlateVal(e.target.value)}
                    placeholder="Ej: 1234ABC..."
                    style={{ maxWidth: '300px', margin: 0 }}
                  />
                  <button 
                    type="button" 
                    onClick={handleAddPlate}
                    className="btn btn-primary"
                    style={{ margin: 0, whiteSpace: 'nowrap' }}
                  >
                    ➕ Añadir Matrícula
                  </button>
                </div>

                {platesList.length === 0 ? (
                  <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No hay matrículas registradas.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {platesList.map(plate => (
                      <span 
                        key={plate} 
                        className="badge badge-secondary" 
                        style={{ 
                          fontSize: '0.82rem', 
                          padding: '6px 12px', 
                          borderRadius: '20px', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          background: 'rgba(255,255,255,0.05)', 
                          border: '1px solid var(--panel-border)' 
                        }}
                      >
                        🚐 {plate}
                        <button 
                          type="button" 
                          onClick={() => handleRemovePlate(plate)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: '#f87171', 
                            cursor: 'pointer', 
                            fontWeight: 'bold', 
                            fontSize: '0.85rem',
                            padding: 0,
                            lineHeight: 1
                          }}
                          title="Eliminar matrícula"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Puntos de Inicio y Fin de Ruta Predeterminados */}
            {showSecurity && (
              <div className="block-section" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', marginBottom: '30px', textAlign: 'left' }}>
                <div className="block-title">📍 Direcciones de Inicio y Fin de Ruta Predeterminadas</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                  Define las ubicaciones iniciales y finales para la optimización de las rutas de tus choferes. Esto se sincronizará con la base de datos para todo tu equipo.
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="input-label">Ubicación de Salida / Punto de Partida</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                        {routeStartAddr && routeStartAddr.trim() && (
                          <button
                            type="button"
                            onClick={() => handleNavigate(routeStartAddr)}
                            style={{
                              background: 'transparent', border: 'none', color: '#10b981',
                              fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                              fontWeight: 'bold'
                            }}
                            title="Navegar a esta dirección"
                          >
                            🗺️ Navegar
                          </button>
                        )}
                      </div>
                    </div>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Calle Gran Via, Sabadell, Barcelona" 
                      value={routeStartAddr}
                      onChange={(e) => {
                        setRouteStartAddr(e.target.value);
                        handleFetchRouteSuggestions(e.target.value, 'start');
                      }}
                    />
                    {renderRouteSuggestions('start')}
                  </div>
                  <div className="input-group" style={{ marginBottom: 0, position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="input-label">Ubicación de Llegada / Fin de Ruta</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                        {routeEndAddr && routeEndAddr.trim() && (
                          <button
                            type="button"
                            onClick={() => handleNavigate(routeEndAddr)}
                            style={{
                              background: 'transparent', border: 'none', color: '#10b981',
                              fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0,
                              fontWeight: 'bold'
                            }}
                            title="Navegar a esta dirección"
                          >
                            🗺️ Navegar
                          </button>
                        )}
                      </div>
                    </div>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Calle Gran Via, Sabadell, Barcelona" 
                      value={routeEndAddr}
                      onChange={(e) => {
                        setRouteEndAddr(e.target.value);
                        handleFetchRouteSuggestions(e.target.value, 'end');
                      }}
                    />
                    {renderRouteSuggestions('end')}
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
            )}

            {/* API Keys de Proveedores de Mapas */}
            {showSecurity && (
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
            )}

            {/* Conexión a Supabase */}
            {showSecurity && (
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
            )}
            
            {showStaff && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', marginTop: '20px' }}>
                {/* Crear nuevo usuario */}
                <div className="block-section" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)' }}>
                <div className="block-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={18} color="var(--primary)" /> Crear Nuevo Usuario
                </div>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newUsername.trim() || !newLabel.trim() || !newPassword.trim()) {
                    triggerAlert('Por favor rellena todos los campos', 'error');
                    return;
                  }
                  const roleToUse = (currentUser.role === 'superadmin' || currentUser.role === 'admin') ? newRole : 'repartidor';
                  const isUserAdmin = roleToUse === 'admin';
                  
                  let authUid = null;
                  const emailVal = isUserAdmin && newEmailState.trim() ? newEmailState.trim().toLowerCase() : null;
                  
                  if (isUserAdmin && emailVal) {
                    const supabaseClient = getSupabaseClient();
                    if (supabaseClient) {
                      try {
                        const { data: authData, error: authErr } = await supabaseClient.auth.signUp({
                          email: emailVal,
                          password: newPassword.trim(),
                          options: {
                            emailRedirectTo: window.location.origin + window.location.pathname,
                            data: {
                              role: roleToUse,
                              label: newLabel.trim()
                            }
                          }
                        });
                        if (authErr) {
                          triggerAlert(`Nota de registro: ${authErr.message}. El perfil necesitará vincularse en su primer login.`, 'warning');
                        } else if (authData && authData.user) {
                          authUid = authData.user.id;
                        }
                      } catch (err) {
                        console.error("Auth signUp error during user creation:", err);
                      }
                    }
                  }

                  const res = await addUser(newUsername, newLabel, newPassword, roleToUse, currentUser.id, emailVal, authUid);
                  if (res.success) {
                    if (roleToUse === 'admin') {
                      await initializeAdminTariffs(res.user.id, newAdminPricingOption, tariffs);
                    }
                    triggerAlert(`Usuario "${newLabel}" creado correctamente`);
                    setNewUsername('');
                    setNewLabel('');
                    setNewPassword('');
                    setNewRole('repartidor');
                    setNewEmailState('');
                    setNewAdminPricingOption('copy_default');
                    loadData();
                  } else {
                    triggerAlert(res.error, 'error');
                  }
                }} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                  <div className="input-group">
                    <span className="input-label">Usuario (para Login clásico)</span>
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
                  {(currentUser.role === 'superadmin' || currentUser.role === 'admin') && (
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
                  {(currentUser.role === 'superadmin' || currentUser.role === 'admin') && newRole === 'admin' && (
                    <>
                      <div className="input-group">
                        <span className="input-label">Correo Electrónico (Opcional - Para Login Seguro)</span>
                        <input 
                          type="email" 
                          className="form-input" 
                          placeholder="ejemplo@correo.com" 
                          value={newEmailState} 
                          onChange={(e) => setNewEmailState(e.target.value)} 
                        />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Si se deja vacío, el nuevo administrador podrá vincular su correo personal la primera vez que inicie sesión.
                        </span>
                      </div>
                      <div className="input-group">
                        <span className="input-label">Configuración Inicial de Tarifas</span>
                        <select 
                          className="form-input" 
                          value={newAdminPricingOption} 
                          onChange={(e) => setNewAdminPricingOption(e.target.value)}
                          required
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--panel-border)', color: 'var(--text)' }}
                        >
                          <option value="copy_default">Copiar precios de tarifas por defecto</option>
                          <option value="zero">Iniciar precios a 0,00 €</option>
                        </select>
                      </div>
                    </>
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
                          {u.role === 'admin' && (
                            u.email ? (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }} title={u.email}>
                                📧 {u.email}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>
                                ⚠️ Correo sin vincular
                              </span>
                            )
                          )}
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

                        {currentUser.role === 'superadmin' && u.role === 'admin' && u.id !== 'admin' && (
                          <div style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            padding: '12px',
                            marginTop: '5px',
                            marginBottom: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '4px', display: 'block' }}>
                              🛡️ Permisos de Módulos (Coordinador)
                            </span>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                              {[
                                { id: 'report_day', label: '📋 Informe del Día' },
                                { id: 'deliveries_period', label: '📊 Repartos del Período' },
                                { id: 'map_control', label: '🗺️ Mapa de Control' },
                                { id: 'shift_calendar', label: '📅 Calendario de Turnos' },
                                { id: 'general_search', label: '🔍 Buscador General' },
                                { id: 'staff', label: '👤 Personal (Admins/Choferes)' },
                                { id: 'van_pricing', label: '💰 Precios Corte Inglés' },
                                { id: 'security', label: '⚙️ Seguridad / Sistema' }
                              ].map(mod => {
                                let isAllowed = true;
                                if (u.permissions) {
                                  let pObj = u.permissions;
                                  if (typeof pObj === 'string') {
                                    try { pObj = JSON.parse(pObj); } catch(e) { pObj = {}; }
                                  }
                                  isAllowed = pObj[mod.id] !== false;
                                }
                                return (
                                  <label key={mod.id} style={{ fontSize: '0.78rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
                                    <input 
                                      type="checkbox" 
                                      checked={isAllowed} 
                                      onChange={(e) => handleUpdateUserPermissions(u.id, mod.id, e.target.checked)} 
                                    />
                                    {mod.label}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center', marginTop: '5px', width: '100%' }}>
                          {currentUser.role === 'superadmin' && u.id !== 'admin' && u.role === 'repartidor' && (
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
          )}
          </div>
        )}

        {activeTab === 'search' && renderSearchSection()}
        {activeTab === 'changelog' && renderChangelog()}
        {renderDrilldownModal()}
      </div>
    );
  };

  if (!currentUser || emailLinkageUser) {
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
          {forceChangePasswordUser ? (
            <form onSubmit={handleForceChangePasswordSubmit} autoComplete="off" className="glass-panel login-form-panel" style={{ maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <Key size={40} color="var(--primary)" style={{ marginBottom: '10px', display: 'inline-block' }} />
                <h1 className="login-title" style={{ fontWeight: '800', letterSpacing: '-0.03em', margin: 0 }}>Cambiar Contraseña</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px' }}>
                  Es tu primer inicio de sesión. Por motivos de seguridad, debes establecer una contraseña privada.
                </p>
              </div>

              <div className="input-group">
                <span className="input-label">Nueva Contraseña</span>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Mínimo 4 caracteres" 
                  value={newPasswordVal} 
                  onChange={(e) => setNewPasswordVal(e.target.value)} 
                  required 
                  minLength={4}
                  autoComplete="new-password"
                />
              </div>

              <div className="input-group">
                <span className="input-label">Confirmar Contraseña</span>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Repite la contraseña" 
                  value={confirmPasswordVal} 
                  onChange={(e) => setConfirmPasswordVal(e.target.value)} 
                  required 
                  minLength={4}
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
                💾 Guardar Contraseña y Acceder
              </button>

              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setForceChangePasswordUser(null);
                  setNewPasswordVal('');
                  setConfirmPasswordVal('');
                }}
                style={{ marginTop: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
              >
                Cancelar
              </button>
            </form>
          ) : emailLinkageUser ? (
            <form onSubmit={handleEmailLinkageSubmit} autoComplete="off" className="glass-panel login-form-panel" style={{ maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <Mail size={40} color="var(--primary)" style={{ marginBottom: '10px', display: 'inline-block' }} />
                <h1 className="login-title" style={{ fontWeight: '800', letterSpacing: '-0.03em', margin: 0 }}>Vincular Correo</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px' }}>
                  ¡Hola, <strong>{emailLinkageUser.label}</strong>! Para mejorar la seguridad de tu cuenta administrativa, vincula tu correo electrónico personal.
                </p>
              </div>

              {linkageError && (
                <div style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '10px' }}>
                  ⚠️ {linkageError}
                </div>
              )}

              <div className="input-group">
                <span className="input-label">Correo Electrónico Personal</span>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="ejemplo@correo.com" 
                  value={linkageEmail} 
                  onChange={(e) => setLinkageEmail(e.target.value)} 
                  required 
                  autoComplete="email"
                />
              </div>

              <div className="input-group">
                <span className="input-label">Establecer Contraseña de Correo</span>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Mínimo 6 caracteres" 
                  value={linkagePassword} 
                  onChange={(e) => setLinkagePassword(e.target.value)} 
                  required 
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <div className="input-group">
                <span className="input-label">Confirmar Contraseña</span>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Repite la contraseña" 
                  value={linkageConfirmPassword} 
                  onChange={(e) => setLinkageConfirmPassword(e.target.value)} 
                  required 
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={isLinking}>
                {isLinking ? '🔄 Vinculando cuenta...' : '📧 Vincular Cuenta y Acceder'}
              </button>

              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setEmailLinkageUser(null);
                  setLinkageEmail('');
                  setLinkagePassword('');
                  setLinkageConfirmPassword('');
                  setLinkageError('');
                }}
                style={{ marginTop: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
              >
                Cancelar
              </button>
            </form>
          ) : (
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
          )}
        </div>
      </>
    );
  }

  const handleMoveRouteDate = async () => {
    if (!ticketFilterFurgo || ticketFilterFurgo === 'all' || !ticketFilterDate || !newRouteDateInput) {
      triggerAlert('Por favor selecciona una furgoneta, la fecha origen y la nueva fecha de destino.', 'error');
      return;
    }
    if (newRouteDateInput === ticketFilterDate) {
      triggerAlert('La nueva fecha debe ser diferente de la fecha origen.', 'error');
      return;
    }

    setIsMovingRouteDate(true);
    try {
      const result = await moveRouteDate(ticketFilterFurgo, ticketFilterDate, newRouteDateInput);
      triggerAlert(`¡Ruta trasladada! Se cambiaron ${result.ticketsCount} repartos ${result.hasShift ? 'y el turno' : ''} al ${newRouteDateInput}.`);
      
      setTicketFilterDate(newRouteDateInput);
      setShowMoveRouteModal(false);
      loadData();
    } catch (e) {
      console.error(e);
      triggerAlert('Hubo un error al trasladar la ruta.', 'error');
    } finally {
      setIsMovingRouteDate(false);
    }
  };

  const renderMoveRouteModal = () => {
    if (!showMoveRouteModal) return null;
    const label = activeRepartidores.find(r => r.id === ticketFilterFurgo)?.label || ticketFilterFurgo;

    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
        padding: '20px'
      }}>
        <div className="glass-panel" style={{
          width: '100%',
          maxWidth: '400px',
          padding: '25px',
          textAlign: 'left',
          boxShadow: '0 15px 50px rgba(0,0,0,0.6)',
          border: '1px solid var(--panel-border)',
          borderRadius: '16px',
          background: 'rgba(21, 23, 30, 0.95)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📅 Trasladar Fecha de Ruta
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.4' }}>
            Vas a cambiar la fecha de todos los repartos de <strong>{label}</strong> programados el día <strong>{ticketFilterDate}</strong> a una nueva fecha de destino.
          </p>

          <div className="input-group" style={{ marginBottom: '20px' }}>
            <span className="input-label" style={{ fontWeight: '700' }}>Nueva Fecha de Destino:</span>
            <input 
              type="date" 
              className="form-input" 
              value={newRouteDateInput} 
              onChange={(e) => setNewRouteDateInput(e.target.value)} 
              style={{ background: '#1e1e2e', color: '#fff', border: '1px solid var(--panel-border)', width: '100%', padding: '10px', borderRadius: '8px' }}
              disabled={isMovingRouteDate}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '25px' }}>
            <button 
              type="button"
              className="btn btn-primary"
              onClick={handleMoveRouteDate}
              disabled={isMovingRouteDate || !newRouteDateInput}
              style={{ flex: 1, margin: 0, padding: '12px', background: 'var(--success)' }}
            >
              {isMovingRouteDate ? 'Trasladando...' : 'Confirmar Traslado'}
            </button>
            <button 
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowMoveRouteModal(false)}
              disabled={isMovingRouteDate}
              style={{ flex: 0.5, margin: 0, padding: '12px' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        .map-tab-panel {
          text-align: left;
          padding: 20px;
        }

        .map-element {
          height: 100%;
          width: 100%;
          border: none;
          background: #1e1e1e;
          z-index: 1;
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

        @media (max-width: 991px) {
          /* Remove root padding on mobile when map is active for edge-to-edge display */
          body.map-active #root {
            padding: 0 !important;
          }
          /* Re-apply side padding to header, tabs, filter controls, stops list, and legends so they don't touch screen edges */
          body.map-active .app-header {
            padding: 10px 10px 0 10px !important;
          }
          body.map-active .tab-container {
            padding: 0 10px 10px 10px !important;
            margin-bottom: 0 !important;
            border-bottom: 1px solid var(--panel-border);
          }
          .map-filters-container {
            padding: 10px 10px 0 10px !important;
            margin-bottom: 10px !important;
          }
          .map-split-right {
            flex-grow: 1 !important;
            overflow-y: auto !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
            border-top: 1px solid var(--panel-border) !important;
            padding-top: 15px !important;
          }
          .map-legend-container {
            padding-left: 10px !important;
            padding-right: 10px !important;
            margin-bottom: 10px !important;
          }

          .map-tab-panel {
            padding: 0 !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
          }
          .map-tab-title, .map-tab-subtitle {
            display: none !important;
          }
          .map-element {
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .map-split-container {
            display: flex !important;
            flex-direction: column !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            padding: 0 !important;
            height: calc(100vh - 130px) !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: hidden !important;
          }
          .map-split-left {
            height: 40vh !important;
            min-height: 250px !important;
            flex-shrink: 0 !important;
          }
          /* Adjust leaflet control positions on mobile to look neat */
          .leaflet-left .leaflet-control {
            margin-left: 10px !important;
          }
          .leaflet-top .leaflet-control {
            margin-top: 10px !important;
          }
        }

        @media (min-width: 992px) {
          .map-split-container {
            flex-direction: row;
            height: 650px;
            margin: 15px -20px -20px -20px;
            border-top: 1px solid var(--panel-border);
            border-bottom-left-radius: inherit;
            border-bottom-right-radius: inherit;
            overflow: hidden;
            gap: 0;
          }
          
          .map-split-left {
            width: 50% !important;
            height: 100% !important;
          }
          
          .map-split-right {
            width: 50% !important;
            height: 100% !important;
            border-top: none;
            padding: 20px !important;
            border-left: 1px solid var(--panel-border);
            overflow-y: auto;
          }
        }
      `}</style>

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
                background: gpsStatus === 'active' ? 'rgba(52, 211, 153, 0.05)' : gpsStatus === 'error' ? 'rgba(248, 113, 113, 0.05)' : 'rgba(255, 255, 255, 0.02)',
              }}
              onClick={() => {
                setIsTrackingActive(false);
                setTimeout(() => setIsTrackingActive(true), 200);
                triggerAlert('Reconectando GPS y solicitando ubicación...');
              }}
              title={gpsStatus === 'active' ? 'GPS Conectado. Haz clic para refrescar.' : gpsStatus === 'error' ? 'GPS Offline. Haz clic para reconectar.' : 'GPS Apagado'}
            >
              <span style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: gpsStatus === 'active' ? '#34d399' : gpsStatus === 'error' ? '#f87171' : '#9ca3af',
                boxShadow: gpsStatus === 'active' ? '0 0 8px #34d399' : 'none',
                display: 'inline-block'
              }}></span>
              <span style={{ fontSize: '0.78rem', fontWeight: '600', color: gpsStatus === 'active' ? '#34d399' : gpsStatus === 'error' ? '#f87171' : '#9ca3af' }}>
                {gpsStatus === 'active' ? 'GPS' : gpsStatus === 'error' ? 'GPS Offline' : 'GPS Apagado'}
              </span>
            </div>
          )}
          <div className="user-badge" title={`Rol: ${currentUser.role}\nPermisos: ${JSON.stringify(loggedInUserObj?.permissions || {})}`}>
            <User size={14} />
            {currentUser.label}
            {currentUser.role === 'admin' && (
              <span style={{ fontSize: '0.7rem', color: 'var(--primary)', marginLeft: '5px', fontWeight: 'bold' }}>(Coord)</span>
            )}
          </div>
          <button 
            onClick={async () => {
              if (window.confirm('¿Quieres comprobar y forzar la descarga de la última versión de la aplicación?')) {
                try {
                  if ('caches' in window) {
                    const keys = await caches.keys();
                    for (let key of keys) {
                      await caches.delete(key);
                    }
                  }
                  if ('serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (let r of regs) {
                      await r.unregister();
                    }
                  }
                  sessionStorage.clear();
                } catch (e) {
                  console.error("Error al limpiar caché:", e);
                }
                window.location.reload(true);
              }
            }} 
            className="btn btn-secondary btn-small" 
            style={{ width: 'auto', padding: '6px', marginRight: '6px', background: 'rgba(99, 102, 241, 0.15)', borderColor: 'var(--primary)' }}
            title="Forzar actualización de versión"
          >
            🔄 v{changelogData[changelogData.length - 1]?.version || '1.3.1'}
          </button>
          <button onClick={handleLogout} className="btn btn-secondary btn-small" style={{ width: 'auto', padding: '6px' }}><LogOut size={14} /></button>
        </div>
      </header>

      {currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.role === 'coordinador') && !currentUser.email && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--text)',
          padding: '10px 20px',
          textAlign: 'center',
          fontSize: '0.88rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          animation: 'fadeIn 0.3s ease',
          zIndex: 10
        }}>
          <span>⚠️ Tu cuenta administrativa no está vinculada a un correo electrónico seguro para acceder.</span>
          <button 
            onClick={() => setEmailLinkageUser(currentUser)} 
            className="btn btn-primary btn-small" 
            style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem', margin: 0 }}
          >
            📧 Vincular Correo Ahora
          </button>
        </div>
      )}

      {isAdminOrSuper ? renderAdminPortal() : renderDriverPortal()}

      {showShiftModal && (
        <div className="modal-overlay">
          <div className="modal-content shift-summary-receipt" style={{ maxWidth: '450px', padding: '25px', textAlign: 'left' }}>
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
                
                const rawSummary = (existingShift && existingShift.summary && Object.keys(existingShift.summary).length > 0) ? existingShift.summary : getShiftSummary(targetFurgoId, targetDate);
                const summary = rawSummary || {
                  ticketsCount: 0,
                  totalTvs: 0,
                  tvs49: 0,
                  tvs74: 0,
                  tvs115: 0,
                  totalPV: 0,
                  totalGV: 0,
                  totalPM: 0,
                  totalCuelgues: 0,
                  totalVieja: 0,
                  totalOtros: 0,
                  otherDetails: [],
                  totalCODAmount: 0
                };
                
                const dayTickets = tickets.filter(t => t.furgoId === targetFurgoId && t.date === targetDate);
                const routeNameText = existingShift?.routeName || (dayTickets.length > 0 ? dayTickets[0].routeName : '');
                
                return (
                  <>
                    <div><strong>Furgoneta:</strong> {furgoLabel}</div>
                    <div><strong>Fecha:</strong> {targetDate}</div>
                    {routeNameText && <div><strong>Ruta:</strong> <span style={{ color: 'var(--primary)', fontWeight: '600' }}>📍 {routeNameText}</span></div>}
                    {existingShift?.matricula && <div><strong>Vehículo (Matrícula):</strong> <span style={{ color: '#fda4af', fontWeight: '600' }}>🚐 {existingShift.matricula}</span></div>}
                    {existingShift?.helper && <div><strong>Ayudante:</strong> <span style={{ color: '#a5b4fc', fontWeight: '600' }}>🤝 {existingShift.helper}</span></div>}
                    {existingShift?.helper2 && <div><strong>Ayudante 2:</strong> <span style={{ color: '#a5b4fc', fontWeight: '600' }}>🤝 {existingShift.helper2}</span></div>}
                    <div style={{ borderBottom: '1px dashed var(--panel-border)', margin: '5px 0' }}></div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                       <span>Clientes Atendidos:</span>
                       <strong style={{ color: 'var(--primary)' }}>{summary.ticketsCount}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                       <span>TVs Entregadas:</span>
                       <strong>{summary.totalTvs}</strong>
                    </div>
                    {summary.totalTvs > 0 && (
                      <div style={{ 
                        marginLeft: '15px', 
                        paddingLeft: '12px', 
                        fontSize: '0.85rem', 
                        color: 'var(--text-muted)', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '2px', 
                        borderLeft: '2px solid var(--panel-border)', 
                        margin: '2px 0 6px 0' 
                      }}>
                        <div>• Medianas (&le; 49"): <strong>{summary.tvs49 || 0}</strong></div>
                        <div>• Grandes (50" a 74"): <strong>{summary.tvs74 || 0}</strong></div>
                        <div>• Gigantes (75" a 115"): <strong>{summary.tvs115 || 0}</strong></div>
                      </div>
                    )}
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
                    {summary.totalOtros > 0 && summary.otherDetails && summary.otherDetails.length > 0 && (
                      <div style={{ 
                        marginLeft: '15px', 
                        paddingLeft: '12px', 
                        fontSize: '0.85rem', 
                        color: 'var(--text-muted)', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '2px', 
                        borderLeft: '2px solid var(--panel-border)', 
                        margin: '2px 0 6px 0' 
                      }}>
                        {summary.otherDetails.map((det, idx) => (
                          <div key={idx}>• {det.name}: <strong>{det.quantity}</strong></div>
                        ))}
                      </div>
                    )}
                    {summary.totalCODAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--success)', fontWeight: '600' }}>
                         <span>Total Dinero Cobrado:</span>
                         <strong>{summary.totalCODAmount.toFixed(2)} €</strong>
                      </div>
                    )}
                    
                    {/* Sección de Kilometraje en el Resumen */}
                    {existingShift && existingShift.status === 'closed' ? (
                      (() => {
                        const recordedKms = getRouteKms(targetFurgoId, targetDate);
                        if (recordedKms <= 0) return null;
                        return (
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px dashed var(--panel-border)', marginTop: '6px', color: 'var(--primary)', fontWeight: '600' }}>
                            {isAdminOrSuper ? (
                              <>
                                <span>Kilometraje ({recordedKms} km a {kmPrice.toFixed(2)}€/km):</span>
                                <strong>+ {(recordedKms * kmPrice).toFixed(2)} €</strong>
                              </>
                            ) : (
                              <>
                                <span>Kilometraje Recorrido:</span>
                                <strong>{recordedKms} km</strong>
                              </>
                            )}
                          </div>
                        );
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
                        {isAdminOrSuper && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                            <span>Tarifa: {kmPrice.toFixed(2)} €/km</span>
                            <span>Importe: <strong style={{ color: '#fff' }}>{((parseFloat(shiftKmsInput) || 0) * kmPrice).toFixed(2)} €</strong></span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isAdminOrSuper && (() => {
                      const isShiftClosed = existingShift && existingShift.status === 'closed';
                      const billableTickets = dayTickets.filter(t => !isShiftClosed || (t.status === 'success' || !t.status));
                      const totalDeliveryEarnings = billableTickets.reduce((sum, t) => sum + (t.totalPrice || 0), 0);
                      
                      const recordedKms = isShiftClosed ? getRouteKms(targetFurgoId, targetDate) : (parseFloat(shiftKmsInput) || 0);
                      const totalMileageEarnings = recordedKms * kmPrice;
                      const grandTotalEarnings = totalDeliveryEarnings + totalMileageEarnings;
                      
                      return (
                        <div style={{ 
                          background: 'rgba(99, 102, 241, 0.08)', 
                          border: '1px solid rgba(99, 102, 241, 0.3)', 
                          borderRadius: '8px', 
                          padding: '12px', 
                          marginTop: '10px', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '4px' 
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            <span>Ganancia Entregas:</span>
                            <span>{totalDeliveryEarnings.toFixed(2)} €</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            <span>Ganancia Kilometraje:</span>
                            <span>{totalMileageEarnings.toFixed(2)} €</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.98rem', fontWeight: '700', color: 'var(--primary)', borderTop: '1px solid rgba(99, 102, 241, 0.2)', paddingTop: '4px', marginTop: '2px' }}>
                            <span>💰 TOTAL GANADO (DÍA):</span>
                            <span>{grandTotalEarnings.toFixed(2)} €</span>
                          </div>
                        </div>
                      );
                    })()}
                    
                    <div style={{ borderBottom: '1px dashed var(--panel-border)', margin: '10px 0' }}></div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '5px' }}>Clientes y Servicios Realizados:</div>
                    {dayTickets.length === 0 ? (
                      <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay repartos registrados.</div>
                    ) : (
                      <div style={{ maxHeight: '250px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {dayTickets.map((t, idx) => (
                          <div key={t.id} style={{ fontSize: '0.85rem', borderBottom: idx < dayTickets.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: idx < dayTickets.length - 1 ? '8px' : '0' }}>
                            <div style={{ fontWeight: '600', color: '#000' }}>{idx + 1}. {t.customerName}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', marginBottom: '6px' }}>
                              <MapPin size={11} /> {t.address}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {t.tasks && t.tasks.map((task, sIdx) => {
                                const tariff = tariffs.find(tar => tar.id === task.tariffId);
                                const baseName = task.name || (tariff ? tariff.name : task.tariffId);
                                const isTv = tariff && tariff.block === 'Televisores' && task.tariffId !== 'TV_VIEJA_URB' && task.tariffId !== 'TV_VIEJA_NO_URB';
                                const isPaqueteria = tariff && tariff.block === 'Paquetería';
                                
                                let label = baseName;
                                let extra = null;

                                if (isTv) {
                                  // Mostrar marca y pulgadas de la TV
                                  const brand = task.brand && task.brand !== 'Genérica' ? task.brand : null;
                                  const inches = task.inches ? `${task.inches}"` : null;
                                  if (brand || inches) {
                                    extra = [brand, inches].filter(Boolean).join(' ');
                                  }
                                } else if (isPaqueteria) {
                                  // El nombre ya lleva el artículo entre paréntesis, no hace falta extra
                                  label = baseName;
                                }

                                return (
                                  <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)', border: '1px solid rgba(79, 70, 229, 0.15)', borderRadius: '6px', fontWeight: '600' }}>
                                      {label} (x{task.quantity})
                                    </span>
                                    {extra && (
                                      <span style={{ fontSize: '0.7rem', padding: '2px 7px', background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.25)', borderRadius: '6px', fontWeight: '600' }}>
                                        📺 {extra}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {existingShift && existingShift.status === 'closed' && (
                      <div style={{ marginTop: '15px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px' }}>
                        🔒 Cierre realizado el: {new Date(existingShift.closedAt).toLocaleString()}
                      </div>
                    )}

                    {(!existingShift || existingShift.status !== 'closed') && !isAdminOrSuper && (
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

                    <button 
                      type="button" 
                      onClick={() => setShowShiftModal(false)} 
                      className="btn btn-secondary"
                      style={{ width: '100%', marginTop: '15px' }}
                    >
                      Cerrar Resumen
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {obsModalTicketId && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '400px', padding: '25px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '10px', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: obsModalStatus === 'success' ? '#10b981' : '#f87171' }}>
                {obsModalStatus === 'success' ? '🟢 Registrar Entregado' : '🔴 Registrar Fallido'}
              </h3>
              <button onClick={() => { setObsModalTicketId(null); }} className="btn btn-secondary btn-small" style={{ padding: '4px', width: 'auto' }}><X size={16} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {obsModalStatus === 'failed' && (
                <>
                  <div className="input-group">
                    <span className="input-label" style={{ fontWeight: '700' }}>Motivo del Fallo:</span>
                    <select 
                      className="form-input" 
                      value={obsModalFailReason} 
                      onChange={(e) => setObsModalFailReason(e.target.value)}
                      style={{ background: '#1e1e2e', color: '#fff', border: '1px solid var(--panel-border)', width: '100%', padding: '10px', borderRadius: '8px' }}
                    >
                      <option value="Ausente">Ausente / No está en casa</option>
                      <option value="Rechazado">Rechazado por el cliente</option>
                      <option value="No responde">No responde al teléfono</option>
                      <option value="Dirección Incorrecta">Dirección Incorrecta / Incompleta</option>
                      <option value="Otro motivo">Otro motivo</option>
                    </select>
                  </div>

                  {(() => {
                    const pvTariff = tariffs.find(t => t.id === 'ENTREGA_PV');
                    const gvTariff = tariffs.find(t => t.id === 'ENTREGA_GV');
                    const tvSmallTariff = tariffs.find(t => t.id === 'TV_ENT_49');
                    const tvLargeTariff = tariffs.find(t => t.id === 'TV_ENT_74');
                    const pvVal = pvTariff ? pvTariff.value : 3.81;
                    const gvVal = gvTariff ? gvTariff.value : 8.71;
                    const tvSmallVal = tvSmallTariff ? tvSmallTariff.value : 5.23;
                    const tvLargeVal = tvLargeTariff ? tvLargeTariff.value : 12.42;

                    return (
                      <div className="input-group">
                        <span className="input-label" style={{ fontWeight: '700' }}>¿Cobrar intento fallido?:</span>
                        <select 
                          className="form-input" 
                          value={obsModalFailedChargeType} 
                          onChange={(e) => setObsModalFailedChargeType(e.target.value)}
                          style={{ background: '#1e1e2e', color: '#fff', border: '1px solid var(--panel-border)', width: '100%', padding: '10px', borderRadius: '8px' }}
                        >
                          <option value="none">No cobrar (0.00 €)</option>
                          <option value="pv">Cobrar PV ({pvVal.toFixed(2)} €)</option>
                          <option value="gv">Cobrar GV ({gvVal.toFixed(2)} €)</option>
                          <option value="tv_small">Cobrar TV &lt;= 49" ({tvSmallVal.toFixed(2)} €)</option>
                          <option value="tv_large">Cobrar TV 50" a 74" ({tvLargeVal.toFixed(2)} €)</option>
                        </select>
                      </div>
                    );
                  })()}
                </>
              )}

              <div className="input-group">
                <span className="input-label" style={{ fontWeight: '700' }}>Comentarios / Observaciones de la entrega:</span>
                <textarea 
                  className="form-input" 
                  placeholder="Escribe un comentario u observación sobre la entrega (opcional)..." 
                  value={obsModalObservations} 
                  onChange={(e) => setObsModalObservations(e.target.value)}
                  style={{ minHeight: '80px', background: '#1e1e2e', color: '#fff', border: '1px solid var(--panel-border)', width: '100%', padding: '10px', borderRadius: '8px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                <button 
                  type="button"
                  onClick={() => {
                    submitStatusWithObservations();
                  }}
                  className="btn btn-primary"
                  style={{ flex: 1, margin: 0, padding: '12px' }}
                >
                  Guardar
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setObsModalTicketId(null);
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 0.5, margin: 0, padding: '12px' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  handleUpdateTicketStatus(quickFailTicketId, 'failed');
                  setQuickFailTicketId(null);
                }}
                className="btn btn-secondary btn-small"
                style={{ width: '100%', marginBottom: '10px', background: 'rgba(99, 102, 241, 0.15)', borderColor: 'var(--primary)', color: '#fff' }}
              >
                ⚙️ Configurar Cobro / Observaciones
              </button>
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

      {/* Modal de Selección de Navegador GPS */}
      {navModalOpen && navTarget && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2100,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '380px',
            padding: '25px',
            textAlign: 'center',
            boxShadow: '0 15px 50px rgba(0,0,0,0.6)',
            border: '1px solid var(--panel-border)',
            borderRadius: '16px',
            background: 'rgba(21, 23, 30, 0.9)'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              🗺️ Elegir Navegador GPS
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
              ¿Con qué aplicación deseas navegar a la parada?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <button 
                type="button"
                className="btn"
                onClick={() => {
                  if (navRememberChoice) {
                    setDefaultNavigator('google');
                    localStorage.setItem('delivery_default_navigator', 'google');
                  }
                  openInGoogleMaps(navTarget.address, navTarget.latitude, navTarget.longitude);
                  setNavModalOpen(false);
                  setNavTarget(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #4285F4, #34A853)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  boxShadow: '0 4px 15px rgba(66, 133, 244, 0.3)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span style={{ fontSize: '1.4rem' }}>🌐</span> Google Maps
              </button>

              <button 
                type="button"
                className="btn"
                onClick={() => {
                  if (navRememberChoice) {
                    setDefaultNavigator('waze');
                    localStorage.setItem('delivery_default_navigator', 'waze');
                  }
                  openInWaze(navTarget.address, navTarget.latitude, navTarget.longitude);
                  setNavModalOpen(false);
                  setNavTarget(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #33ccff, #0099ff)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  boxShadow: '0 4px 15px rgba(51, 204, 255, 0.3)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span style={{ fontSize: '1.4rem' }}>🚙</span> Waze
              </button>
            </div>

            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              marginBottom: '22px', 
              padding: '8px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <input 
                type="checkbox" 
                id="nav_remember_choice" 
                checked={navRememberChoice} 
                onChange={(e) => setNavRememberChoice(e.target.checked)} 
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="nav_remember_choice" style={{ fontSize: '0.85rem', color: '#c7d2fe', cursor: 'pointer', userSelect: 'none', fontWeight: '500' }}>
                Recordar mi elección siempre
              </label>
            </div>

            <button
              type="button"
              onClick={() => {
                setNavModalOpen(false);
                setNavTarget(null);
              }}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '10px', fontSize: '0.85rem', margin: 0, borderRadius: '8px' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {renderMoveRouteModal()}
    </>
  );
}

export default App;
