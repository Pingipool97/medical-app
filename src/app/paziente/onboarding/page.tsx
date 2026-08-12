import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Card, PageTitle } from '@/components/ui';
import { advanceOnboardingAction } from '../actions';
import { Step1Form, Step2Forms, Step3Form, Step4Forms } from './forms';

export const dynamic = 'force-dynamic';

const STEPS = [
  { n: 1, label: 'Residenza e contatti' },
  { n: 2, label: 'Patologie e allergie' },
  { n: 3, label: 'Farmaci' },
  { n: 4, label: 'Stile di vita e misure' },
];

export default async function OnboardingPage({ searchParams }: { searchParams: { step?: string } }) {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');
  const patientId = session.patientId;

  const profile = await db.patientProfile.findUnique({
    where: { id: patientId },
    include: { conditions: true, allergies: true, medications: { where: { active: true } }, lifestyle: true },
  });
  if (!profile) redirect('/login');

  const requested = parseInt(searchParams.step ?? '', 10);
  const step = Math.min(Math.max(isNaN(requested) ? profile.onboardingStep + 1 : requested, 1), 4);

  return (
    <div className="space-y-5 max-w-2xl">
      <PageTitle
        title="Completa il tuo profilo sanitario"
        subtitle="Pochi minuti, un passo alla volta. Puoi interrompere quando vuoi: quello che salvi resta salvato."
      />

      {/* Barra di avanzamento */}
      <div aria-label={`Passo ${step} di 4`}>
        <ol className="flex gap-2">
          {STEPS.map((s) => (
            <li key={s.n} className="flex-1">
              <Link href={`/paziente/onboarding?step=${s.n}`} className="block group" aria-current={s.n === step ? 'step' : undefined}>
                <div className={`h-2.5 rounded-full ${s.n < step ? 'bg-emerald-600' : s.n === step ? 'bg-brand-700' : 'bg-slate-200'}`} />
                <p className={`mt-1 text-[11px] sm:text-xs ${s.n === step ? 'font-semibold text-slate-800' : 'text-slate-500'} group-hover:underline`}>
                  {s.n}. {s.label}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      {step === 1 && (
        <Card title="Passo 1 — Dove vivi e chi contattare">
          <p className="text-sm text-slate-600 mb-4">
            Questi dati aiutano il medico a inquadrarti (ASL di riferimento, medico di base) e ci dicono chi avvisare in caso di necessità.
          </p>
          <Step1Form profile={{
            addressStreet: profile.addressStreet ?? '',
            addressCity: profile.addressCity ?? '',
            addressProvince: profile.addressProvince ?? '',
            addressZip: profile.addressZip ?? '',
            gpName: profile.gpName ?? '',
            asl: profile.asl ?? '',
            insurance: profile.insurance ?? '',
          }} />
        </Card>
      )}

      {step === 2 && (
        <Card title="Passo 2 — Patologie e allergie">
          <p className="text-sm text-slate-600 mb-4">
            Sapere di cosa soffri e a cosa sei allergico è il dato più importante per la tua sicurezza: migliora l’affidabilità delle analisi e permette di segnalare subito farmaci a rischio.
          </p>
          <Step2Forms
            conditions={profile.conditions.map((c) => ({ id: c.id, name: c.name }))}
            allergies={profile.allergies.map((a) => ({ id: a.id, allergen: a.allergen, severity: a.severity }))}
          />
        </Card>
      )}

      {step === 3 && (
        <Card title="Passo 3 — I farmaci che prendi">
          <p className="text-sm text-slate-600 mb-4">
            Elenca i farmaci che assumi regolarmente (anche integratori importanti). Serve a controllare le interazioni e migliora l’affidabilità delle analisi.
          </p>
          <Step3Form medications={profile.medications.map((m) => ({ id: m.id, name: m.name, dosage: m.dosage }))} />
        </Card>
      )}

      {step === 4 && (
        <Card title="Passo 4 — Stile di vita e misurazioni">
          <p className="text-sm text-slate-600 mb-4">
            Fumo, alcol e attività fisica danno al medico il contesto per interpretare i tuoi esami. Se conosci peso e altezza, aggiungili: migliorano l’affidabilità delle analisi.
          </p>
          <Step4Forms lifestyle={{
            smoking: profile.lifestyle?.smoking ?? '',
            alcohol: profile.lifestyle?.alcohol ?? '',
            physicalActivity: profile.lifestyle?.physicalActivity ?? '',
            diet: profile.lifestyle?.diet ?? '',
          }} />
        </Card>
      )}

      {/* Salta / completa più tardi */}
      <form action={advanceOnboardingAction.bind(null, step, step < 4 ? step + 1 : null)}>
        <div className="flex items-center justify-between gap-3">
          <Link href="/paziente" className="text-sm text-slate-600 hover:underline">Completa più tardi</Link>
          <button type="submit" className="btn-secondary">
            {step < 4 ? 'Salta questo passo →' : 'Ho finito, torna alla home'}
          </button>
        </div>
      </form>
    </div>
  );
}
