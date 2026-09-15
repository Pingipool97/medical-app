'use client';

import { useEffect, useState } from 'react';
import { Icon } from './icons';

// Aggiornamento dell'app installata (PWA).
//
// Prima il service worker chiamava skipWaiting() appena installato: prendeva il posto
// del vecchio, ma la pagina aperta continuava a eseguire il JavaScript già caricato.
// Risultato: l'app installata restava alla versione vecchia finché non la si
// disinstallava e reinstallava.
//
// Ora il service worker nuovo resta in attesa, qui ce ne accorgiamo e lo diciamo:
// l'utente decide quando aggiornare, e solo a quel punto si ricarica. Nessun riavvio
// a sorpresa mentre sta scrivendo qualcosa.

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function PwaUpdater() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // In sviluppo i chunk di Next hanno nomi stabili e la cache servirebbe codice
    // vecchio a ogni modifica: lì il service worker si disinstalla invece di registrarlo.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
      return;
    }

    let reg: ServiceWorkerRegistration | null = null;
    let timer: number | undefined;

    const watch = (r: ServiceWorkerRegistration) => {
      if (r.waiting) setWaiting(r.waiting);
      r.addEventListener('updatefound', () => {
        const nuovo = r.installing;
        if (!nuovo) return;
        nuovo.addEventListener('statechange', () => {
          // "installed" con un controller già presente = c'è una versione nuova pronta.
          // Senza controller è la prima installazione: non c'è niente da annunciare.
          if (nuovo.state === 'installed' && navigator.serviceWorker.controller) setWaiting(nuovo);
        });
      });
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((r) => {
        reg = r;
        watch(r);
        // Un'app installata può restare aperta per giorni: senza un controllo periodico
        // non si accorgerebbe mai di una versione nuova.
        timer = window.setInterval(() => r.update().catch(() => {}), CHECK_INTERVAL_MS);
      })
      .catch(() => {});

    const onVisible = () => {
      if (document.visibilityState === 'visible') reg?.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);

    // Quando il service worker nuovo prende il controllo, la pagina va ricaricata per
    // eseguire il codice aggiornato. Il flag evita il ciclo infinito di ricariche.
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-20 lg:bottom-4 lg:left-auto lg:right-4 lg:w-80 z-40 card p-3 shadow-lg border-brand-200 flex items-center gap-3"
    >
      <span className="shrink-0 w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
        <Icon name="download" className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-brand-950">Nuova versione disponibile</p>
        <p className="text-xs text-slate-500">Aggiorna per usare l’ultima versione dell’app.</p>
      </div>
      <button
        type="button"
        disabled={updating}
        onClick={() => {
          setUpdating(true);
          waiting.postMessage('SKIP_WAITING');
        }}
        className="btn-primary !py-1.5 !px-3 text-xs shrink-0"
      >
        {updating ? 'Aggiorno…' : 'Aggiorna'}
      </button>
    </div>
  );
}
