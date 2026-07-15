// Self-destruct service worker. The old "SPA at the domain root" setup left a
// root-scoped worker installed in some browsers; it can hijack this static
// marketing page and forward it to /dashboard. This supersedes that worker,
// unregisters it, clears its caches, and reloads so the marketing page shows.
// The product app keeps its own worker under /app/ (separate scope).
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (err) {}
    await self.registration.unregister();
    var cs = await self.clients.matchAll({ type: "window" });
    cs.forEach(function (c) { c.navigate(c.url); });
  })());
});
