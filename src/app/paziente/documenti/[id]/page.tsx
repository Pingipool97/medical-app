import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDate, fmtDateTime, fmtBytes } from '@/lib/format';
import { DOC_STATUS_LABEL } from '@/lib/constants';
import { Alert, BackLink, Badge, Card, PageTitle, statusBadgeColor } from '@/components/ui';
import { RetryProcessingButton, ConfirmDateForm, ResolveReviewButtons, LabResultButtons, ShareButtons } from './client';

export const dynamic = 'force-dynamic';

type StepLog = { step: string; ok: boolean; detail?: string; at?: string };

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export default async function DocumentoDettaglio({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');

  const doc = await db.document.findFirst({
    where: { id: params.id, patientId: session.patientId, deletedAt: null },
    include: {
      labResults: { include: { analyte: true }, orderBy: { rawName: 'asc' } },
      jobs: { orderBy: { createdAt: 'desc' }, take: 1 },
      sharedWith: true,
    },
  });
  if (!doc) notFound();

  const [docType, links] = await Promise.all([
    db.documentTypeDef.findUnique({ where: { code: doc.docTypeCode } }),
    db.doctorPatientLink.findMany({
      where: { patientId: session.patientId, status: 'ACTIVE' },
      include: { doctor: true },
    }),
  ]);

  const job = doc.jobs[0];
  const steps = parseJson<StepLog[]>(job?.stepsLog, []);
  const extracted = parseJson<{ dataEstratta?: string }>(doc.extractedData, {});
  const suggestedDate = doc.docDate
    ? doc.docDate.toISOString().slice(0, 10)
    : extracted.dataEstratta && !isNaN(new Date(extracted.dataEstratta).getTime())
      ? new Date(extracted.dataEstratta).toISOString().slice(0, 10)
      : '';
  const isImage = doc.mimeType.startsWith('image/');
  const fileUrl = `/api/documenti/${doc.id}/file`;

  return (
    <div className="space-y-5">
      <BackLink href="/paziente/documenti" label="Torna ai documenti" />
      <PageTitle
        title={doc.title}
        subtitle={`${docType?.name ?? doc.docTypeCode} · ${doc.docDate ? fmtDate(doc.docDate) : 'data da confermare'} · ${fmtBytes(doc.fileSize)}`}
        action={<Badge color={statusBadgeColor(doc.status)}>{DOC_STATUS_LABEL[doc.status] ?? doc.status}</Badge>}
      />

      {/* Quarantena intestatario */}
      {doc.status === 'QUARANTINED' && (
        <div className="alert-critical" role="alert">
          <p className="font-semibold">⚠️ Documento in quarantena: serve una verifica</p>
          <p className="text-sm mt-1">
            {doc.quarantineReason
              ? `Motivo: ${doc.quarantineReason}`
              : 'Il documento sembra intestato a un’altra persona.'}
            {' '}Per la tua sicurezza il documento non viene usato nelle analisi finché la situazione non è chiarita. Se pensi sia un errore, contatta l’assistenza o il tuo medico.
          </p>
        </div>
      )}

      {/* Possibile duplicato */}
      {(doc.status === 'NEEDS_REVIEW' || doc.duplicateOfId) && doc.status !== 'QUARANTINED' && (
        <Alert kind="warn">
          <p className="font-semibold">Questo documento sembra un duplicato di uno già caricato.</p>
          <p className="text-sm mt-1 mb-3">Controlla l’anteprima qui sotto e dicci cosa fare.</p>
          <ResolveReviewButtons documentId={doc.id} />
        </Alert>
      )}

      {/* Data da confermare */}
      {!doc.dateConfirmed && doc.status !== 'QUARANTINED' && (
        <Card title="Conferma la data del documento">
          <p className="text-sm text-slate-600 mb-3">
            {suggestedDate
              ? 'Abbiamo trovato questa data nel documento: controlla che sia giusta e confermala.'
              : 'Non siamo riusciti a trovare la data nel documento: inseriscila tu, serve a ordinare la tua storia clinica.'}
          </p>
          <ConfirmDateForm documentId={doc.id} suggested={suggestedDate} />
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Anteprima */}
        <Card title="Anteprima del documento">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl} alt={`Anteprima del documento ${doc.title}`} className="max-w-full rounded-lg border border-slate-200" />
          ) : (
            <iframe src={fileUrl} title={`Anteprima del documento ${doc.title}`} className="w-full h-[480px] rounded-lg border border-slate-200" />
          )}
          <p className="text-sm mt-3">
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
              Apri il file in una nuova scheda →
            </a>
          </p>
        </Card>

        {/* Stato elaborazione */}
        <Card title="Stato dell'elaborazione">
          <p className="text-sm text-slate-600 mb-3">
            Quando carichi un documento lo leggiamo automaticamente per estrarre i dati importanti. Ecco come è andata:
          </p>
          {steps.length === 0 ? (
            <p className="text-sm text-slate-500">
              {doc.status === 'UPLOADED' || doc.status === 'PROCESSING'
                ? 'Elaborazione in corso… ricarica la pagina tra qualche istante.'
                : 'Nessun dettaglio disponibile sull’elaborazione.'}
            </p>
          ) : (
            <ol className="space-y-1.5">
              {steps.map((s, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span aria-hidden className={s.ok ? 'text-emerald-600' : 'text-red-600'}>{s.ok ? '✓' : '✗'}</span>
                  <span className={s.ok ? 'text-slate-700' : 'text-red-800'}>
                    <span className="sr-only">{s.ok ? 'Riuscito:' : 'Fallito:'}</span>
                    {s.step}{s.detail ? ` — ${s.detail}` : ''}
                    {s.at && <span className="text-xs text-slate-400"> ({fmtDateTime(s.at)})</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {doc.extractionQuality && (
            <p className="text-sm text-slate-600 mt-3">
              Qualità della lettura: <strong>{doc.extractionQuality === 'COMPLETA' ? 'completa' : doc.extractionQuality === 'PARZIALE' ? 'parziale' : 'non leggibile'}</strong>
            </p>
          )}
          {doc.status === 'FAILED' && (
            <div className="mt-4">
              <Alert kind="error">L’elaborazione non è riuscita. Il documento resta comunque salvato: puoi riprovare quando vuoi.</Alert>
              <div className="mt-3"><RetryProcessingButton documentId={doc.id} /></div>
            </div>
          )}
        </Card>
      </div>

      {/* Valori di laboratorio estratti */}
      {doc.labResults.length > 0 && (
        <Card title="Valori trovati nel documento">
          <p className="text-sm text-slate-600 mb-3">
            Questi valori sono stati letti automaticamente: quelli con l’etichetta “da confermare” vanno controllati confrontandoli con il documento.
            I valori <span className="text-red-700 font-semibold">fuori dai valori di riferimento</span> sono evidenziati in rosso.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Esame</th>
                  <th className="py-2 pr-3">Valore</th>
                  <th className="py-2 pr-3">Valori di riferimento</th>
                  <th className="py-2 pr-3">Stato</th>
                  <th className="py-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {doc.labResults.map((r) => {
                  const low = r.refLow ?? r.analyte?.refLow;
                  const high = r.refHigh ?? r.analyte?.refHigh;
                  return (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-800">{r.analyte?.name ?? r.rawName}</td>
                      <td className={`py-2 pr-3 ${r.outOfRange ? 'text-red-700 font-bold' : 'text-slate-800'}`}>
                        {r.value} {r.unit ?? r.analyte?.unit ?? ''}
                        {r.outOfRange && <span className="ml-1" title="Fuori dai valori di riferimento">⚠️ fuori range</span>}
                      </td>
                      <td className="py-2 pr-3 text-slate-500">
                        {low != null || high != null ? `${low ?? '—'} – ${high ?? '—'}` : 'non disponibili'}
                      </td>
                      <td className="py-2 pr-3">
                        {r.implausible ? (
                          <Badge color="red">Valore sospetto</Badge>
                        ) : r.humanConfirmed ? (
                          <Badge color="green">Confermato</Badge>
                        ) : (
                          <Badge color="amber">Da confermare</Badge>
                        )}
                      </td>
                      <td className="py-2">
                        {!r.humanConfirmed && <LabResultButtons labResultId={r.id} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Condivisione */}
      <Card title="Condivisione con i tuoi medici">
        <p className="text-sm text-slate-600 mb-3">
          Di base i tuoi documenti sono privati: decidi tu, documento per documento, quali medici possono vederli.
          Se revochi una condivisione, il medico conserva comunque copia di ciò che ha già ricevuto, come previsto dagli obblighi di legge.
        </p>
        {links.length === 0 ? (
          <p className="text-sm text-slate-500">
            Non hai medici collegati. <Link href="/paziente/medici" className="text-brand-700 hover:underline">Collega un medico</Link> per poter condividere i documenti.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {links.map((l) => {
              const share = doc.sharedWith.find((s) => s.doctorId === l.doctorId && !s.revokedAt);
              return (
                <li key={l.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Dr. {l.doctor.firstName} {l.doctor.lastName}</p>
                    <p className="text-xs text-slate-500">
                      {share ? `Condiviso dal ${fmtDate(share.sharedAt)}` : 'Non condiviso'}
                    </p>
                  </div>
                  <ShareButtons documentId={doc.id} doctorId={l.doctorId} shared={!!share} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
