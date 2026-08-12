import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDateTime, fmtDate } from '@/lib/format';
import { AI_FUNCTIONS, AI_OUTPUT_STATE_LABEL } from '@/lib/constants';
import { Alert, AiDisclaimer, Badge, Card, PageTitle, statusBadgeColor, BackLink } from '@/components/ui';
import { ReviewForm } from './review-form';
import { Icon } from '@/components/icons';

export const dynamic = 'force-dynamic';

type Source = { documentId: string; title: string; date: string | null };

export default async function RevisioneBozzaPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.doctorId) redirect('/login');

  const output = await db.aiOutput.findUnique({
    where: { id: params.id },
    include: { job: { include: { patient: true } } },
  });
  // Solo le bozze dei propri job
  if (!output || output.job.requestedById !== session.userId) redirect('/medico/bozze-ia');

  const fn = AI_FUNCTIONS.find((f) => f.key === output.job.functionKey);
  let sources: Source[] = [];
  try { sources = output.sources ? JSON.parse(output.sources) : []; } catch { sources = []; }

  const editable = output.state === 'DRAFT' || output.state === 'REVIEWED';

  return (
    <div className="space-y-5">
      <BackLink href="/medico/bozze-ia" label="Coda di revisione" />
      <PageTitle
        title={fn?.label ?? output.job.functionKey}
        subtitle={
          output.job.patient
            ? `Paziente: ${output.job.patient.firstName} ${output.job.patient.lastName} · generata il ${fmtDateTime(output.createdAt)}`
            : `Generata il ${fmtDateTime(output.createdAt)}`
        }
        action={
          output.job.patient ? (
            <Link href={`/medico/pazienti/${output.job.patientId}`} className="btn-secondary">Apri cartella</Link>
          ) : undefined
        }
      />

      {/* Stato attuale ben visibile */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge color={statusBadgeColor(output.state)}>{AI_OUTPUT_STATE_LABEL[output.state] ?? output.state}</Badge>
        <Badge color={output.audience === 'PATIENT' ? 'violet' : 'blue'}>
          Destinatario: {output.audience === 'PATIENT' ? 'paziente' : 'medico'}
        </Badge>
        {output.expiresAt && editable && <Badge color="amber">Scade il {fmtDate(output.expiresAt)}</Badge>}
        {output.reviewedAt && <span className="text-xs text-slate-500">Revisionata il {fmtDateTime(output.reviewedAt)}</span>}
      </div>

      {output.insufficientData && (
        <Alert kind="critical">
          ⚠️ L’IA ha dichiarato esplicitamente di <strong>non avere elementi sufficienti</strong> per questa analisi.
          Valuta con particolare attenzione prima di approvare.
        </Alert>
      )}

      <Card title="Contenuto">
        {editable ? (
          <ReviewForm outputId={output.id} defaultContent={output.contentFinal ?? output.contentDraft} audience={output.audience} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm whitespace-pre-wrap text-slate-800">{output.contentFinal ?? output.contentDraft}</p>
            <Alert kind="info">Questa bozza è già stata gestita ({AI_OUTPUT_STATE_LABEL[output.state] ?? output.state}) e non è più modificabile.</Alert>
          </div>
        )}
        <AiDisclaimer audience={output.audience === 'PATIENT' ? 'PATIENT' : 'DOCTOR'} />
      </Card>

      <Card title="Fonti citate e copertura">
        {sources.length === 0 ? (
          <p className="text-sm text-slate-500">Nessuna fonte documentale citata.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {sources.map((s) => (
              <li key={s.documentId}>
                <a href={`/api/documenti/${s.documentId}/file`} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline inline-flex items-center gap-1">
                  <Icon name="file" className="w-3.5 h-3.5" /> {s.title}{s.date ? ` (${s.date})` : ''}
                </a>
              </li>
            ))}
          </ul>
        )}
        {output.coverageNote && (
          <p className="text-xs text-slate-600 mt-3 border-t border-slate-100 pt-2">
            <strong>Nota di copertura:</strong> {output.coverageNote}
          </p>
        )}
      </Card>
    </div>
  );
}
