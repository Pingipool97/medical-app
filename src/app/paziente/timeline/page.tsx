import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { Badge, Card, EmptyState, PageTitle } from '@/components/ui';
import { Icon } from '@/components/icons';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

const TYPE_ICON: Record<string, string> = {
  DOCUMENTO: 'file', MISURAZIONE: 'activity', APPUNTAMENTO: 'calendar', DOCUMENTO_EMESSO: 'inbox', TERAPIA: 'clipboard', NOTA: 'pencil',
};
const TYPE_LABEL: Record<string, string> = {
  DOCUMENTO: 'Documento', MISURAZIONE: 'Misurazione', APPUNTAMENTO: 'Appuntamento',
  DOCUMENTO_EMESSO: 'Documento dal medico', TERAPIA: 'Terapia', NOTA: 'Nota',
};
const MESE = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

function eventHref(refType: string | null, refId: string | null): string | null {
  if (!refType || !refId) return null;
  if (refType === 'Document') return `/paziente/documenti/${refId}`;
  if (refType === 'IssuedDocument') return '/paziente/ricevuti';
  if (refType === 'Appointment') return '/paziente/appuntamenti';
  return null;
}

export default async function TimelinePage({ searchParams }: {
  searchParams: { da?: string; a?: string; tipo?: string; spec?: string; q?: string };
}) {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');
  const patientId = session.patientId;

  const { da = '', a = '', tipo = '', spec = '', q = '' } = searchParams;

  const [specializations, events] = await Promise.all([
    db.specialization.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    db.timelineEvent.findMany({
      where: {
        patientId,
        ...(tipo ? { type: tipo } : {}),
        ...(spec ? { specializationCode: spec } : {}),
        ...(q.trim()
          ? { OR: [{ title: { contains: q.trim() } }, { summary: { contains: q.trim() } }] }
          : {}),
        ...(da || a
          ? { date: { ...(da ? { gte: new Date(da) } : {}), ...(a ? { lte: new Date(a + 'T23:59:59') } : {}) } }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: 500,
    }),
  ]);

  // Raggruppamento per anno → mese
  const groups = new Map<number, Map<number, typeof events>>();
  for (const e of events) {
    const y = e.date.getFullYear();
    const m = e.date.getMonth();
    if (!groups.has(y)) groups.set(y, new Map());
    const months = groups.get(y)!;
    if (!months.has(m)) months.set(m, []);
    months.get(m)!.push(e);
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title="La tua storia clinica"
        subtitle="Tutti gli eventi in ordine di tempo: stampala e portala con te alla prossima visita."
        action={<PrintButton />}
      />

      {/* Filtri (nascosti in stampa) */}
      <Card title="Filtra la timeline" className="print:hidden">
        <form method="get" className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
          <div>
            <label className="label" htmlFor="da">Dal</label>
            <input id="da" name="da" type="date" defaultValue={da} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="a">Al</label>
            <input id="a" name="a" type="date" defaultValue={a} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="tipo">Tipo di evento</label>
            <select id="tipo" name="tipo" defaultValue={tipo} className="input">
              <option value="">Tutti</option>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="spec">Specializzazione</label>
            <select id="spec" name="spec" defaultValue={spec} className="input">
              <option value="">Tutte</option>
              {specializations.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="q">Parola chiave</label>
            <input id="q" name="q" defaultValue={q} placeholder="es. glicemia" className="input" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-secondary flex-1">Filtra</button>
            {(da || a || tipo || spec || q) && <Link href="/paziente/timeline" className="btn-secondary">Azzera</Link>}
          </div>
        </form>
      </Card>

      {events.length === 0 ? (
        <Card>
          <EmptyState
            title="Nessun evento da mostrare"
            hint="Gli eventi compaiono qui man mano che carichi documenti, registri misurazioni e fai visite."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([year, months]) => (
            <section key={year} aria-label={`Anno ${year}`}>
              <h2 className="text-lg font-bold text-slate-900 mb-2">{year}</h2>
              {Array.from(months.entries()).map(([month, list]) => (
                <div key={month} className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-600 mb-2">{MESE[month]} {year}</h3>
                  <ol className="border-l-2 border-slate-200 pl-4 space-y-3">
                    {list.map((e) => {
                      const flags = (() => { try { return JSON.parse(e.flags ?? '{}'); } catch { return {}; } })() as { outOfRange?: boolean; urgent?: boolean; unconfirmed?: boolean };
                      const href = eventHref(e.refType, e.refId);
                      return (
                        <li key={e.id} className="relative">
                          <span aria-hidden className="absolute -left-[23px] top-0.5 bg-white">
                            <Icon name={TYPE_ICON[e.type] ?? 'file'} className="w-4 h-4 text-slate-500" />
                          </span>
                          <div className="card px-3 py-2.5 print:border-0 print:shadow-none print:px-0">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div>
                                <p className="text-sm font-medium text-slate-800">
                                  {href ? <Link href={href} className="text-brand-700 hover:underline">{e.title}</Link> : e.title}
                                </p>
                                {e.summary && <p className="text-xs text-slate-600 mt-0.5">{e.summary}</p>}
                                <p className="text-xs text-slate-400 mt-0.5">{fmtDate(e.date)} · {TYPE_LABEL[e.type] ?? e.type}</p>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                {flags.outOfRange && <Badge color="red">Valori fuori range</Badge>}
                                {flags.urgent && <Badge color="red">Urgente</Badge>}
                                {flags.unconfirmed && <Badge color="amber">Da confermare</Badge>}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
