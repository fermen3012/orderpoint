// Service Worker para instalación de PWA en OrderPoint (v2 - Safe Network Pass-Through)
const CACHE_NAME = 'orderpoint-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // No interceptar con respondWith(undefined): dejar que el navegador maneje nativamente
  // redirecciones de rutas, Server Actions, RSC y tokens de Supabase sin bloqueos ni pantallas en blanco.
  return;
});

