/* PDF Studio service worker — network-first, offline app-shell fallback + Web Share Target.
   Network-first keeps dev hot-reload working while still enabling offline use + installability. */
const CACHE = "pdf-studio-v3";
const SHARE_CACHE = "pdf-share";
const SHELL = ["/", "/app", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];
// Precache the pdf.js worker so recent files render even with no connection.
const EXTRA = ["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(SHELL).catch(() => {});
      await Promise.all(EXTRA.map((u) => cache.add(u).catch(() => {})));
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Stash a shared PDF and bounce the user into the app to open it.
async function handleShare(req) {
  try {
    const form = await req.formData();
    const file = form.get("pdf") || form.get("file");
    if (file && file.size) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        "/__shared_pdf",
        new Response(file, {
          headers: {
            "Content-Type": "application/pdf",
            "X-Filename": encodeURIComponent(file.name || "shared.pdf"),
          },
        })
      );
    }
  } catch (e) {}
  return Response.redirect("/app?shared=1", 303);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Web Share Target: Android shares a PDF into the installed app.
  if (req.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(handleShare(req));
    return;
  }

  if (req.method !== "GET") return;

  const sameOrigin = url.origin === self.location.origin;
  const trustedCDN = /cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|unpkg\.com/.test(url.href);
  if (!sameOrigin && !trustedCDN) return;

  // SPA navigations: network-first, fall back to cached app shell so the app opens offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/index.html").then((r) => r || caches.match("/")))
    );
    return;
  }

  // Everything else: network-first (keeps hot-reload + fresh assets), cache as offline fallback.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && (res.type === "basic" || res.type === "cors")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
