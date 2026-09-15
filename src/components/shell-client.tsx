'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icons';

export function LogoutButton({ compact }: { compact?: boolean }) {
  return (
    <form action="/api/logout" method="POST">
      <button type="submit" className={compact ? 'text-sm underline' : 'text-sm text-slate-500 hover:text-brand-800 underline'}>
        Esci
      </button>
    </form>
  );
}

// Dimensione testo regolabile (accessibilità utenza anziana)
export function FontSizeToggle() {
  const set = (v: string) => {
    document.documentElement.dataset.fontsize = v;
    try { localStorage.setItem('fontsize', v); } catch {}
  };
  const cls = 'px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 hover:bg-brand-50 hover:text-brand-800';
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Dimensione del testo">
      <button onClick={() => set('normal')} className={`text-xs ${cls}`} aria-label="Testo normale">A</button>
      <button onClick={() => set('large')} className={`text-sm ${cls}`} aria-label="Testo grande">A</button>
      <button onClick={() => set('xlarge')} className={`text-base ${cls}`} aria-label="Testo molto grande">A</button>
    </div>
  );
}

// Navigazione con voce attiva evidenziata: serve il pathname corrente, quindi è client.
// L'attivo è il match più lungo, altrimenti "/medico" resterebbe acceso su ogni sottopagina.
/** Segno che la voce è inclusa nel piano Premium; sparisce quando l'abbonamento è attivo. */
function PremiumMark() {
  return (
    <span
      title="Funzione inclusa nel piano Premium"
      aria-label="Funzione Premium"
      className="ml-auto shrink-0 text-amber-500"
    >
      <Icon name="crown" className="w-4 h-4" />
    </span>
  );
}

export function NavLinks({
  items,
  premiumHrefs = [],
}: {
  items: { href: string; label: string; icon: string }[];
  /** Voci da marcare con la corona: chi ha già il Premium riceve un elenco vuoto. */
  premiumHrefs?: string[];
}) {
  const pathname = usePathname() ?? '';
  const active = items.reduce<string | null>((best, item) => {
    const hit = pathname === item.href || pathname.startsWith(item.href + '/');
    if (!hit) return best;
    return best && best.length >= item.href.length ? best : item.href;
  }, null);

  return (
    <>
      {items.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-brand-50 text-brand-900 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-brand-800'
            }`}
          >
            <Icon name={item.icon} className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-brand-700' : 'text-slate-400'}`} />
            <span className="truncate">{item.label}</span>
            {premiumHrefs.includes(item.href) && <PremiumMark />}
          </Link>
        );
      })}
    </>
  );
}

// Barra inferiore mobile: stesse regole di attivazione, resa compatta.
export function BottomNav({ items }: { items: { href: string; label: string; icon: string }[] }) {
  const pathname = usePathname() ?? '';
  const active = items.reduce<string | null>((best, item) => {
    const hit = pathname === item.href || pathname.startsWith(item.href + '/');
    if (!hit) return best;
    return best && best.length >= item.href.length ? best : item.href;
  }, null);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 flex" aria-label="Navigazione rapida">
      {items.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] ${
              isActive ? 'text-brand-800 font-semibold' : 'text-slate-600 hover:text-brand-700'
            }`}
          >
            <Icon name={item.icon} className="w-5 h-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Menù completo su telefono.
 *
 * La barra in basso mostra solo le prime cinque voci: per il paziente ce ne sono
 * dodici, quindi sette sezioni erano semplicemente irraggiungibili da telefono.
 * Qui c'è l'elenco intero, in un pannello che entra da sinistra.
 */
export function MobileMenu({
  items,
  displayName,
  notifHref,
  premiumHrefs = [],
}: {
  items: { href: string; label: string; icon: string }[];
  displayName: string;
  notifHref: string;
  premiumHrefs?: string[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? '';

  // Il pannello si chiude da solo quando cambia pagina: senza, resterebbe aperto
  // sopra la schermata appena raggiunta.
  useEffect(() => setOpen(false), [pathname]);

  // Con il pannello aperto la pagina sotto non deve scorrere.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const active = items.reduce<string | null>((best, item) => {
    const hit = pathname === item.href || pathname.startsWith(item.href + '/');
    if (!hit) return best;
    return best && best.length >= item.href.length ? best : item.href;
  }, null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Apri il menù"
        aria-expanded={open}
        className="lg:hidden w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white/60"
      >
        <Icon name="menu" className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-900/40"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <nav
            className="h-full w-[17rem] max-w-[85vw] bg-white flex flex-col shadow-xl"
            aria-label="Navigazione completa"
          >
            <div className="surface-brand px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-brand-950 text-sm truncate">{displayName}</p>
                <Link href={notifHref} className="text-xs text-brand-700 hover:underline">Notifiche</Link>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Chiudi il menù"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white/60 shrink-0"
              >
                <Icon name="x" className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
              {items.map((item) => {
                const isActive = item.href === active;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm ${
                      isActive ? 'bg-brand-50 text-brand-900 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon name={item.icon} className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-brand-700' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                    {premiumHrefs.includes(item.href) && <PremiumMark />}
                  </Link>
                );
              })}
            </div>

            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <FontSizeToggle />
              <LogoutButton />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
