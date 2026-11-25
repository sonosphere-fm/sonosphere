const CACHE = "sonosphere-offline-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch(OFFLINE, { credentials: "omit", cache: "reload" });
      if (!response.ok) throw new Error("Offline page unavailable");
      const cache = await caches.open(CACHE);
      await cache.put(OFFLINE, response);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith("sonosphere-offline-") && key !== CACHE).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.mode !== "navigate" || url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/2.0" ||
    url.pathname.startsWith("/2.0/") ||
    url.pathname.startsWith("/1/") ||
    url.pathname.startsWith("/relay/")
  )
    return;
  event.respondWith(
    (async () => {
      try {
        return await fetch(request, { cache: "no-store" });
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match(OFFLINE)) || Response.error();
      }
    })()
  );
});
