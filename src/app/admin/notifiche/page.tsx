import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { NOTIFICATION_EVENTS } from '@/lib/constants';
import { PageTitle, Alert } from '@/components/ui';
import { RuleRow } from './forms';

export const dynamic = 'force-dynamic';

export default async function NotifichePage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/login');

  const rules = await db.notificationRule.findMany();
  const ruleByKey = new Map(rules.map((r) => [r.eventKey, r]));

  // Matrice completa: ogni evento noto compare anche senza regola a DB (creata al salvataggio)
  const rows = NOTIFICATION_EVENTS.map((e) => {
    const rule = ruleByKey.get(e.key);
    let channels: string[] = [];
    if (rule) {
      try {
        channels = (JSON.parse(rule.channels) as string[]).filter((c) => c !== 'INAPP');
      } catch {
        channels = [];
      }
    }
    return { eventKey: e.key, label: rule?.label ?? e.label, channels, enabled: rule?.enabled ?? true };
  });

  return (
    <>
      <PageTitle title="Eventi e canali di notifica" subtitle="Per ogni evento scegli su quali canali inviare le notifiche." />

      <div className="mb-4">
        <Alert kind="info">
          Il canale in-app è sempre attivo. I canali esterni richiedono il provider configurato; senza provider le notifiche
          restano accodate (PENDING). Le comunicazioni esterne non contengono mai contenuto clinico.
        </Alert>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <RuleRow key={r.eventKey} eventKey={r.eventKey} label={r.label} channels={r.channels} enabled={r.enabled} />
        ))}
      </div>
    </>
  );
}
