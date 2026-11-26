// Advent Calendar service worker: network first (so updates always arrive),
// with the last good copy as an offline fallback. Never caches the API.
const CACHE = 'advent-shell-v1';
const OFFLINE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#6b1d17;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><div style="font-size:56px">❄️</div><h1 style="font-size:22px">The elves can’t reach the North Pole</h1>
<p style="opacity:.85">Check your internet connection, then pull down to try again.</p></div></body>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Only same-origin GETs (the app itself); Supabase, fonts and maps go straight to the network.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === 'navigate') {
          const shell = await caches.match(new URL('./', self.registration.scope).href);
          return shell ?? new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        return Response.error();
      }),
  );
});
