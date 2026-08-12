import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { markNotificationsReadAction } from '@/app/actions/communication';
import { Badge, Card, EmptyState, PageTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function NotifichePage() {
  const session = await getSession();
  if (!session?.doctorId) redirect('/login');

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
        subtitle={unread > 0 ? `${unread} notifiche da leggere.` : 'Sei in pari con le notifiche.'}
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
          <EmptyState title="Nessuna notifica" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <li key={n.id} className={`py-3 ${n.readAt ? 'opacity-70' : ''}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800">
                    {n.title} {!n.readAt && <Badge color="blue">Nuova</Badge>}
                  </p>
                  <span className="text-xs text-slate-400">{fmtDateTime(n.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
