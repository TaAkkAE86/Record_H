const CACHE = "pulsequest-v2";
const CORE = [
  "./", "./index.html", "./manifest.json", "./icon.svg",
  "./icon-180.png", "./icon-192.png", "./icon-512.png",
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone@7.24.7/babel.min.js"
];

// Slow the decorative animations down and make their pulsing less intense.
// This stylesheet is injected into navigations so the app HTML stays intact.
function softenMotion(response) {
  if (!response || response.type === "opaque") return Promise.resolve(response);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return Promise.resolve(response);

  return response.text().then((html) => {
    if (html.includes("pulsequest-motion-overrides")) {
      return new Response(html, { status: response.status, statusText: response.statusText, headers: response.headers });
    }

    const style = `<style id="pulsequest-motion-overrides">
      .heartbeat { animation-duration: 3s !important; }
      .cta-pulse { animation-duration: 4.5s !important; }
      @keyframes ctaPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(34,211,238,.25), 0 0 24px rgba(168,85,247,.25); }
        50% { box-shadow: 0 0 0 10px rgba(34,211,238,0), 0 0 30px rgba(34,211,238,.35); }
      }
      .float { animation-duration: 5s !important; }
      .exp-fill { animation-duration: 5s !important; }
    </style>`;
    const updatedHtml = html.replace(/<\/head>/i, `${style}</head>`);
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(updatedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  });
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(CORE.map((url) =>
        fetch(url, { mode: url.startsWith("http") ? "no-cors" : "same-origin" })
          .then((res) => cache.put(url, res))
          .catch(() => {})
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit || (e.request.mode === "navigate" ? caches.match("./index.html") : undefined));
      const response = hit || net;
      return e.request.mode === "navigate" ? softenMotion(response) : response;
    })
  );
});
