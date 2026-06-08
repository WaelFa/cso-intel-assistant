// Intentionally empty service worker.
//
// We do not register this file from any code in the app. Some browsers
// (notably Chrome on Android and Lighthouse) automatically probe for
// /sw.js at the site root to check for a PWA manifest. Without this
// file the probe logs a noisy 404 on every page load. Serving an
// install-no-op worker makes the probe succeed without enabling any
// caching, offline, or background-sync behaviour.
//
// If a real PWA is ever needed, replace this with a proper service
// worker and register it explicitly from the app shell.
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
