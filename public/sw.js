// Pacific Listing service worker: makes the site installable, caches static
// files for speed, and shows an offline page when there's no connection.
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const IMAGE_CACHE = `images-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") {
    cache.put(request, res.clone());
    if (maxEntries) {
      const keys = await cache.keys();
      if (keys.length > maxEntries) await cache.delete(keys[0]);
    }
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Page navigations: always try the network, fall back to the offline page.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  // Build assets are versioned by filename, so they can be cached forever.
  if (url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  // Listing photos and site images: cache the most recent ones.
  if (request.destination === "image" && (url.pathname.includes("/storage/v1/object/public/") || url.pathname.startsWith("/images/") || url.pathname.startsWith("/_next/image"))) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 200));
  }
});
