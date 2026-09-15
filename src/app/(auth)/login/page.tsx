import Link from 'next/link';
import { Logo } from '@/components/logo';
import LoginForm from './form';

export default function LoginPage() {
  const devMode = process.env.DEV_LOGIN === 'true';
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        <Link href="/" className="flex justify-center" aria-label="HABITUS — home">
          <Logo variant="full" className="h-14 w-auto" priority />
        </Link>
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-bold text-slate-900">Accedi</h1>
          <p className="text-sm text-slate-600 mt-1">Area riservata</p>
          <LoginForm />
        </div>
        {devMode && (
          <div className="card p-5 border-dashed">
            <p className="text-sm font-semibold text-slate-800">Accesso rapido (solo sviluppo)</p>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">Entra con un account demo senza password. Da dentro l’app puoi cambiare vista in ogni momento.</p>
            <div className="flex flex-wrap gap-2">
              <a href="/api/dev-login?role=PATIENT" className="btn-secondary text-sm">Entra come Paziente</a>
              <a href="/api/dev-login?role=DOCTOR" className="btn-secondary text-sm">Entra come Medico</a>
              <a href="/api/dev-login?role=ADMIN" className="btn-secondary text-sm">Entra come Admin</a>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200">
              <p className="text-sm font-semibold text-slate-800">Anteprime</p>
              <p className="text-xs text-slate-500 mt-0.5 mb-2">
                Funzioni non ancora attive, mostrate con dati finti.
              </p>
              <a href="/demo/whatsapp" className="btn-secondary text-sm">WhatsApp con agente IA</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
