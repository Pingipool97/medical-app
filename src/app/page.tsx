import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/icons';

export default async function Home() {
  const session = await getSession();
  if (session && !session.twoFactorPending) {
    const dest = { PATIENT: '/paziente', CAREGIVER: '/paziente', DOCTOR: '/medico', ADMIN: '/admin', STAFF: '/segreteria' }[session.role];
    if (dest) redirect(dest);
  }
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-950 to-brand-800 text-white flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between max-w-5xl w-full mx-auto">
        <span className="font-bold text-lg">Cartella Intelligente</span>
        <Link href="/login" className="btn bg-white text-brand-900 hover:bg-brand-100">Accedi</Link>
      </header>
      <main className="flex-1 flex items-center">
        <div className="max-w-5xl mx-auto px-6 py-12 grid gap-10 md:grid-cols-2 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">La tua documentazione clinica, finalmente comprensibile.</h1>
            <p className="mt-4 text-brand-100 text-lg">
              Carichi i tuoi referti, il sistema li legge e costruisce la tua timeline sanitaria.
              Il tuo medico li vede, li commenta e ti risponde — tutto in un posto solo, tracciato e cifrato.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/registrazione" className="btn bg-white text-brand-900 hover:bg-brand-100 text-base px-6 py-3">Crea il tuo profilo</Link>
              <Link href="/login" className="btn border border-white/40 text-white hover:bg-white/10 text-base px-6 py-3">Sono già registrato</Link>
            </div>
            <p className="mt-6 text-sm text-brand-200">
              ⚠️ Questa piattaforma non è un canale di emergenza. In caso di sintomi gravi chiama il 112.
            </p>
          </div>
          <ul className="space-y-4 text-brand-50">
            {[
              ['file', 'Referti letti e strutturati', 'Valori di laboratorio estratti e grafici di andamento nel tempo.'],
              ['stethoscope', 'Il medico resta al centro', 'Ogni analisi automatica è una bozza che il tuo medico valida prima che tu la veda.'],
              ['shield', 'Dati cifrati e tracciati', 'Ogni accesso ai tuoi dati è registrato e consultabile da te.'],
              ['calendar', 'Prenotazioni e richieste', 'Appuntamenti, ricette e certificati con stato sempre visibile.'],
            ].map(([icon, title, desc]) => (
              <li key={title} className="flex gap-3 bg-white/10 rounded-xl p-4">
                <Icon name={icon} className="w-7 h-7 shrink-0 mt-0.5" />
                <div><p className="font-semibold">{title}</p><p className="text-sm text-brand-100">{desc}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
