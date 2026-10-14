// Service Worker para instalación de PWA en OrderPoint
const CACHE_NAME = 'orderpoint-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through: Permitir que todas las consultas vayan directamente a la red (Supabase, API, Server Actions)
  // sin bloquear ni cachear respuestas dinámicas
  event.respondWith(
    fetch(event.request).catch(() => {
      // Si la red falla completamente, intentar responder si existe en caché
      return caches.match(event.request);
    })
  );
});
