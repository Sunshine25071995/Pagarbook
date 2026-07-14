const CACHE_NAME = "sunshine-pagar-book-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/src/main.tsx",
  "/src/App.tsx",
  "/src/index.css",
  "/manifest.json"
];

// Install Service Worker and Cache Assets
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn("Pre-caching some assets failed or skipped in dev mode:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Service Worker and Clean Old Caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Assets from Cache first, then Network
self.addEventListener("fetch", (e) => {
  // Only handle GET requests and skip API calls
  if (e.request.method !== "GET" || e.request.url.includes("/api/")) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }
        // Cache newly fetched assets
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback for offline mode if asset is not in cache
        return caches.match("/");
      });
    })
  );
});

// Handle Push Notifications
self.addEventListener("push", (e) => {
  let data = {};
  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data = { title: "Notification", message: e.data.text() };
    }
  }

  const options = {
    body: data.message || "નવી અપડેટ આવી છે!",
    icon: "/src/assets/images/app_icon_1784013648125.jpg",
    badge: "/src/assets/images/app_icon_1784013648125.jpg",
    vibrate: [100, 50, 100],
    data: {
      url: "/"
    }
  };

  e.waitUntil(
    self.registration.showNotification(data.title || "સનશાઇન પગાર બુક 📚", options)
  );
});

// Handle notification click
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});
