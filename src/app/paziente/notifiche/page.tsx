import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { markNotificationsReadAction } from '@/app/actions/communication';
import { Badge, Card, EmptyState, PageTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

function notificationHref(refType: string | null, refId: string | null): string | null {
  if (!refType || !refId) return null;
  switch (refType) {
    case 'Document': return `/paziente/documenti/${refId}`;
    case 'ServiceRequest': return '/paziente/richieste';
    case 'Conversation': return `/paziente/messaggi/${refId}`;
    case 'Appointment': return '/paziente/appuntamenti';
    case 'IssuedDocument': return '/paziente/ricevuti';
    case 'AiOutput': return '/paziente/ricevuti';
    default: return null;
  }
}

export default async function NotifichePage() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');

  const notifications = await db.notification.findMany({
    where: { userId: session.userId, channel: 'INAPP' },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-5">
      <PageTitle
        title="Notifiche"
        subtitle={unread > 0 ? `Hai ${unread} notifich${unread === 1 ? 'a' : 'e'} da leggere.` : 'Nessuna notifica da leggere.'}
        action={
          unread > 0 ? (
            <form action={markNotificationsReadAction}>
              <button type="submit" className="btn-secondary">Segna tutte come lette</button>
            </form>
          ) : undefined
        }
      />

      <Card>
        {notifications.length === 0 ? (
          <EmptyState title="Nessuna notifica" hint="Qui troverai gli avvisi su documenti, richieste, messaggi e appuntamenti." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((n) => {
              const href = notificationHref(n.refType, n.refId);
              return (
                <li key={n.id} className={`py-3 ${!n.readAt ? 'bg-brand-50/60 -mx-4 sm:-mx-5 px-4 sm:px-5' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {n.title} {!n.readAt && <Badge color="blue">Nuova</Badge>}
                      </p>
                      <p className="text-sm text-slate-600 mt-0.5">{n.body}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(n.createdAt)}</p>
                      {href && (
                        <p className="text-sm mt-1">
                          <Link href={href} className="text-brand-700 hover:underline">Vai al dettaglio →</Link>
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
