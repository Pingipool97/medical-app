import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { unreadCount } from '@/lib/notify';
import { redirect } from 'next/navigation';
import { LogoutButton, FontSizeToggle, NavLinks, BottomNav } from './shell-client';
import { Logo } from './logo';
import { Icon } from './icons';
import { allowedDemoRoles, isDemoAccount } from '@/lib/demo-access';

// Shell applicativa con navigazione distinta per ruolo: due esperienze davvero diverse,
// non la stessa schermata con pulsanti nascosti. Su mobile: barra inferiore.
// Sidebar chiara: il wordmark HABITUS è navy scuro e su fondo scuro sparirebbe.

const NAV: Record<string, { href: string; label: string; icon: string }[]> = {
  PATIENT: [
    { href: '/paziente', label: 'Home', icon: 'home' },
    { href: '/paziente/appuntamenti', label: 'Appuntamenti', icon: 'calendar' },
    { href: '/paziente/timeline', label: 'Timeline', icon: 'activity' },
    { href: '/paziente/documenti', label: 'Documenti', icon: 'file' },
    { href: '/paziente/diario', label: 'Diario', icon: 'book' },
    { href: '/paziente/richieste', label: 'Richieste', icon: 'inbox' },
    { href: '/paziente/messaggi', label: 'Messaggi', icon: 'message' },
    { href: '/paziente/medici', label: 'I miei medici', icon: 'stethoscope' },
    { href: '/paziente/assistente', label: 'Assistente', icon: 'help' },
    { href: '/paziente/abbonamento', label: 'Abbonamento', icon: 'sparkles' },
    { href: '/paziente/accessi', label: 'Chi ha visto i miei dati', icon: 'shield' },
    { href: '/paziente/impostazioni', label: 'Impostazioni', icon: 'settings' },
  ],
  DOCTOR: [
    { href: '/medico', label: 'Home', icon: 'home' },
    { href: '/medico/agenda', label: 'Agenda', icon: 'calendar' },
    { href: '/medico/pazienti', label: 'Pazienti', icon: 'users' },
    { href: '/medico/richieste', label: 'Richieste', icon: 'inbox' },
    { href: '/medico/messaggi', label: 'Messaggi', icon: 'message' },
    { href: '/medico/whatsapp', label: 'WhatsApp', icon: 'message' },
    { href: '/medico/bozze-ia', label: 'Bozze IA', icon: 'sparkles' },
    { href: '/medico/impostazioni', label: 'Impostazioni', icon: 'settings' },
  ],
  ADMIN: [
    { href: '/admin', label: 'Dashboard', icon: 'chart' },
    { href: '/admin/provider', label: 'Provider e chiavi', icon: 'key' },
    { href: '/admin/ia', label: 'Configurazione IA', icon: 'cpu' },
    { href: '/admin/abbonamenti', label: 'Abbonamenti', icon: 'sparkles' },
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
function DevRoleSwitcher({ current, isDemo }: { current: string; isDemo: boolean }) {
  // Solo dentro un account dimostrativo: a un utente vero questo non va mostrato.
  if (!isDemo) return null;
  const allowed = allowedDemoRoles();
  if (allowed.length === 0) return null;
  const LABEL: Record<string, string> = { PATIENT: 'Paziente', DOCTOR: 'Medico', ADMIN: 'Admin' };
  const roles: [string, string][] = allowed.map((r) => [r, LABEL[r]]);
  const devMode = process.env.DEV_LOGIN === 'true';
  return (
    <div className="px-5 py-3 border-t border-slate-200 bg-amber-50/60">
      <p className="text-[10px] uppercase tracking-wide text-amber-700 mb-1.5 font-semibold">
        {devMode ? 'Vista (solo sviluppo)' : 'Vista dimostrativa'}
      </p>
      <div className="flex gap-1.5">
        {roles.map(([role, label]) => (
          <a key={role} href={`/api/dev-login?role=${role}`}
            className={`text-xs px-2 py-1 rounded ${current === role ? 'bg-brand-700 text-white font-semibold' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}>
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
  // Il passaggio rapido fra i ruoli vale solo per gli account dimostrativi.
  const onDemoAccount = allowedDemoRoles().length > 0 && isDemoAccount(session.email);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-gradient-to-b from-white via-white to-brand-50 border-r border-slate-200 min-h-screen sticky top-0 max-h-screen">
        <div className="px-5 py-4 border-b border-slate-200 surface-brand">
          <Link href={nav[0]?.href ?? '/'} className="block" aria-label="HABITUS — home">
            <Logo variant="full" className="h-9 w-auto" priority />
          </Link>
          <p className="text-xs text-slate-500 mt-2 truncate">{session.displayName}</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5" aria-label="Navigazione principale">
          <NavLinks items={nav} />
        </nav>
        <DevRoleSwitcher current={role} isDemo={onDemoAccount} />
        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between gap-2">
          <FontSizeToggle />
          <LogoutButton />
        </div>
      </aside>

      {/* Header mobile */}
      <header className="lg:hidden sticky top-0 z-20 surface-brand border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
        <Link href={nav[0]?.href ?? '/'} aria-label="HABITUS — home">
          <Logo variant="full" className="h-7 w-auto" priority />
        </Link>
        <div className="flex items-center gap-4 text-slate-600">
          {onDemoAccount && (
            <a href={`/api/dev-login?role=${role === 'PATIENT' ? 'DOCTOR' : 'PATIENT'}`} className="text-xs underline text-amber-700">
              {role === 'PATIENT' ? 'Vista medico' : 'Vista paziente'}
            </a>
          )}
          <Link href={notifHref} aria-label="Notifiche" className="relative hover:text-brand-800">
            <Icon name="bell" className="w-5 h-5" />
            {unread > 0 && <span className="absolute -top-1.5 -right-2 bg-red-600 text-white text-[10px] rounded-full px-1.5">{unread}</span>}
          </Link>
          <LogoutButton compact />
        </div>
      </header>

      <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 pb-24 lg:pb-8 max-w-6xl w-full mx-auto">{children}</main>

      {/* Bottom nav mobile (prime 5 voci) */}
      <BottomNav items={nav.slice(0, 5)} />
    </div>
  );
}
