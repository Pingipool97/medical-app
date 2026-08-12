import Link from 'next/link';
import { Icon } from '@/components/icons';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { Alert, Badge, Card, EmptyState, PageTitle } from '@/components/ui';
import { OpenConversationButton } from './client';

export const dynamic = 'force-dynamic';

export default async function MessaggiPage() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');
  const patientId = session.patientId;

  const links = await db.doctorPatientLink.findMany({
    where: { patientId, status: 'ACTIVE' },
    include: { doctor: true },
  });
  const conversations = await db.conversation.findMany({
    where: { patientId },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  return (
    <div className="space-y-5">
      <PageTitle
        title="Messaggi"
        subtitle="Scambia messaggi con i medici collegati al tuo profilo."
      />

      <Alert kind="warn">
        I messaggi non sono un canale di urgenza. Per sintomi gravi o improvvisi chiama subito il <strong>112</strong>.
      </Alert>

      {links.length === 0 ? (
        <Card>
          <EmptyState
            title="Non hai medici collegati"
            hint="Per scambiare messaggi devi prima collegarti a un medico."
            action={<Link href="/paziente/medici" className="btn-primary">Trova un medico</Link>}
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {links.map((l) => {
              const conv = conversations.find((c) => c.doctorId === l.doctorId);
              const last = conv?.messages[0];
              const unread = last && last.senderRole === 'DOCTOR' && !last.readAt;
              return (
                <li key={l.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      Dr. {l.doctor.firstName} {l.doctor.lastName}
                      {unread && <Badge color="blue">Nuovo messaggio</Badge>}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">
                      {last
                        ? `${last.senderRole === 'DOCTOR' ? 'Il medico' : 'Tu'}: ${last.body.slice(0, 80)}${last.body.length > 80 ? '…' : ''} · ${fmtDateTime(last.createdAt)}`
                        : 'Nessun messaggio ancora: inizia tu la conversazione.'}
                    </p>
                  </div>
                  {conv ? (
                    <Link href={`/paziente/messaggi/${conv.id}`} className="btn-secondary !py-1.5 text-sm inline-flex items-center gap-1.5">
                      <Icon name="message" className="w-4 h-4" /> Apri conversazione
                    </Link>
                  ) : (
                    <OpenConversationButton patientId={patientId} doctorId={l.doctorId} label="Scrivi al medico" />
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
