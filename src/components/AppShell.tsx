import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { unreadCount } from '@/lib/notify';
import { redirect } from 'next/navigation';
import { LogoutButton, FontSizeToggle } from './shell-client';
import { Icon } from './icons';

// Shell applicativa con navigazione distinta per ruolo: due esperienze davvero diverse,
// non la stessa schermata con pulsanti nascosti. Su mobile: barra inferiore.

const NAV: Record<string, { href: string; label: string; icon: string }[]> = {
  PATIENT: [
    { href: '/paziente', label: 'Home', icon: 'home' },
    { href: '/paziente/timeline', label: 'Timeline', icon: 'activity' },
    { href: '/paziente/documenti', label: 'Documenti', icon: 'file' },
    { href: '/paziente/diario', label: 'Diario', icon: 'book' },
    { href: '/paziente/richieste', label: 'Richieste', icon: 'inbox' },
    { href: '/paziente/messaggi', label: 'Messaggi', icon: 'message' },
    { href: '/paziente/appuntamenti', label: 'Appuntamenti', icon: 'calendar' },
    { href: '/paziente/medici', label: 'I miei medici', icon: 'stethoscope' },
    { href: '/paziente/assistente', label: 'Assistente', icon: 'help' },
    { href: '/paziente/accessi', label: 'Chi ha visto i miei dati', icon: 'shield' },
    { href: '/paziente/impostazioni', label: 'Impostazioni', icon: 'settings' },
  ],
  DOCTOR: [
    { href: '/medico', label: 'Home', icon: 'home' },
    { href: '/medico/pazienti', label: 'Pazienti', icon: 'users' },
    { href: '/medico/richieste', label: 'Richieste', icon: 'inbox' },
    { href: '/medico/messaggi', label: 'Messaggi', icon: 'message' },
    { href: '/medico/agenda', label: 'Agenda', icon: 'calendar' },
    { href: '/medico/bozze-ia', label: 'Bozze IA', icon: 'sparkles' },
    { href: '/medico/impostazioni', label: 'Impostazioni', icon: 'settings' },
  ],
  ADMIN: [
    { href: '/admin', label: 'Dashboard', icon: 'chart' },
    { href: '/admin/provider', label: 'Provider e chiavi', icon: 'key' },
    { href: '/admin/ia', label: 'Configurazione IA', icon: 'cpu' },
    { href: '/admin/prompt', label: 'Prompt di sistema', icon: 'pencil' },
    { href: '/admin/template', label: 'Template', icon: 'mail' },
    { href: '/admin/notifiche', label: 'Eventi e canali', icon: 'bell' },
    { href: '/admin/anagrafiche', label: 'Anagrafiche', icon: 'folder' },
    { href: '/admin/utenti', label: 'Utenti', icon: 'users' },
    { href: '/admin/audit', label: 'Audit log', icon: 'search' },
    { href: '/admin/consensi', label: 'Consensi', icon: 'clipboard' },
    { href: '/admin/flags', label: 'Feature flag', icon: 'toggle' },
  ],
  STAFF: [
    { href: '/segreteria', label: 'Agenda', icon: 'calendar' },
  ],
};

// Selettore di ruolo per lo sviluppo: attivo solo con DEV_LOGIN=true in .env.
// Permette di passare da una vista all'altra con un click, senza credenziali.
function DevRoleSwitcher({ current }: { current: string }) {
  if (process.env.DEV_LOGIN !== 'true') return null;
  const roles: [string, string][] = [['PATIENT', 'Paziente'], ['DOCTOR', 'Medico'], ['ADMIN', 'Admin']];
  return (
    <div className="px-5 py-3 border-t border-white/10">
      <p className="text-[10px] uppercase tracking-wide text-brand-300 mb-1.5">Vista (solo sviluppo)</p>
      <div className="flex gap-1.5">
        {roles.map(([role, label]) => (
          <a key={role} href={`/api/dev-login?role=${role}`}
            className={`text-xs px-2 py-1 rounded ${current === role ? 'bg-white text-brand-900 font-semibold' : 'bg-white/10 text-brand-100 hover:bg-white/20'}`}>
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}

export default async function AppShell({ role, children }: { role: string; children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const nav = NAV[role] ?? [];
  const unread = await unreadCount(session.userId);
  const notifHref = role === 'PATIENT' ? '/paziente/notifiche' : role === 'DOCTOR' ? '/medico/notifiche' : role === 'ADMIN' ? '/admin' : '/segreteria';
  const devMode = process.env.DEV_LOGIN === 'true';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-brand-950 text-white min-h-screen sticky top-0 max-h-screen">
        <div className="px-5 py-5 border-b border-white/10">
          <Link href={nav[0]?.href ?? '/'} className="font-bold text-lg">Cartella Intelligente</Link>
          <p className="text-xs text-brand-200 mt-1 truncate">{session.displayName}</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-3" aria-label="Navigazione principale">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 px-5 py-2.5 text-sm text-brand-100 hover:bg-white/10 hover:text-white">
              <Icon name={item.icon} className="w-[18px] h-[18px] shrink-0 opacity-80" /> {item.label}
            </Link>
          ))}
        </nav>
        <DevRoleSwitcher current={role} />
        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-2">
          <FontSizeToggle />
          <LogoutButton />
        </div>
      </aside>

      {/* Header mobile */}
      <header className="lg:hidden sticky top-0 z-20 bg-brand-950 text-white px-4 py-3 flex items-center justify-between">
        <Link href={nav[0]?.href ?? '/'} className="font-bold">Cartella Intelligente</Link>
        <div className="flex items-center gap-4">
          {devMode && (
            <a href={`/api/dev-login?role=${role === 'PATIENT' ? 'DOCTOR' : 'PATIENT'}`} className="text-xs underline text-brand-200">
              {role === 'PATIENT' ? 'Vista medico' : 'Vista paziente'}
            </a>
          )}
          <Link href={notifHref} aria-label="Notifiche" className="relative">
            <Icon name="bell" className="w-5 h-5" />
            {unread > 0 && <span className="absolute -top-1.5 -right-2 bg-red-600 text-white text-[10px] rounded-full px-1.5">{unread}</span>}
          </Link>
          <LogoutButton compact />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 pb-24 lg:pb-8 max-w-6xl w-full mx-auto">{children}</main>

      {/* Bottom nav mobile (prime 5 voci) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 flex" aria-label="Navigazione rapida">
        {nav.slice(0, 5).map((item) => (
          <Link key={item.href} href={item.href} className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] text-slate-600 hover:text-brand-700">
            <Icon name={item.icon} className="w-5 h-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
