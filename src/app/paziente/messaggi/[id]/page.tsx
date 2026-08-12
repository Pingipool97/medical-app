import Link from 'next/link';
import { Icon } from '@/components/icons';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { Alert, BackLink, Card, PageTitle } from '@/components/ui';
import { markConversationReadAction } from '../../actions';
import { SendMessageForm } from './form';

export const dynamic = 'force-dynamic';

export default async function ConversazionePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');
  const patientId = session.patientId;

  const conv = await db.conversation.findFirst({
    where: { id: params.id, patientId },
    include: { doctor: true },
  });
  if (!conv) notFound();

  // Ricevute di lettura: aprendo la pagina, i messaggi del medico risultano letti
  await markConversationReadAction(conv.id);

  const messages = await db.message.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: 'asc' },
  });

  // Titoli degli allegati citati nei messaggi
  const attachmentIds = Array.from(new Set(messages.flatMap((m) => {
    try { return (JSON.parse(m.attachments ?? '[]') as string[]); } catch { return []; }
  })));
  const attachedDocs = attachmentIds.length
    ? await db.document.findMany({ where: { id: { in: attachmentIds } }, select: { id: true, title: true } })
    : [];
  const docTitle = (id: string) => attachedDocs.find((d) => d.id === id)?.title ?? 'Documento';

  const myDocuments = await db.document.findMany({
    where: { patientId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, title: true },
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <BackLink href="/paziente/messaggi" label="Tutte le conversazioni" />
      <PageTitle title={`Conversazione con Dr. ${conv.doctor.firstName} ${conv.doctor.lastName}`} />

      <Alert kind="warn">
        Non è un canale di urgenza: il medico risponde entro circa {conv.doctor.responseTimeHours} ore.
        Per emergenze chiama il <strong>112</strong>.
      </Alert>

      <Card>
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">Nessun messaggio: scrivi tu il primo.</p>
        ) : (
          <ol className="space-y-3" aria-label="Messaggi della conversazione">
            {messages.map((m) => {
              const mine = m.senderRole !== 'DOCTOR';
              const atts = (() => { try { return JSON.parse(m.attachments ?? '[]') as string[]; } catch { return []; } })();
              return (
                <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-brand-700 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                    <p className={`text-[11px] font-semibold mb-0.5 ${mine ? 'text-brand-100' : 'text-slate-500'}`}>
                      {mine ? 'Tu' : `Dr. ${conv.doctor.lastName}`}
                    </p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {atts.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {atts.map((id) => (
                          <li key={id}>
                            <Link href={`/paziente/documenti/${id}`} className={`text-xs underline inline-flex items-center gap-1 ${mine ? 'text-brand-100' : 'text-brand-700'}`}>
                              <Icon name="paperclip" className="w-3.5 h-3.5" /> {docTitle(id)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className={`text-[10px] mt-1 ${mine ? 'text-brand-200' : 'text-slate-400'}`}>
                      {fmtDateTime(m.createdAt)}
                      {mine && (m.readAt ? ` · Letto ✓✓` : ' · Inviato ✓')}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Card title="Scrivi un messaggio">
        <SendMessageForm
          conversationId={conv.id}
          documents={myDocuments.map((d) => ({ id: d.id, label: d.title }))}
        />
      </Card>
    </div>
  );
}
