import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { fmtDateTime } from '@/lib/format';
import { Card, Badge, PageTitle, Alert, EmptyState } from '@/components/ui';
import { PublishConsentForm } from './forms';

export const dynamic = 'force-dynamic';

const KINDS = [
  { value: 'PRIVACY', label: 'Informativa privacy' },
  { value: 'ART9_SALUTE', label: 'Consenso trattamento dati sanitari (art. 9 GDPR)' },
  { value: 'TERMINI', label: 'Termini di servizio' },
  { value: 'IA_TRATTAMENTO', label: 'Consenso al trattamento con sistemi IA' },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

export default async function ConsensiPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/login');

  const [versions, accepted, revoked] = await Promise.all([
    db.consentVersion.findMany({ orderBy: [{ kind: 'asc' }, { version: 'desc' }] }),
    db.consentRecord.groupBy({ by: ['consentVersionId'], where: { revokedAt: null }, _count: { _all: true } }),
    db.consentRecord.groupBy({ by: ['consentVersionId'], where: { revokedAt: { not: null } }, _count: { _all: true } }),
  ]);

  const acceptedById = new Map(accepted.map((r) => [r.consentVersionId, r._count._all]));
  const revokedById = new Map(revoked.map((r) => [r.consentVersionId, r._count._all]));

  const byKind = new Map<string, typeof versions>();
  for (const v of versions) {
    const list = byKind.get(v.kind) ?? [];
    list.push(v);
    byKind.set(v.kind, list);
  }

  return (
    <>
      <PageTitle title="Consensi e informative" subtitle="Versioni delle informative con statistiche di accettazione e revoca." />

      <div className="mb-4">
        <Alert kind="info">
          Ogni pubblicazione crea una nuova versione e disattiva la precedente dello stesso tipo. Le accettazioni restano
          legate alla versione effettivamente accettata: valore probatorio, mai sovrascritte.
        </Alert>
      </div>

      <div className="space-y-4">
        {KINDS.map((kind) => {
          const list = byKind.get(kind.value) ?? [];
          return (
            <Card key={kind.value} title={`${kind.label} (${kind.value})`}>
              {list.length === 0 ? (
                <EmptyState title="Nessuna versione pubblicata" hint="Pubblica la prima versione con il modulo in fondo alla pagina." />
              ) : (
                <div className="space-y-3">
                  {list.map((v) => (
                    <details key={v.id} className="border border-slate-200 rounded-lg p-3">
                      <summary className="cursor-pointer text-sm flex flex-wrap items-center gap-2">
                        <span className="font-medium">v{v.version} — {v.title}</span>
                        {v.active ? <Badge color="green">Attiva</Badge> : <Badge color="gray">Storica</Badge>}
                        <span className="text-slate-500">pubblicata il {fmtDateTime(v.publishedAt)}</span>
                        <span className="ml-auto text-slate-600">
                          <Badge color="blue">{acceptedById.get(v.id) ?? 0} accettazioni</Badge>{' '}
                          <Badge color="amber">{revokedById.get(v.id) ?? 0} revoche</Badge>
                        </span>
                      </summary>
                      <div className="mt-3 overflow-x-auto">
                        <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap max-h-72 overflow-y-auto">{v.text}</pre>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </Card>
          );
        })}

        <Card title="Pubblica nuova versione">
          <PublishConsentForm kinds={KINDS} />
        </Card>
      </div>
    </>
  );
}
