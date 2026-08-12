import Link from 'next/link';
import { Icon } from '@/components/icons';

export default function RegisterChoice() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900 text-center">Crea il tuo account</h1>
        <p className="text-slate-600 text-center mt-1">Scegli il tipo di profilo</p>
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          <Link href="/registrazione/paziente" className="card p-6 hover:border-brand-500 transition-colors">
            <Icon name="user" className="w-8 h-8 text-brand-700" />
            <h2 className="font-semibold text-lg mt-2">Sono un paziente</h2>
            <p className="text-sm text-slate-600 mt-1">Gestisci i tuoi referti, la tua timeline sanitaria e comunica con i tuoi medici.</p>
          </Link>
          <Link href="/registrazione/medico" className="card p-6 hover:border-brand-500 transition-colors">
            <Icon name="stethoscope" className="w-8 h-8 text-brand-700" />
            <h2 className="font-semibold text-lg mt-2">Sono un medico</h2>
            <p className="text-sm text-slate-600 mt-1">Cartella intelligente dei tuoi pazienti, agenda, richieste e supporto IA. Richiede verifica dell’iscrizione all’Ordine.</p>
          </Link>
        </div>
        <p className="text-center mt-6 text-sm text-slate-600">
          Hai già un account? <Link href="/login" className="text-brand-700 font-medium hover:underline">Accedi</Link>
        </p>
      </div>
    </div>
  );
}
