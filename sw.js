const CACHE_NAME = 'meterscan-v1';
const ASSETS = [
  '/meterscan/',
  '/meterscan/index.html',
  '/meterscan/manifest.json',
  '/meterscan/icons/icon-192.png',
  '/meterscan/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap'
];

// Instalación: pre-cachear assets principales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('SW: algunos assets no se pudieron cachear', err);
      });
    })
  );
  self.skipWaiting();
});

// Activación: limpiar caches viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: Cache-first para assets propios, Network-first para Google APIs
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Dejar pasar siempre las peticiones a Google APIs (OAuth, Sheets, Drive)
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('accounts.google.com') ||
    url.hostname.includes('drive.google.com')
  ) {
    return; // fetch normal sin interceptar
  }

  // Para todo lo demás: Cache-first, fallback a red
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Solo cachear respuestas válidas y de nuestro origen o fuentes externas seguras
        if (
          response.ok &&
          (url.origin === self.location.origin ||
            url.hostname.includes('fonts.googleapis.com') ||
            url.hostname.includes('fonts.gstatic.com'))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Sin red y sin cache: devolver index.html para que la app cargue
        if (event.request.destination === 'document') {
          return caches.match('/meterscan/index.html');
        }
      });
    })
  );
});
