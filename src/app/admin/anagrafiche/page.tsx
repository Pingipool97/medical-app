import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { PageTitle } from '@/components/ui';
import { Icon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function AnagraficheHub() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/login');

  const [specs, docTypes, reqTypes, analytes, interactions, contraindications] = await Promise.all([
    db.specialization.count(),
    db.documentTypeDef.count(),
    db.requestTypeDef.count(),
    db.labAnalyte.count(),
    db.drugInteractionRule.count(),
    db.drugContraindication.count(),
  ]);

  const cards = [
    { href: '/admin/anagrafiche/specializzazioni', title: 'Specializzazioni', desc: 'Specializzazioni mediche selezionabili dai medici.', count: specs, icon: 'stethoscope' },
    { href: '/admin/anagrafiche/tipi-documento', title: 'Tipi di documento', desc: 'Classificazione dei documenti caricati (referti, esami, lettere…).', count: docTypes, icon: 'file' },
    { href: '/admin/anagrafiche/tipi-richiesta', title: 'Tipi di richiesta', desc: 'Tipologie di richiesta paziente→medico con SLA di default.', count: reqTypes, icon: 'inbox' },
    { href: '/admin/anagrafiche/analiti', title: 'Analiti di laboratorio', desc: 'Catalogo esami con unità, range di riferimento e sinonimi per il matching.', count: analytes, icon: 'flask' },
    { href: '/admin/anagrafiche/interazioni', title: 'Interazioni farmacologiche', desc: 'Regole deterministiche sostanza-sostanza usate dal motore di controllo.', count: interactions, icon: 'shield' },
    { href: '/admin/anagrafiche/controindicazioni', title: 'Controindicazioni', desc: 'Controindicazioni per gravidanza, allattamento e allergie.', count: contraindications, icon: 'x' },
  ];

  return (
    <>
      <PageTitle title="Anagrafiche" subtitle="Tabelle di sistema che alimentano classificazioni, estrazioni e controlli clinici deterministici." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card p-5 hover:border-brand-400 transition-colors block">
            <div className="mb-2 text-slate-500" aria-hidden><Icon name={c.icon} className="w-6 h-6" /></div>
            <h2 className="font-semibold text-slate-900">{c.title}</h2>
            <p className="text-sm text-slate-600 mt-1">{c.desc}</p>
            <p className="text-xs text-slate-500 mt-3">{c.count} voci</p>
          </Link>
        ))}
      </div>
    </>
  );
}
