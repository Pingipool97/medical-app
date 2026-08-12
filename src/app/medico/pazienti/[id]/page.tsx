import Link from 'next/link';
import { db } from '@/lib/db';
import { visibleDocumentsForDoctor } from '@/lib/access';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { DOC_STATUS_LABEL, AI_OUTPUT_STATE_LABEL, AI_FUNCTIONS } from '@/lib/constants';
import { Alert, Badge, Card, EmptyState, statusBadgeColor, BackLink } from '@/components/ui';
import { Icon } from '@/components/icons';
import { loadPatientForDoctor } from './load';
import { PatientHeader } from './patient-header';
import { LabChart, type LabPoint } from './lab-chart';
import { DocAiButtons, PatientAiActions, DrugCheckWidget, OpenConversationButton } from './client';

export const dynamic = 'force-dynamic';

const EXTRACTION_LABEL: Record<string, string> = {
  COMPLETA: 'Estrazione completa',
  PARZIALE: 'Estrazione parziale',
  ILLEGGIBILE: 'Testo illeggibile',
};

export default async function CartellaClinicaPage({ params }: { params: { id: string } }) {
  const { session, doctorId, patient } = await loadPatientForDoctor(params.id, 'PatientRecord');

  const [full, documents, timeline, drafts] = await Promise.all([
    db.patientProfile.findUnique({
      where: { id: patient.id },
      include: {
        conditions: { orderBy: { createdAt: 'desc' } },
        medications: { orderBy: { createdAt: 'desc' } },
        surgeries: { orderBy: { date: 'desc' } },
        vaccinations: { orderBy: { date: 'desc' } },
        familyHistory: true,
        lifestyle: true,
      },
    }),
    visibleDocumentsForDoctor(doctorId, patient.id),
    db.timelineEvent.findMany({ where: { patientId: patient.id }, orderBy: { date: 'desc' }, take: 30 }),
    db.aiOutput.findMany({
      where: { job: { patientId: patient.id, requestedById: session.userId } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { job: true },
    }),
  ]);
  if (!full) return null;

  const activeMeds = full.medications.filter((m) => m.active);
  const stoppedMeds = full.medications.filter((m) => !m.active);

  // Andamento valori: raggruppa i LabResult dei documenti visibili per analita
  const byAnalyte = new Map<string, { name: string; unit: string; refLow: number | null; refHigh: number | null; points: LabPoint[] }>();
  for (const doc of documents) {
    for (const r of doc.labResults) {
      if (!r.analyte || r.implausible) continue;
      const when = r.measuredAt ?? doc.docDate ?? r.createdAt;
      const entry = byAnalyte.get(r.analyte.id) ?? {
        name: r.analyte.name,
        unit: r.unit ?? r.analyte.unit,
        refLow: r.refLow ?? r.analyte.refLow,
        refHigh: r.refHigh ?? r.analyte.refHigh,
        points: [],
      };
      entry.points.push({ dateISO: when.toISOString(), value: r.value, confirmed: r.humanConfirmed });
      byAnalyte.set(r.analyte.id, entry);
    }
  }
  const charts = Array.from(byAnalyte.values()).filter((c) => c.points.length >= 2);

  const fnLabel = (key: string) => AI_FUNCTIONS.find((f) => f.key === key)?.label ?? key;
  const timelineIcon: Record<string, string> = {
    DOCUMENTO: 'file', MISURAZIONE: 'activity', APPUNTAMENTO: 'calendar', DOCUMENTO_EMESSO: 'inbox', TERAPIA: 'clipboard', NOTA: 'pencil',
  };

  return (
    <div className="space-y-5">
      <PatientHeader patient={patient} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <BackLink href="/medico/pazienti" label="Tutti i pazienti" />
        <div className="flex gap-2 flex-wrap">
          <OpenConversationButton patientId={patient.id} doctorId={doctorId} />
          <Link href={`/medico/pazienti/${patient.id}/chat`} className="btn-secondary inline-flex items-center gap-1.5"><Icon name="cpu" className="w-4 h-4" /> Chat clinica IA</Link>
          <Link href={`/medico/pazienti/${patient.id}/emetti`} className="btn-primary inline-flex items-center gap-1.5"><Icon name="pencil" className="w-4 h-4" /> Emetti documento</Link>
        </div>
      </div>

      {/* 1. Diario sanitario (sola lettura) */}
      <Card title="Diario sanitario del paziente (sola lettura)">
        <p className="text-xs text-slate-500 mb-3">
          Completezza profilo: <strong>{full.profileCompleteness}%</strong> — il diario è compilato dal paziente:
          ciò che non è registrato qui non è considerato dalle analisi.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Patologie</h3>
            {full.conditions.length === 0 ? <p className="text-sm text-slate-500">Nessuna registrata.</p> : (
              <ul className="text-sm space-y-1">
                {full.conditions.map((c) => (
                  <li key={c.id}>
                    {c.name} <Badge color={c.status === 'ACTIVE' ? 'amber' : 'green'}>{c.status === 'ACTIVE' ? 'Attiva' : 'Risolta'}</Badge>
                    {c.onsetDate && <span className="text-xs text-slate-500"> dal {fmtDate(c.onsetDate)}</span>}
                    {c.notes && <span className="text-xs text-slate-500"> — {c.notes}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Farmaci attivi</h3>
            {activeMeds.length === 0 ? <p className="text-sm text-slate-500">Nessuno registrato.</p> : (
              <ul className="text-sm space-y-1">
                {activeMeds.map((m) => (
                  <li key={m.id}>
                    {m.name} {m.dosage ?? ''} {m.frequency ? `· ${m.frequency}` : ''}
                    {m.startedAt && <span className="text-xs text-slate-500"> dal {fmtDate(m.startedAt)}</span>}
                  </li>
                ))}
              </ul>
            )}
            {stoppedMeds.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-slate-800 mt-3 mb-1">Farmaci sospesi</h3>
                <ul className="text-sm space-y-1 text-slate-600">
                  {stoppedMeds.map((m) => (
                    <li key={m.id}>
                      {m.name}{m.stoppedAt && ` · sospeso il ${fmtDate(m.stoppedAt)}`}{m.stopReason && ` (${m.stopReason})`}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Interventi</h3>
            {full.surgeries.length === 0 ? <p className="text-sm text-slate-500">Nessuno registrato.</p> : (
              <ul className="text-sm space-y-1">
                {full.surgeries.map((s) => (
                  <li key={s.id}>{s.name}{s.date && ` · ${fmtDate(s.date)}`}{s.hospital && ` · ${s.hospital}`}</li>
                ))}
              </ul>
            )}
            <h3 className="text-sm font-semibold text-slate-800 mt-3 mb-1">Vaccinazioni</h3>
            {full.vaccinations.length === 0 ? <p className="text-sm text-slate-500">Nessuna registrata.</p> : (
              <ul className="text-sm space-y-1">
                {full.vaccinations.map((v) => (
                  <li key={v.id}>{v.name}{v.date && ` · ${fmtDate(v.date)}`}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Familiarità</h3>
            {full.familyHistory.length === 0 ? <p className="text-sm text-slate-500">Nessuna registrata.</p> : (
              <ul className="text-sm space-y-1">
                {full.familyHistory.map((f) => (
                  <li key={f.id}>{f.relation}: {f.condition}{f.notes && ` (${f.notes})`}</li>
                ))}
              </ul>
            )}
            <h3 className="text-sm font-semibold text-slate-800 mt-3 mb-1">Stile di vita</h3>
            {full.lifestyle ? (
              <p className="text-sm text-slate-700">
                Fumo: {full.lifestyle.smoking ?? 'n.d.'}{full.lifestyle.smokingDetail ? ` (${full.lifestyle.smokingDetail})` : ''} ·
                Alcol: {full.lifestyle.alcohol ?? 'n.d.'} ·
                Attività fisica: {full.lifestyle.physicalActivity ?? 'n.d.'}
                {full.lifestyle.diet ? ` · Dieta: ${full.lifestyle.diet}` : ''}
              </p>
            ) : <p className="text-sm text-slate-500">Non registrato.</p>}
          </div>
        </div>
      </Card>

      {/* 2. Documenti condivisi con me */}
      <Card title={`Documenti condivisi con me (${documents.length})`}>
        <p className="text-xs text-slate-500 mb-3">
          Vedi solo i documenti che il paziente ha scelto di condividere con te (regola: default privato).
        </p>
        {documents.length === 0 ? (
          <EmptyState title="Nessun documento condiviso" hint="Il paziente può condividere i suoi referti dalla propria area Documenti." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map((d) => (
              <li key={d.id} className="py-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{d.title}</p>
                    <p className="text-xs text-slate-500">
                      {d.docTypeCode} · data documento: {fmtDate(d.docDate)}{d.dateConfirmed ? '' : ' (da confermare)'}
                      {d.issuer ? ` · ${d.issuer}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge color={statusBadgeColor(d.status)}>{DOC_STATUS_LABEL[d.status] ?? d.status}</Badge>
                    {d.extractionQuality && (
                      <Badge color={d.extractionQuality === 'COMPLETA' ? 'green' : 'amber'}>
                        {EXTRACTION_LABEL[d.extractionQuality] ?? d.extractionQuality}
                      </Badge>
                    )}
                    <a href={`/api/documenti/${d.id}/file`} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-700 hover:underline">
                      Apri file →
                    </a>
                  </div>
                </div>
                <DocAiButtons documentId={d.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 3. Andamento valori */}
      <Card title="Andamento dei valori di laboratorio">
        {charts.length === 0 ? (
          <EmptyState
            title="Non ci sono ancora serie di valori"
            hint="Il grafico compare quando un analita ha almeno due valori estratti dai documenti condivisi con te."
          />
        ) : (
          <div className="space-y-6">
            {charts.map((c) => (
              <LabChart key={c.name} name={c.name} unit={c.unit} refLow={c.refLow} refHigh={c.refHigh} points={c.points} />
            ))}
          </div>
        )}
      </Card>

      {/* 5. Azioni IA */}
      <Card title="Analisi con intelligenza artificiale">
        <PatientAiActions patientId={patient.id} />
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Controllo interazioni farmacologiche (CDS)</h3>
          <DrugCheckWidget patientId={patient.id} />
        </div>
      </Card>

      {/* 6. Ultime bozze IA per questo paziente */}
      <Card title="Ultime bozze IA per questo paziente" action={<Link href="/medico/bozze-ia" className="text-sm text-brand-700 hover:underline">Tutte le bozze</Link>}>
        {drafts.length === 0 ? (
          <EmptyState title="Nessuna bozza generata" hint="Le bozze generate qui compaiono nella coda di revisione." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {drafts.map((o) => (
              <li key={o.id} className="py-2.5 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <Link href={`/medico/bozze-ia/${o.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                    {fnLabel(o.job.functionKey)}
                  </Link>
                  <p className="text-xs text-slate-500">{fmtDateTime(o.createdAt)} · destinatario: {o.audience === 'PATIENT' ? 'paziente' : 'medico'}</p>
                </div>
                <Badge color={statusBadgeColor(o.state)}>{AI_OUTPUT_STATE_LABEL[o.state] ?? o.state}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 4. Timeline */}
      <Card title="Timeline degli eventi">
        {timeline.length === 0 ? (
          <EmptyState title="Nessun evento registrato" />
        ) : (
          <ol className="relative border-s border-slate-200 ml-2 space-y-4">
            {timeline.map((e) => {
              let flags: { outOfRange?: boolean; urgent?: boolean; unconfirmed?: boolean } = {};
              try { flags = e.flags ? JSON.parse(e.flags) : {}; } catch { flags = {}; }
              return (
                <li key={e.id} className="ms-4">
                  <span className="absolute -start-[9px] mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] ring-1 ring-slate-300" aria-hidden>
                    <Icon name={timelineIcon[e.type] ?? 'file'} className="w-3 h-3 text-slate-500" />
                  </span>
                  <p className="text-sm font-medium text-slate-800">
                    {e.title}
                    {flags.urgent && <Badge color="red">Urgente</Badge>}
                    {flags.outOfRange && <Badge color="amber">Valori fuori range</Badge>}
                    {flags.unconfirmed && <Badge color="gray">Non confermato</Badge>}
                  </p>
                  <p className="text-xs text-slate-500">{fmtDate(e.date)}{e.summary ? ` — ${e.summary}` : ''}</p>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Alert kind="info">
        Ogni apertura di questa cartella è registrata nel log accessi consultabile dal paziente (chi, cosa, quando).
      </Alert>
    </div>
  );
}
