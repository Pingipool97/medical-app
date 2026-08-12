import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { REQUEST_STATUS, REQUEST_STATUS_LABEL } from '@/lib/constants';
import { Badge, Card, EmptyState, PageTitle, statusBadgeColor } from '@/components/ui';
import { Icon } from '@/components/icons';
import { RequestActions } from './request-actions';

export const dynamic = 'force-dynamic';

type HistoryStep = { from: string | null; to: string; at: string; note?: string };

export default async function RichiestePage({ searchParams }: { searchParams: { stato?: string; tipo?: string } }) {
  const session = await getSession();
  if (!session?.doctorId) redirect('/login');
  const doctorId = session.doctorId;

  const stato = searchParams.stato && REQUEST_STATUS.includes(searchParams.stato as (typeof REQUEST_STATUS)[number]) ? searchParams.stato : undefined;
  const tipo = searchParams.tipo || undefined;

  const [requests, types] = await Promise.all([
    db.serviceRequest.findMany({
      where: { doctorId, ...(stato ? { status: stato } : {}), ...(tipo ? { typeCode: tipo } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { patient: true },
    }),
    db.requestTypeDef.findMany({ orderBy: { name: 'asc' } }),
  ]);

  // Titoli degli allegati (documenti citati nelle richieste)
  const attachmentIds = Array.from(new Set(requests.flatMap((r) => {
    try { return (JSON.parse(r.attachments ?? '[]') as string[]).filter(Boolean); } catch { return []; }
  })));
  const attachmentDocs = attachmentIds.length
    ? await db.document.findMany({ where: { id: { in: attachmentIds } }, select: { id: true, title: true } })
    : [];
  const docTitle = new Map(attachmentDocs.map((d) => [d.id, d.title]));
  const typeName = new Map(types.map((t) => [t.code, t.name]));

  // Raggruppa per stato, nell'ordine operativo
  const groups = REQUEST_STATUS.map((s) => ({ status: s, items: requests.filter((r) => r.status === s) })).filter((g) => g.items.length > 0);

  const now = Date.now();

  return (
    <div className="space-y-5">
      <PageTitle title="Richieste ricevute" subtitle="Ogni richiesta è un oggetto con stato: prendila in carico, chiedi informazioni, evadila o rifiutala con motivazione." />

      {/* Filtri */}
      <Card>
        <form method="get" className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="label" htmlFor="stato">Stato</label>
            <select id="stato" name="stato" defaultValue={stato ?? ''} className="input !w-auto">
              <option value="">Tutti</option>
              {REQUEST_STATUS.map((s) => <option key={s} value={s}>{REQUEST_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue={tipo ?? ''} className="input !w-auto">
              <option value="">Tutti</option>
              {types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-secondary">Filtra</button>
          {(stato || tipo) && <Link href="/medico/richieste" className="text-sm text-brand-700 hover:underline pb-2.5">Azzera filtri</Link>}
        </form>
      </Card>

      {groups.length === 0 && (
        <Card><EmptyState title="Nessuna richiesta trovata" hint={stato || tipo ? 'Prova ad allargare i filtri.' : 'Le richieste dei tuoi pazienti compariranno qui.'} /></Card>
      )}

      {groups.map((g) => (
        <Card key={g.status} title={`${REQUEST_STATUS_LABEL[g.status]} (${g.items.length})`}>
          <ul className="divide-y divide-slate-200">
            {g.items.map((r) => {
              const open = ['NUOVA', 'PRESA_IN_CARICO', 'ATTESA_INFO'].includes(r.status);
              const deadline = r.slaHours ? new Date(r.createdAt.getTime() + r.slaHours * 3600_000) : null;
              const slaExpired = open && deadline ? now > deadline.getTime() : false;
              const hoursLeft = deadline ? Math.round((deadline.getTime() - now) / 3600_000) : null;
              let attachments: string[] = [];
              try { attachments = (JSON.parse(r.attachments ?? '[]') as string[]).filter(Boolean); } catch { attachments = []; }
              let history: HistoryStep[] = [];
              try { history = JSON.parse(r.history ?? '[]'); } catch { history = []; }

              return (
                <li key={r.id} className="py-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{r.subject}</p>
                      <p className="text-xs text-slate-500">
                        <Link href={`/medico/pazienti/${r.patientId}`} className="text-brand-700 hover:underline">
                          {r.patient.firstName} {r.patient.lastName}
                        </Link>
                        {' · '}{typeName.get(r.typeCode) ?? r.typeCode} · ricevuta il {fmtDateTime(r.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.redFlag && <Badge color="red">⚠️ Sintomi d’allarme</Badge>}
                      {open && r.slaHours && (
                        slaExpired
                          ? <Badge color="red">SLA scaduto ({r.slaHours}h)</Badge>
                          : <Badge color="amber">SLA: {hoursLeft}h rimanenti</Badge>
                      )}
                      <Badge color={statusBadgeColor(r.status)}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
                    </div>
                  </div>

                  {r.redFlag && (
                    <div className="alert-critical !py-2 text-sm" role="alert">
                      In fase di composizione sono stati rilevati possibili sintomi d’allarme: il paziente è stato
                      invitato a chiamare il 112. Valuta con priorità.
                    </div>
                  )}

                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.body}</p>

                  {r.rejectReason && r.status === 'RIFIUTATA' && (
                    <p className="text-sm text-red-800">Motivo del rifiuto: {r.rejectReason}</p>
                  )}

                  {attachments.length > 0 && (
                    <p className="text-sm">
                      Allegati:{' '}
                      {attachments.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ' · '}
                          <a href={`/api/documenti/${id}/file`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline inline-flex items-center gap-1">
                            <Icon name="paperclip" className="w-3.5 h-3.5" /> {docTitle.get(id) ?? 'Documento'}
                          </a>
                        </span>
                      ))}
                    </p>
                  )}

                  {history.length > 0 && (
                    <details className="text-xs text-slate-500">
                      <summary className="cursor-pointer hover:text-slate-700">Storico transizioni ({history.length})</summary>
                      <ul className="mt-1 space-y-0.5 ml-4 list-disc">
                        {history.map((h, i) => (
                          <li key={i}>
                            {h.from ? `${REQUEST_STATUS_LABEL[h.from] ?? h.from} → ` : ''}{REQUEST_STATUS_LABEL[h.to] ?? h.to}
                            {' · '}{fmtDateTime(h.at)}{h.note ? ` — ${h.note}` : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {open && (
                    <div className="flex items-start gap-2 flex-wrap">
                      <RequestActions requestId={r.id} status={r.status} />
                      <Link
                        href={`/medico/pazienti/${r.patientId}/emetti?requestId=${r.id}`}
                        className="btn-secondary !py-1.5 text-xs inline-flex items-center gap-1.5"
                      >
                        <Icon name="pencil" className="w-4 h-4" /> Evadi emettendo un documento
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
