'use client';

export function LogoutButton({ compact }: { compact?: boolean }) {
  return (
    <form action="/api/logout" method="POST">
      <button type="submit" className={compact ? 'text-sm underline' : 'text-sm text-brand-200 hover:text-white underline'}>
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
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Dimensione del testo">
      <button onClick={() => set('normal')} className="text-xs px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20" aria-label="Testo normale">A</button>
      <button onClick={() => set('large')} className="text-sm px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20" aria-label="Testo grande">A</button>
      <button onClick={() => set('xlarge')} className="text-base px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20" aria-label="Testo molto grande">A</button>
    </div>
  );
}
