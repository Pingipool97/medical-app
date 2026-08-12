import { db } from '@/lib/db';
import { fmtDateTime } from '@/lib/format';
import { Alert, AiDisclaimer, Card, EmptyState, BackLink } from '@/components/ui';
import { Icon } from '@/components/icons';
import { loadPatientForDoctor } from '../load';
import { PatientHeader } from '../patient-header';
import { ChatInput } from './chat-client';

export const dynamic = 'force-dynamic';

type Source = { documentId: string; title: string; date: string | null };

export default async function ChatClinicaPage({ params }: { params: { id: string } }) {
  const { session, patient } = await loadPatientForDoctor(params.id, 'AiChat');

  const messages = await db.aiChatMessage.findMany({
    where: { patientId: patient.id, doctorUserId: session.userId },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  return (
    <div className="space-y-5">
      <PatientHeader patient={patient} />
      <BackLink href={`/medico/pazienti/${patient.id}`} label="Torna alla cartella" />

      <Card title="Chat clinica con l’assistente IA">
        <Alert kind="info">
          Le risposte si basano <strong>solo sui documenti che il paziente ha condiviso con te</strong> e sul suo
          diario sanitario: ciò che non è registrato non viene considerato.
        </Alert>

        <div className="mt-4 space-y-3">
          {messages.length === 0 ? (
            <EmptyState title="Nessun messaggio" hint="Fai una domanda sui dati clinici condivisi di questo paziente." />
          ) : (
            messages.map((m) => {
              let sources: Source[] = [];
              try { sources = m.sources ? JSON.parse(m.sources) : []; } catch { sources = []; }
              return (
                <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${m.role === 'user' ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-800'}`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.role === 'assistant' && sources.length > 0 && (
                      <div className="mt-2 border-t border-slate-300/60 pt-2">
                        <p className="text-xs font-semibold text-slate-600">Fonti citate:</p>
                        <ul className="text-xs space-y-0.5">
                          {sources.map((s) => (
                            <li key={s.documentId}>
                              <a href={`/api/documenti/${s.documentId}/file`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline inline-flex items-center gap-1">
                                <Icon name="file" className="w-3.5 h-3.5" /> {s.title}{s.date ? ` (${s.date})` : ''}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className={`text-[10px] mt-1.5 ${m.role === 'user' ? 'text-brand-200' : 'text-slate-500'}`}>{fmtDateTime(m.createdAt)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <ChatInput patientId={patient.id} />
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Copertura: le risposte considerano i documenti condivisi con te e il diario del paziente
          (profilo completo al {patient.profileCompleteness}%). I dati non registrati non sono considerati.
        </p>
        <AiDisclaimer audience="DOCTOR" />
      </Card>
    </div>
  );
}
