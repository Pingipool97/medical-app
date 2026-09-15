'use client';

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
export function NavLinks({ items }: { items: { href: string; label: string; icon: string }[] }) {
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
            {item.label}
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
