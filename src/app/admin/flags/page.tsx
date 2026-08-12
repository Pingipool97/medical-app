import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { PageTitle, Alert, Card, EmptyState } from '@/components/ui';
import { FlagRow } from './forms';

export const dynamic = 'force-dynamic';

export default async function FlagsPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/login');

  const flags = await db.featureFlag.findMany({ orderBy: [{ isCdsGate: 'desc' }, { key: 'asc' }] });

  return (
    <>
      <PageTitle title="Feature flag" subtitle="Attivazione controllata delle funzionalità della piattaforma." />

      <div className="mb-4">
        <Alert kind="warn">
          I flag contrassegnati come <strong>gate regolatorio CDS</strong> attivano funzioni di supporto decisionale clinico:
          l&rsquo;attivazione è una scelta regolatoria consapevole (potenziale dispositivo medico, MDR 2017/745), richiede una
          dichiarazione esplicita e viene documentata nell&rsquo;audit log.
        </Alert>
      </div>

      {flags.length === 0 ? (
        <Card>
          <EmptyState title="Nessun feature flag presente" hint="I flag vengono creati dal seed iniziale della piattaforma." />
        </Card>
      ) : (
        <div className="space-y-3">
          {flags.map((f) => (
            <FlagRow key={f.key} flag={{ key: f.key, label: f.label, description: f.description, enabled: f.enabled, isCdsGate: f.isCdsGate }} />
          ))}
        </div>
      )}
    </>
  );
}
