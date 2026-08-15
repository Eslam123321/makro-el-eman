/* Service Worker for Makro El-Eman ERP PWA */
const CACHE_NAME = 'makro-eleman-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './sales.html',
  './inventory.html',
  './customers.html',
  './suppliers.html',
  './hr.html',
  './expenses.html',
  './reports.html',
  './users.html',
  './notifications.html',
  './css/main.css',
  './css/components.css',
  './css/modal.css',
  './js/app.js',
  './js/firebase-sync.js',
  './image/logo.png',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA cache addAll error:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Only cache GET requests that are local
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});
