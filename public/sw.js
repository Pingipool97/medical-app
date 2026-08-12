// Service worker — modalità offline lato paziente.
// Strategia: network-first per le pagine (dati sempre freschi quando c'è rete),
// cache-first per gli asset statici. La timeline e i documenti visitati restano
// consultabili offline. I contenuti in cache stanno nel sandbox del browser del
// dispositivo dell'utente; al logout la cache viene svuotata.

const CACHE = 'cartella-v1';
const OFFLINE_PATHS = ['/paziente', '/paziente/timeline', '/paziente/documenti', '/paziente/diario'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('message', (e) => {
  if (e.data === 'logout') caches.delete(CACHE);
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Mai cache per API e admin
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

  const cacheable = url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/paziente') || OFFLINE_PATHS.includes(url.pathname) || url.pathname === '/icon.svg';
  if (!cacheable) return;

  if (url.pathname.startsWith('/_next/static')) {
    // asset immutabili: cache-first
    e.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { c.put(e.request, res.clone()); return res; }))
      )
    );
    return;
  }

  // pagine paziente: network-first con fallback alla cache (offline)
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('/paziente')))
  );
});
