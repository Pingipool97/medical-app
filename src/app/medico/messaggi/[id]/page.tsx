import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { Card, EmptyState, PageTitle, BackLink } from '@/components/ui';
import { markDoctorConversationReadAction } from '../../actions';
import { MessageForm } from './message-form';

export const dynamic = 'force-dynamic';

export default async function ThreadPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.doctorId) redirect('/login');

  const conv = await db.conversation.findUnique({
    where: { id: params.id },
    include: { patient: true },
  });
  if (!conv || conv.doctorId !== session.doctorId) redirect('/medico/messaggi');

  // All'apertura, i messaggi del paziente vengono marcati come letti
  await markDoctorConversationReadAction(conv.id);

  const messages = await db.message.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <BackLink href="/medico/messaggi" label="Tutte le conversazioni" />
      <PageTitle
        title={`Conversazione con ${conv.patient.firstName} ${conv.patient.lastName}`}
        action={<Link href={`/medico/pazienti/${conv.patientId}`} className="btn-secondary">Apri cartella</Link>}
      />

      <Card>
        <div className="space-y-3">
          {messages.length === 0 ? (
            <EmptyState title="Nessun messaggio" hint="Scrivi il primo messaggio al paziente." />
          ) : (
            messages.map((m) => {
              const mine = m.senderRole === 'DOCTOR';
              return (
                <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                      mine
                        ? 'bg-brand-700 text-white'
                        : m.redFlag
                          ? 'bg-red-50 border-2 border-red-600 text-red-900'
                          : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {!mine && m.redFlag && (
                      <p className="text-xs font-bold text-red-700 mb-1">⚠️ Possibili sintomi d’allarme — il paziente è stato invitato a chiamare il 112</p>
                    )}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={`text-[10px] mt-1.5 ${mine ? 'text-brand-200' : 'text-slate-500'}`}>
                      {fmtDateTime(m.createdAt)}{mine && m.readAt ? ' · letto' : ''}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <MessageForm conversationId={conv.id} />
        </div>
      </Card>
    </div>
  );
}
