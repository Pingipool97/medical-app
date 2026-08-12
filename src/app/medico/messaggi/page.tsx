import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { Badge, Card, EmptyState, PageTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function MessaggiPage() {
  const session = await getSession();
  if (!session?.doctorId) redirect('/login');
  const doctorId = session.doctorId;

  const conversations = await db.conversation.findMany({
    where: { doctorId },
    include: {
      patient: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Non letti (messaggi del paziente) per conversazione
  const unread = await db.message.groupBy({
    by: ['conversationId'],
    where: { conversation: { doctorId }, senderRole: { not: 'DOCTOR' }, readAt: null },
    _count: { _all: true },
  });
  const unreadMap = new Map(unread.map((u) => [u.conversationId, u._count._all]));

  // Ordina per ultimo messaggio
  const sorted = [...conversations].sort((a, b) => {
    const ta = a.messages[0]?.createdAt.getTime() ?? a.createdAt.getTime();
    const tb = b.messages[0]?.createdAt.getTime() ?? b.createdAt.getTime();
    return tb - ta;
  });

  return (
    <div className="space-y-5">
      <PageTitle title="Messaggi" subtitle="Conversazioni con i tuoi pazienti collegati." />
      <Card>
        {sorted.length === 0 ? (
          <EmptyState title="Nessuna conversazione" hint="Puoi aprire una conversazione dalla cartella di un paziente." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {sorted.map((c) => {
              const last = c.messages[0];
              const n = unreadMap.get(c.id) ?? 0;
              return (
                <li key={c.id}>
                  <Link href={`/medico/messaggi/${c.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50 px-2 -mx-2 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {c.patient.firstName} {c.patient.lastName}
                        {last?.redFlag && last.senderRole !== 'DOCTOR' && <span className="text-red-700 ml-2">⚠️</span>}
                      </p>
                      <p className="text-xs text-slate-500 truncate max-w-md">
                        {last ? `${last.senderRole === 'DOCTOR' ? 'Tu: ' : ''}${last.body}` : 'Nessun messaggio'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {n > 0 && <Badge color="blue">{n} da leggere</Badge>}
                      <span className="text-xs text-slate-400">{last ? fmtDateTime(last.createdAt) : ''}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
