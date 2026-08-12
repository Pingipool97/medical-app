import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { AiDisclaimer, Badge, Card, EmptyState, PageTitle } from '@/components/ui';
import { IssuedItem } from './client';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  RICETTA_BIANCA: 'Ricetta bianca',
  PROMEMORIA_NRE: 'Promemoria ricetta dematerializzata',
  RICHIESTA_ESAMI: 'Richiesta di esami / visita',
  CERTIFICATO: 'Certificato',
  PIANO_TERAPEUTICO: 'Piano terapeutico',
  REFERTO_VISITA: 'Referto di visita',
  ISTRUZIONI: 'Istruzioni',
  COMUNICAZIONE: 'Comunicazione di studio',
};

function parseContent(raw: string): { testo: string; nreCode: string | null } {
  try {
    const j = JSON.parse(raw);
    return { testo: String(j.testo ?? ''), nreCode: j.nreCode ? String(j.nreCode) : null };
  } catch {
    return { testo: raw, nreCode: null };
  }
}

export default async function RicevutiPage() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');
  const patientId = session.patientId;

  const [issued, aiOutputs] = await Promise.all([
    db.issuedDocument.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: { doctor: true },
    }),
    db.aiOutput.findMany({
      where: { state: 'PUBLISHED', audience: 'PATIENT', job: { patientId } },
      orderBy: { publishedAt: 'desc' },
      include: { job: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageTitle
        title="Documenti ricevuti"
        subtitle="Ricette, certificati, referti e spiegazioni che il tuo medico ti ha inviato."
      />

      {issued.length === 0 ? (
        <Card>
          <EmptyState
            title="Nessun documento ricevuto"
            hint="Quando il medico ti invierà una ricetta, un certificato o un referto lo troverai qui."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {issued.map((doc) => {
            const content = parseContent(doc.content);
            const signed = doc.signatureStatus !== 'NON_FIRMATO';
            return (
              <IssuedItem
                key={doc.id}
                id={doc.id}
                alreadyRead={!!doc.readAt}
                header={
                  <div>
                    <span className="text-sm font-semibold text-slate-800">{doc.title}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {KIND_LABEL[doc.kind] ?? doc.kind} · Dr. {doc.doctor.firstName} {doc.doctor.lastName} · {fmtDate(doc.createdAt)}
                      {' '}
                      {signed
                        ? <Badge color="green">Firmato digitalmente</Badge>
                        : <Badge color="amber">Non firmato</Badge>}
                    </span>
                  </div>
                }
              >
                <div className="space-y-3">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{content.testo}</p>
                  {content.nreCode && (
                    <p className="text-sm bg-slate-100 rounded-lg px-3 py-2">
                      Codice NRE della ricetta: <strong className="font-mono">{content.nreCode}</strong>
                      <span className="block text-xs text-slate-500 mt-0.5">Presentalo in farmacia insieme alla tessera sanitaria.</span>
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    {signed
                      ? `Firmato digitalmente il ${fmtDateTime(doc.signedAt)}`
                      : 'Questo documento non è firmato digitalmente: per usi che richiedono validità legale chiedi al medico la versione firmata.'}
                  </p>
                </div>
              </IssuedItem>
            );
          })}
        </div>
      )}

      <Card title="Spiegazioni validate dal tuo medico">
        <p className="text-sm text-slate-600 mb-3">
          Spiegazioni in linguaggio semplice, preparate con l’aiuto dell’intelligenza artificiale e sempre controllate e approvate dal tuo medico prima di arrivare a te.
        </p>
        {aiOutputs.length === 0 ? (
          <EmptyState title="Nessuna spiegazione pubblicata" />
        ) : (
          <ul className="space-y-4">
            {aiOutputs.map((o) => (
              <li key={o.id} className="border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-2">Pubblicata il {fmtDate(o.publishedAt)}</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{o.contentFinal ?? o.contentDraft}</p>
                {o.coverageNote && <p className="text-xs text-slate-500 mt-2">{o.coverageNote}</p>}
                <AiDisclaimer audience="PATIENT" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
