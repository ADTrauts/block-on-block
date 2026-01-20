// Service Worker for Push Notifications
// Increment version to force cache clear after deployment
const CACHE_NAME = 'vssyl-v2';
const STATIC_CACHE = 'static-v2';
const DYNAMIC_CACHE = 'dynamic-v2';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  // Cache files individually to avoid failing if any file doesn't exist
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Only cache files that actually exist
      const filesToCache = [
        '/',
        '/favicon.ico'
        // Note: Add other static assets here as they're created
        // '/notification-badge.png', // Uncomment when file is added
        // '/manifest.json', // Uncomment when file is added
      ];
      
      // Try to cache each file individually, don't fail if some don't exist
      const cachePromises = filesToCache.map(async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            console.log(`✅ Cached: ${url}`);
          } else {
            console.warn(`⚠️ Failed to cache ${url}: ${response.status}`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to cache ${url}:`, error);
          // Don't throw - continue with other files
        }
      });
      
      await Promise.allSettled(cachePromises);
      console.log('✅ Service Worker cache initialization complete');
    }).catch((error) => {
      console.error('Error initializing service worker cache:', error);
      // Don't fail installation if cache fails
    })
  );
  
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('Found caches:', cacheNames);
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete all old caches (v1 and older)
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    }).then(() => {
      console.log('✅ Service Worker cache cleanup complete');
      return self.clients.claim();
    })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/favicon.ico',
      badge: data.badge || '/favicon.ico', // Fallback to favicon if badge doesn't exist
      image: data.image,
      tag: data.tag,
      data: data.data,
      actions: data.actions,
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
      vibrate: [200, 100, 200],
      timestamp: Date.now()
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  const data = event.notification.data;
  const action = event.action;

  // Handle different actions
  if (action === 'mark_read') {
    // Mark notification as read
    if (data && data.notificationId) {
      fetch(`/api/notifications/${data.notificationId}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }).catch(console.error);
    }
  } else if (action === 'view' || !action) {
    // Open the app and navigate to the relevant page
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          // Focus existing window
          clients[0].focus();
          
          // Navigate to notification center or specific page based on data
          if (data && data.type) {
            let url = '/notifications';
            
            // Navigate to specific pages based on notification type
            switch (data.type) {
              case 'chat':
              case 'mentions':
                if (data.data && data.data.conversationId) {
                  url = `/chat/${data.data.conversationId}`;
                }
                break;
              case 'drive':
                if (data.data && data.data.fileId) {
                  url = `/drive/file/${data.data.fileId}`;
                }
                break;
              case 'business':
                if (data.data && data.data.businessId) {
                  url = `/business/${data.data.businessId}`;
                }
                break;
            }
            
            clients[0].postMessage({
              type: 'NAVIGATE',
              url: url
            });
          }
        } else {
          // Open new window
          self.clients.openWindow('/notifications');
        }
      })
    );
  }
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event);
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(
      // Sync any pending notifications
      syncNotifications()
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic background sync:', event);
  
  if (event.tag === 'notification-check') {
    event.waitUntil(
      checkForNewNotifications()
    );
  }
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests - NEVER cache auth endpoints
  if (request.url.includes('/api/')) {
    // Always bypass cache for authentication endpoints
    if (request.url.includes('/api/auth/')) {
      event.respondWith(fetch(request));
      return;
    }
    // For other API requests, try network first but don't cache
    event.respondWith(
      fetch(request).catch(() => {
        // Only return cached response for non-auth API requests if network fails
        return caches.match(request);
      })
    );
    return;
  }

  // Handle static assets
  if (request.destination === 'image' || 
      request.destination === 'script' || 
      request.destination === 'style') {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((fetchResponse) => {
          return caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
    return;
  }

  // For navigation requests, try network first
  event.respondWith(
    fetch(request).then((response) => {
      // Cache successful responses
      if (response.status === 200) {
        const responseClone = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, responseClone);
        });
      }
      return response;
    }).catch(() => {
      // Fallback to cache
      return caches.match(request);
    })
  );
});

// Helper function to sync notifications
async function syncNotifications() {
  try {
    // This would sync any pending notifications
    // Implementation depends on your specific needs
    console.log('Syncing notifications...');
  } catch (error) {
    console.error('Error syncing notifications:', error);
  }
}

// Helper function to check for new notifications
async function checkForNewNotifications() {
  try {
    // This would check for new notifications
    // Implementation depends on your specific needs
    console.log('Checking for new notifications...');
  } catch (error) {
    console.error('Error checking notifications:', error);
  }
}

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); 