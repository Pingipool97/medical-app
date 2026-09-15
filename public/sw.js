// Service worker — modalità offline lato paziente.
// Strategia: network-first per le pagine (dati sempre freschi quando c'è rete),
// cache-first per gli asset statici. La timeline e i documenti visitati restano
// consultabili offline. I contenuti in cache stanno nel sandbox del browser del
// dispositivo dell'utente; al logout la cache viene svuotata.

const CACHE = 'habitus-v1';
const OFFLINE_PATHS = ['/paziente', '/paziente/timeline', '/paziente/documenti', '/paziente/diario'];

// Niente skipWaiting automatico: il service worker nuovo resta in attesa finché
// l'utente non sceglie di aggiornare (vedi src/components/pwa-updater.tsx). Prendendo
// il posto del vecchio da solo, la pagina già aperta continuerebbe comunque a eseguire
// il JavaScript vecchio — ed è il motivo per cui l'app installata sembrava non
// aggiornarsi mai.
self.addEventListener('install', () => {});

self.addEventListener('activate', (e) => {
  // Cancella le cache delle versioni precedenti: senza questo, cambiando il nome della
  // cache i contenuti vecchi restano nel browser occupando spazio, e un service worker
  // rimasto attivo continuerebbe a servirli. Vale anche per il rename cartella → habitus.
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'logout') caches.delete(CACHE);
  // L'utente ha premuto "Aggiorna": ora il service worker nuovo può subentrare.
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Mai cache per API e admin
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

  const cacheable = url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/paziente') || OFFLINE_PATHS.includes(url.pathname) || url.pathname.startsWith('/icon-') || url.pathname.startsWith('/logo-habitus');
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
