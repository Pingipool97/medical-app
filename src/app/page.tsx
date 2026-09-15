import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Logo } from '@/components/logo';

export default async function Home() {
  const session = await getSession();
  if (session && !session.twoFactorPending) {
    const dest = { PATIENT: '/paziente', CAREGIVER: '/paziente', DOCTOR: '/medico', ADMIN: '/admin', STAFF: '/segreteria' }[session.role];
    if (dest) redirect(dest);
  }
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between max-w-5xl w-full mx-auto">
        <Logo variant="full" className="h-10 w-auto" priority />
        <Link href="/login" className="btn-primary">Accedi</Link>
      </header>

      <main className="flex-1 flex items-center bg-gradient-to-b from-white to-brand-50">
        <div className="max-w-5xl mx-auto px-6 py-12 grid gap-10 md:grid-cols-2 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-brand-950">
              La tua documentazione clinica, finalmente comprensibile.
            </h1>
            <p className="mt-4 text-slate-600 text-lg">
              Carichi i tuoi referti, il sistema li legge e costruisce la tua timeline sanitaria.
              Il tuo professionista li vede, li commenta e ti risponde — tutto in un posto solo, tracciato e cifrato.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/registrazione" className="btn-primary text-base px-6 py-3">Crea il tuo profilo</Link>
              <Link href="/login" className="btn-secondary text-base px-6 py-3">Sono già registrato</Link>
            </div>
            <p className="mt-6 text-sm text-slate-500 flex items-start gap-1.5">
              <span aria-hidden="true">⚠</span>
              <span>Questa piattaforma non è un canale di emergenza. In caso di sintomi gravi chiama il 112.</span>
            </p>
          </div>
          <ul className="space-y-3">
            {[
              ['file', 'Referti letti e strutturati', 'Valori di laboratorio estratti e grafici di andamento nel tempo.'],
              ['stethoscope', 'Il professionista resta al centro', 'Ogni analisi automatica è una bozza che il tuo medico valida prima che tu la veda.'],
              ['shield', 'Dati cifrati e tracciati', 'Ogni accesso ai tuoi dati è registrato e consultabile da te.'],
              ['calendar', 'Agenda e richieste', 'Appuntamenti, ricette e certificati con stato sempre visibile.'],
            ].map(([icon, title, desc]) => (
              <li key={title} className="flex gap-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <span className="shrink-0 w-10 h-10 rounded-lg bg-accent-50 text-accent-700 flex items-center justify-center">
                  <Icon name={icon} className="w-5 h-5" />
                </span>
                <div>
                  <p className="font-semibold text-brand-950">{title}</p>
                  <p className="text-sm text-slate-600 mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>

      <footer className="border-t border-slate-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>HABITUS APP — Fisio·Benessere</span>
          <span className="flex items-center gap-1.5" aria-hidden="true">
            <Icon name="shield" className="w-4 h-4" /> Dati cifrati, accessi tracciati
          </span>
        </div>
      </footer>
    </div>
  );
}
