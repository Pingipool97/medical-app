import LoginForm from './form';

export default function LoginPage() {
  const devMode = process.env.DEV_LOGIN === 'true';
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4">
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-bold text-slate-900">Accedi</h1>
          <p className="text-sm text-slate-600 mt-1">Cartella Intelligente — area riservata</p>
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
          </div>
        )}
      </div>
    </div>
  );
}
