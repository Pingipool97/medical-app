import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { REQUEST_STATUS_LABEL } from '@/lib/constants';
import { Alert, Badge, Card, EmptyState, PageTitle, statusBadgeColor } from '@/components/ui';
import { CancelRequestButton } from './client';

export const dynamic = 'force-dynamic';

type HistoryEntry = { from: string | null; to: string; byUserId: string; at: string; note?: string };

const OPEN_STATUSES = ['NUOVA', 'PRESA_IN_CARICO', 'ATTESA_INFO'];

export default async function RichiestePage() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');

  const [requests, types] = await Promise.all([
    db.serviceRequest.findMany({
      where: { patientId: session.patientId },
      orderBy: { createdAt: 'desc' },
      include: { doctor: true },
    }),
    db.requestTypeDef.findMany(),
  ]);
  const typeName = (code: string) => types.find((t) => t.code === code)?.name ?? code;

  return (
    <div className="space-y-5">
      <PageTitle
        title="Le tue richieste"
        subtitle="Ricette, certificati, informazioni: ogni richiesta ha uno stato e non si perde mai."
        action={<Link href="/paziente/richieste/nuova" className="btn-primary">＋ Nuova richiesta</Link>}
      />

      <Alert kind="warn">
        Le richieste non sono un canale di urgenza: il medico risponde nei tempi indicati sul suo profilo.
        Per sintomi gravi o improvvisi chiama subito il <strong>112</strong>.
      </Alert>

      {requests.length === 0 ? (
        <Card>
          <EmptyState
            title="Non hai ancora inviato richieste"
            hint="Puoi chiedere al tuo medico il rinnovo di una ricetta, un certificato o un'informazione."
            action={<Link href="/paziente/richieste/nuova" className="btn-primary">Invia la prima richiesta</Link>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const history = (() => { try { return JSON.parse(r.history ?? '[]') as HistoryEntry[]; } catch { return []; } })();
            return (
              <details key={r.id} className="card">
                <summary className="cursor-pointer select-none px-4 sm:px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-sm font-semibold text-slate-800">{r.subject}</span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        {typeName(r.typeCode)} · Dr. {r.doctor.firstName} {r.doctor.lastName} · {fmtDate(r.createdAt)}
                      </span>
                    </div>
                    <Badge color={statusBadgeColor(r.status)}>{REQUEST_STATUS_LABEL[r.status] ?? r.status}</Badge>
                  </div>
                </summary>
                <div className="px-4 sm:px-5 pb-4 space-y-3 border-t border-slate-100 pt-3">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.body}</p>

                  {r.status === 'RIFIUTATA' && r.rejectReason && (
                    <Alert kind="error">
                      <strong>Motivo del rifiuto:</strong> {r.rejectReason}
                    </Alert>
                  )}
                  {r.status === 'ATTESA_INFO' && (
                    <Alert kind="warn">Il medico attende informazioni da te: puoi scrivergli dai <Link href="/paziente/messaggi" className="underline">Messaggi</Link>.</Alert>
                  )}

                  {history.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 mb-1">Storia della richiesta</h4>
                      <ol className="text-xs text-slate-500 space-y-1">
                        {history.map((h, i) => (
                          <li key={i}>
                            {fmtDateTime(h.at)} — {h.from ? `da "${REQUEST_STATUS_LABEL[h.from] ?? h.from}" a ` : 'creata come '}
                            “{REQUEST_STATUS_LABEL[h.to] ?? h.to}”{h.note ? ` — ${h.note}` : ''}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {OPEN_STATUSES.includes(r.status) && (
                    <div className="pt-1">
                      <CancelRequestButton requestId={r.id} />
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
