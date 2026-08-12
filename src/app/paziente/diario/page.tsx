import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { Alert, Badge, Card, EmptyState, PageTitle } from '@/components/ui';
import {
  AddConditionForm, AddAllergyForm, AddMedicationForm, StopMedicationForm,
  AddSurgeryForm, AddVaccinationForm, AddFamilyHistoryForm, LifestyleForm,
  AddVitalForm, PregnancyForm, DeleteItemButton,
} from './forms';

export const dynamic = 'force-dynamic';

const VITAL_LABEL: Record<string, string> = {
  PESO: 'Peso', PRESSIONE: 'Pressione', GLICEMIA: 'Glicemia', SPO2: 'Saturazione',
  FC: 'Frequenza cardiaca', TEMPERATURA: 'Temperatura', ALTEZZA: 'Altezza',
};

// Grafico SVG di andamento scritto a mano: polyline con assi min/max, nessuna dipendenza
function VitalChart({ title, unit, series }: {
  title: string;
  unit: string;
  series: { at: Date; v: number; v2: number | null }[];
}) {
  if (series.length < 2) return null;
  const W = 340, H = 120, PL = 44, PR = 8, PT = 10, PB = 22;
  const values = series.flatMap((p) => (p.v2 != null ? [p.v, p.v2] : [p.v]));
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const t0 = series[0].at.getTime(), t1 = series[series.length - 1].at.getTime();
  const span = t1 - t0 || 1;
  const x = (d: Date) => PL + ((d.getTime() - t0) / span) * (W - PL - PR);
  const y = (v: number) => PT + (1 - (v - min) / (max - min)) * (H - PT - PB);
  const line = (get: (p: { v: number; v2: number | null }) => number | null) =>
    series.filter((p) => get(p) != null).map((p) => `${x(p.at).toFixed(1)},${y(get(p) as number).toFixed(1)}`).join(' ');

  return (
    <figure className="mt-3">
      <figcaption className="text-xs font-medium text-slate-600 mb-1">Andamento — {title} ({unit})</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md" role="img" aria-label={`Grafico dell'andamento di ${title}: da ${series[0].v} ${unit} il ${fmtDate(series[0].at)} a ${series[series.length - 1].v} ${unit} il ${fmtDate(series[series.length - 1].at)}`}>
        <rect x={PL} y={PT} width={W - PL - PR} height={H - PT - PB} fill="#f8fafc" stroke="#e2e8f0" />
        <text x={PL - 4} y={y(max) + 4} textAnchor="end" fontSize="10" fill="#64748b">{max}</text>
        <text x={PL - 4} y={y(min) + 4} textAnchor="end" fontSize="10" fill="#64748b">{min}</text>
        <text x={PL} y={H - 6} fontSize="10" fill="#64748b">{fmtDate(series[0].at)}</text>
        <text x={W - PR} y={H - 6} textAnchor="end" fontSize="10" fill="#64748b">{fmtDate(series[series.length - 1].at)}</text>
        <polyline points={line((p) => p.v)} fill="none" stroke="#0369a1" strokeWidth="2" />
        {series.some((p) => p.v2 != null) && (
          <polyline points={line((p) => p.v2)} fill="none" stroke="#b45309" strokeWidth="2" strokeDasharray="4 3" />
        )}
        {series.map((p, i) => <circle key={i} cx={x(p.at)} cy={y(p.v)} r="2.5" fill="#0369a1" />)}
      </svg>
      {series.some((p) => p.v2 != null) && (
        <p className="text-[11px] text-slate-500">Linea continua: massima · linea tratteggiata: minima</p>
      )}
    </figure>
  );
}

function Section({ title, subtitle, children, open = false }: { title: string; subtitle?: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="card" open={open}>
      <summary className="cursor-pointer select-none px-4 sm:px-5 py-4">
        <span className="text-base font-semibold text-slate-800">{title}</span>
        {subtitle && <span className="block text-xs text-slate-500 mt-0.5">{subtitle}</span>}
      </summary>
      <div className="px-4 sm:px-5 pb-5">{children}</div>
    </details>
  );
}

export default async function DiarioPage() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');
  const patientId = session.patientId;

  const profile = await db.patientProfile.findUnique({
    where: { id: patientId },
    include: {
      conditions: { orderBy: { createdAt: 'desc' } },
      allergies: { orderBy: { createdAt: 'desc' } },
      medications: { orderBy: [{ active: 'desc' }, { createdAt: 'desc' }] },
      surgeries: { orderBy: { date: 'desc' } },
      vaccinations: { orderBy: { date: 'desc' } },
      familyHistory: true,
      lifestyle: true,
      vitals: { orderBy: { measuredAt: 'asc' } },
      pregnancy: true,
    },
  });
  if (!profile) redirect('/login');

  const activeMeds = profile.medications.filter((m) => m.active);
  const stoppedMeds = profile.medications.filter((m) => !m.active);
  const vitalTypes = Array.from(new Set(profile.vitals.map((v) => v.type)));
  const preg = profile.pregnancy;
  const pregExpired = !!preg?.dueDate && preg.isPregnant && preg.dueDate < new Date();

  return (
    <div className="space-y-4">
      <PageTitle
        title="Il tuo diario sanitario"
        subtitle="Tutto quello che il medico deve sapere di te: patologie, allergie, farmaci, misurazioni. Aggiornalo quando qualcosa cambia."
      />

      {/* Allergie sempre in testa e in rosso */}
      <div className="alert-critical" role="alert">
        <p className="font-semibold">⚠️ Allergie</p>
        {profile.allergies.length === 0 ? (
          <p className="text-sm mt-1">Nessuna allergia registrata. Se non hai allergie note, registralo comunque: anche “nessuna allergia” è un’informazione preziosa per chi ti cura.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {profile.allergies.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 flex-wrap">
                <span>
                  <strong>{a.allergen}</strong> — {a.kind.toLowerCase()}, gravità {a.severity.toLowerCase()}
                  {a.reaction ? ` (reazione: ${a.reaction})` : ''}
                </span>
                <DeleteItemButton kind="allergy" id={a.id} />
              </li>
            ))}
          </ul>
        )}
        <AddAllergyForm />
      </div>

      <Section title="Patologie" subtitle={`${profile.conditions.length} registrate`} open>
        {profile.conditions.length === 0 ? (
          <EmptyState title="Nessuna patologia registrata" hint="Aggiungi le condizioni di cui soffri o che hai avuto in passato." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {profile.conditions.map((c) => (
              <li key={c.id} className="py-2.5 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {c.name} <Badge color={c.status === 'ACTIVE' ? 'amber' : 'green'}>{c.status === 'ACTIVE' ? 'In corso' : 'Risolta'}</Badge>
                  </p>
                  <p className="text-xs text-slate-500">{c.onsetDate ? `Dal ${fmtDate(c.onsetDate)}` : 'Data di inizio non indicata'}{c.notes ? ` · ${c.notes}` : ''}</p>
                </div>
                <DeleteItemButton kind="condition" id={c.id} />
              </li>
            ))}
          </ul>
        )}
        <AddConditionForm />
      </Section>

      <Section title="Farmaci" subtitle={`${activeMeds.length} attivi, ${stoppedMeds.length} sospesi`} open>
        {activeMeds.length === 0 ? (
          <EmptyState title="Nessun farmaco attivo" hint="Aggiungi i farmaci che assumi regolarmente." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {activeMeds.map((m) => (
              <li key={m.id} className="py-2.5 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-slate-800">{m.name} <Badge color="green">Attivo</Badge></p>
                  <p className="text-xs text-slate-500">
                    {[m.dosage, m.frequency].filter(Boolean).join(' · ') || 'Dosaggio non indicato'}
                    {m.startedAt ? ` · dal ${fmtDate(m.startedAt)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StopMedicationForm medicationId={m.id} />
                  <DeleteItemButton kind="medication" id={m.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {stoppedMeds.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-600 mb-1">Farmaci sospesi</h3>
            <ul className="divide-y divide-slate-100">
              {stoppedMeds.map((m) => (
                <li key={m.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm text-slate-600">{m.name} <Badge color="gray">Sospeso</Badge></p>
                    <p className="text-xs text-slate-500">
                      {m.stoppedAt ? `Sospeso il ${fmtDate(m.stoppedAt)}` : ''}{m.stopReason ? ` — motivo: ${m.stopReason}` : ''}
                    </p>
                  </div>
                  <DeleteItemButton kind="medication" id={m.id} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <AddMedicationForm />
      </Section>

      <Section title="Interventi chirurgici" subtitle={`${profile.surgeries.length} registrati`}>
        {profile.surgeries.length === 0 ? (
          <EmptyState title="Nessun intervento registrato" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {profile.surgeries.map((s) => (
              <li key={s.id} className="py-2.5 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.date ? fmtDate(s.date) : 'Data non indicata'}{s.hospital ? ` · ${s.hospital}` : ''}</p>
                </div>
                <DeleteItemButton kind="surgery" id={s.id} />
              </li>
            ))}
          </ul>
        )}
        <AddSurgeryForm />
      </Section>

      <Section title="Vaccinazioni" subtitle={`${profile.vaccinations.length} registrate`}>
        {profile.vaccinations.length === 0 ? (
          <EmptyState title="Nessuna vaccinazione registrata" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {profile.vaccinations.map((v) => (
              <li key={v.id} className="py-2.5 flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium text-slate-800">{v.name} <span className="text-xs text-slate-500 font-normal">{v.date ? fmtDate(v.date) : ''}</span></p>
                <DeleteItemButton kind="vaccination" id={v.id} />
              </li>
            ))}
          </ul>
        )}
        <AddVaccinationForm />
      </Section>

      <Section title="Familiarità" subtitle="Malattie importanti dei tuoi familiari stretti">
        {profile.familyHistory.length === 0 ? (
          <EmptyState title="Nessuna familiarità registrata" hint="Es. genitori con diabete, infarti in famiglia…" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {profile.familyHistory.map((f) => (
              <li key={f.id} className="py-2.5 flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm text-slate-800"><strong>{f.relation}</strong>: {f.condition}</p>
                <DeleteItemButton kind="familyHistory" id={f.id} />
              </li>
            ))}
          </ul>
        )}
        <AddFamilyHistoryForm />
      </Section>

      <Section title="Stile di vita" subtitle="Fumo, alcol, attività fisica, alimentazione">
        {profile.lifestyle ? (
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><dt className="text-slate-500 text-xs">Fumo</dt><dd className="font-medium">{profile.lifestyle.smoking === 'MAI' ? 'Mai fumato' : profile.lifestyle.smoking === 'EX' ? 'Ex fumatore' : profile.lifestyle.smoking === 'ATTUALE' ? 'Fumatore' : '—'}</dd></div>
            <div><dt className="text-slate-500 text-xs">Alcol</dt><dd className="font-medium">{profile.lifestyle.alcohol?.toLowerCase() ?? '—'}</dd></div>
            <div><dt className="text-slate-500 text-xs">Attività fisica</dt><dd className="font-medium">{profile.lifestyle.physicalActivity?.toLowerCase() ?? '—'}</dd></div>
            <div><dt className="text-slate-500 text-xs">Alimentazione</dt><dd className="font-medium">{profile.lifestyle.diet ?? '—'}</dd></div>
          </dl>
        ) : (
          <EmptyState title="Stile di vita non ancora compilato" />
        )}
        <LifestyleForm current={{
          smoking: profile.lifestyle?.smoking ?? '',
          alcohol: profile.lifestyle?.alcohol ?? '',
          physicalActivity: profile.lifestyle?.physicalActivity ?? '',
          diet: profile.lifestyle?.diet ?? '',
        }} />
      </Section>

      <Section title="Misurazioni" subtitle={`${profile.vitals.length} registrate — peso, pressione, glicemia…`} open>
        {vitalTypes.length === 0 ? (
          <EmptyState title="Nessuna misurazione registrata" hint="Registra peso, pressione o glicemia per vederne l'andamento nel tempo." />
        ) : (
          <div className="space-y-5">
            {vitalTypes.map((type) => {
              const series = profile.vitals.filter((v) => v.type === type);
              const last = series[series.length - 1];
              return (
                <div key={type}>
                  <p className="text-sm font-semibold text-slate-800">
                    {VITAL_LABEL[type] ?? type}: ultimo valore {last.value}{last.value2 != null ? `/${last.value2}` : ''} {last.unit}
                    <span className="text-xs text-slate-500 font-normal"> ({fmtDateTime(last.measuredAt)})</span>
                  </p>
                  <VitalChart
                    title={VITAL_LABEL[type] ?? type}
                    unit={last.unit}
                    series={series.map((v) => ({ at: v.measuredAt, v: v.value, v2: v.value2 }))}
                  />
                  <ul className="mt-1 text-xs text-slate-500 space-y-0.5">
                    {series.slice(-3).reverse().map((v) => (
                      <li key={v.id} className="flex items-center gap-3">
                        <span>{fmtDateTime(v.measuredAt)}: {v.value}{v.value2 != null ? `/${v.value2}` : ''} {v.unit}</span>
                        <DeleteItemButton kind="vital" id={v.id} />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        <AddVitalForm />
      </Section>

      {profile.biologicalSex === 'F' && (
        <Section title="Gravidanza e allattamento" subtitle="Dato critico per la sicurezza delle terapie" open={!!preg?.needsUpdate || pregExpired}>
          {(preg?.needsUpdate || pregExpired) && (
            <Alert kind="warn">
              {pregExpired
                ? 'La data presunta del parto è passata: aggiorna il tuo stato, è importante per la sicurezza di eventuali terapie.'
                : 'Ti chiediamo di riconfermare il tuo stato: è passato del tempo dall’ultimo aggiornamento.'}
            </Alert>
          )}
          {preg && (
            <p className="text-sm text-slate-700 mt-2">
              Stato attuale: {preg.isPregnant ? 'in gravidanza' : 'non in gravidanza'}
              {preg.isBreastfeeding ? ', in allattamento' : ''}
              {preg.dueDate ? ` · termine previsto ${fmtDate(preg.dueDate)}` : ''}
              {preg.confirmedAt ? ` · confermato il ${fmtDate(preg.confirmedAt)}` : ''}
            </p>
          )}
          <PregnancyForm current={{
            isPregnant: preg?.isPregnant ?? false,
            isBreastfeeding: preg?.isBreastfeeding ?? false,
            dueDate: preg?.dueDate ? preg.dueDate.toISOString().slice(0, 10) : '',
          }} />
        </Section>
      )}
    </div>
  );
}
