// sw.js - Service Worker optimizado (Network-First) para recibir actualizaciones al instante
const CACHE_NAME = 'delivery-app-v6';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Forzar la activación del nuevo Service Worker inmediatamente
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    self.clients.claim().then(() => {
      // Eliminar cachés antiguas para liberar espacio y evitar conflictos
      return caches.keys().then((keys) => {
        return Promise.all(
          keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        );
      });
    })
  );
});

self.addEventListener('fetch', (e) => {
  // Ignorar peticiones que no sean GET (como POST o solicitudes a APIs externas como OSM/Supabase que no queremos cachear de forma rígida)
  if (e.request.method !== 'GET') {
    e.respondWith(fetch(e.request));
    return;
  }

  // Para llamadas a APIs externas de geocodificación o Supabase, no cachear de forma agresiva
  if (e.request.url.includes('supabase.co') || e.request.url.includes('openstreetmap.org')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Estrategia Network-First: Intenta red primero, si falla va a la caché.
  // Esto garantiza que si hay internet, el móvil SIEMPRE cargará la versión más nueva de la app al abrirla.
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Si la respuesta es válida, actualizamos la caché en segundo plano
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si no hay internet, cargamos desde la caché
        return caches.match(e.request);
      })
  );
});
