// public/sw.js — Custom service worker for Ours PWA
// Handles: push notifications, notification clicks, offline fallback

// ── Offline Fallback ─────────────────────────────────────────────────
const OFFLINE_URL = '/_offline'
const CACHE_NAME = 'ours-offline-v1'

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Pre-cache the offline fallback page so it's available without network
      return cache.add(OFFLINE_URL)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) { return name !== CACHE_NAME })
          .map(function (name) { return caches.delete(name) })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', function (event) {
  // Only handle navigation requests (page loads) — not API calls or assets
  if (event.request.mode !== 'navigate') return

  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match(OFFLINE_URL)
    })
  )
})

// ── Push Notifications ───────────────────────────────────────────────
self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
        url: data.url || '/',
      },
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const urlToOpen = event.notification.data.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      // Check if there is already a window/tab open with the target URL
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i]
        // If so, just focus it.
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      // If not, then open the target URL in a new window/tab.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Import the next-pwa worker if it exists so we keep offline caching
try {
  importScripts('pwa-sw.js')
} catch (e) {
  // next-pwa worker not available (e.g., development mode) — skip silently
}
