// Registers the PWA service worker. Enabled on any HTTPS origin (incl. preview) so the app
// is installable; skipped on localhost dev to avoid caching quirks.
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const { protocol, hostname } = window.location;
  const isLocalhost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname);
  if (protocol !== "https:" || isLocalhost) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}
