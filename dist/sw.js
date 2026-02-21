const CACHE_NAME = 'ourdm-v3.0.0';

// Saare static assets aur sounds ko yahan add kiya hai
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/sound/message.mp3',
  '/sound/notification.mp3',
  '/sound/ringtone.mp3',
  '/sound/video_call.mp3'
];

// Install event - Caching assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets and sounds');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - Cleanup old cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        });
      })
  );
});

// Push notifications logic with Logo and Sound
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'New message received',
    icon: '/logo.png', // Aapka logo yahan set kar diya
    badge: '/logo.png',
    vibrate: [200, 100, 200], // Notification vibration
    data: {
      url: data.url || '/'
    },
    // Note: Browser SW se direct custom MP3 play karna limited hai, 
    // isliye vibration aur default sound use hota hai.
    actions: [
      { action: 'open', title: 'Open Ourdm' },
      { action: 'dismiss', title: 'Close' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Ourdm', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(event.notification.data?.url || '/');
      })
  );
});

console.log('Ourdm Service Worker v3.0.0 with Sounds Loaded');