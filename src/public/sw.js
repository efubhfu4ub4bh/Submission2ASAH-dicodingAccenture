const CACHE_NAME = 'story-app-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles/styles.css',
  '/scripts/index.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network First strategy for API, Cache First for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API requests - Network First with fallback to cache
  if (url.origin === 'https://story-api.dicoding.dev') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response before caching
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request);
        })
    );
    return;
  }

  // Static assets - Cache First with network fallback
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });

          return response;
        });
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[SW] Service worker pushing...');
  
  async function chainPromise() {
    try {
      // Parse data from push event
      const data = event.data ? await event.data.json() : null;
      
      // Default notification data
      let title = 'Notifikasi Baru';
      let options = {
        body: 'Ada data baru ditambahkan.',
        icon: '/images/logo-192.png',
        badge: '/images/logo-72.png',
        data: { url: '/' },
        vibrate: [200, 100, 200]
      };
      
      // If server sends structured data
      if (data) {
        title = data.title || title;
        options = {
          body: data.options?.body || data.body || options.body,
          icon: data.options?.icon || data.icon || options.icon,
          badge: data.options?.badge || options.badge,
          image: data.options?.image || data.image,
          data: {
            url: data.options?.data?.url || data.url || options.data.url,
            storyId: data.options?.data?.storyId || data.storyId
          },
          actions: data.options?.actions || [
            { action: 'open', title: 'Lihat Cerita' },
            { action: 'close', title: 'Tutup' }
          ],
          requireInteraction: data.options?.requireInteraction || false,
          vibrate: data.options?.vibrate || options.vibrate
        };
      }
      
      await self.registration.showNotification(title, options);
    } catch (error) {
      console.error('[SW] Error processing push notification:', error);
      // Fallback notification
      await self.registration.showNotification('Notifikasi Baru', {
        body: 'Ada data baru ditambahkan.',
        icon: '/images/logo-192.png'
      });
    }
  }
  
  event.waitUntil(chainPromise());
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Check if there's already a window open
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          // Open new window if no existing window found
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

// Background sync event for offline data
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-stories') {
    event.waitUntil(syncOfflineStories());
  }
});

async function syncOfflineStories() {
  console.log('[SW] Syncing offline stories...');
  // This will be handled by the main app through IndexedDB
  // Send message to all clients to trigger sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_OFFLINE_DATA'
    });
  });
}

// Message event for communication with main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});
