'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState } from 'react-dom';
import { updateProfileAction, addConditionAction, addAllergyAction, addMedicationAction, saveLifestyleAction, addVitalAction, type ActionState } from '@/app/actions/diary';
import { Alert, Field, SelectField } from '@/components/ui';

function useAdvanceOnSuccess(state: ActionState, nextStep: number | null) {
  const router = useRouter();
  useEffect(() => {
    if (state?.success && nextStep) {
      const t = setTimeout(() => router.push(`/paziente/onboarding?step=${nextStep}`), 800);
      return () => clearTimeout(t);
    }
  }, [state, nextStep, router]);
}

// ── Passo 1: residenza, medico di base, contatto d'emergenza ──

export function Step1Form({ profile }: {
  profile: { addressStreet: string; addressCity: string; addressProvince: string; addressZip: string; gpName: string; asl: string; insurance: string };
}) {
  const [state, action] = useFormState<ActionState, FormData>(updateProfileAction, null);
  useAdvanceOnSuccess(state, 2);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success} Passiamo al prossimo passo…</Alert>}
      <input type="hidden" name="onboardingStep" value="1" />
      <Field label="Via e numero civico" name="addressStreet" defaultValue={profile.addressStreet} autoComplete="street-address" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Città" name="addressCity" defaultValue={profile.addressCity} />
        <Field label="Provincia" name="addressProvince" defaultValue={profile.addressProvince} placeholder="es. MI" />
        <Field label="CAP" name="addressZip" defaultValue={profile.addressZip} inputMode="numeric" />
      </div>
      <Field label="Il tuo medico di base" name="gpName" defaultValue={profile.gpName} hint="Il nome del medico di famiglia che ti segue abitualmente." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="ASL di appartenenza" name="asl" defaultValue={profile.asl} />
        <Field label="Assicurazione sanitaria (se ne hai una)" name="insurance" defaultValue={profile.insurance} />
      </div>
      <fieldset className="border border-slate-200 rounded-lg p-4">
        <legend className="text-sm font-medium text-slate-700 px-1">Persona da contattare in caso di emergenza</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome e cognome" name="emergencyName" hint="Un familiare o una persona di fiducia." />
          <Field label="Numero di telefono" name="emergencyPhone" type="tel" autoComplete="off" />
        </div>
        <p className="text-xs text-slate-500 mt-2">Questi dati sono conservati in forma cifrata.</p>
      </fieldset>
      <button type="submit" className="btn-primary w-full">Salva e continua</button>
    </form>
  );
}

// ── Passo 2: patologie + allergie ──

export function Step2Forms({ conditions, allergies }: {
  conditions: { id: string; name: string }[];
  allergies: { id: string; allergen: string; severity: string }[];
}) {
  const [condState, condAction] = useFormState<ActionState, FormData>(addConditionAction, null);
  const [allState, allAction] = useFormState<ActionState, FormData>(addAllergyAction, null);
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Le tue patologie</h3>
        {conditions.length > 0 && (
          <ul className="mb-3 text-sm text-slate-700 list-disc list-inside">
            {conditions.map((c) => <li key={c.id}>{c.name}</li>)}
          </ul>
        )}
        <form action={condAction} className="space-y-3">
          {condState?.error && <Alert kind="error">{condState.error}</Alert>}
          {condState?.success && <Alert kind="success">{condState.success}</Alert>}
          <Field label="Patologia" name="name" placeholder="es. Diabete di tipo 2, ipertensione…" hint="Se non hai patologie puoi scrivere NESSUNA: anche questa è un’informazione utile." />
          <Field label="Da quando (se lo ricordi)" name="onsetDate" type="date" />
          <button type="submit" className="btn-secondary">Aggiungi patologia</button>
        </form>
      </div>

      <div className="border-t border-slate-200 pt-5">
        <h3 className="text-sm font-semibold text-red-800 mb-2">Le tue allergie (molto importante)</h3>
        {allergies.length > 0 && (
          <div className="alert-critical mb-3 text-sm" role="alert">
            <ul className="list-disc list-inside">
              {allergies.map((a) => <li key={a.id}>{a.allergen} — gravità {a.severity.toLowerCase()}</li>)}
            </ul>
          </div>
        )}
        <form action={allAction} className="space-y-3">
          {allState?.error && <Alert kind="error">{allState.error}</Alert>}
          {allState?.success && <Alert kind="success">{allState.success}</Alert>}
          <Field label="A cosa sei allergico" name="allergen" placeholder="es. Penicillina, nichel, arachidi…" hint="Se non hai allergie note puoi scrivere NESSUNA." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField label="Tipo" name="kind" options={[
              { value: 'FARMACO', label: 'Farmaco' },
              { value: 'ALIMENTO', label: 'Alimento' },
              { value: 'AMBIENTALE', label: 'Ambientale (pollini, acari…)' },
              { value: 'ALTRO', label: 'Altro' },
            ]} defaultValue="FARMACO" />
            <SelectField label="Gravità" name="severity" options={[
              { value: 'LIEVE', label: 'Lieve' },
              { value: 'MODERATA', label: 'Moderata' },
              { value: 'GRAVE', label: 'Grave' },
            ]} defaultValue="MODERATA" />
          </div>
          <Field label="Che reazione ti provoca (se la conosci)" name="reaction" placeholder="es. orticaria, gonfiore…" />
          <button type="submit" className="btn-secondary">Aggiungi allergia</button>
        </form>
      </div>
    </div>
  );
}

// ── Passo 3: farmaci ──

export function Step3Form({ medications }: { medications: { id: string; name: string; dosage: string | null }[] }) {
  const [state, action] = useFormState<ActionState, FormData>(addMedicationAction, null);
  return (
    <div className="space-y-4">
      {medications.length > 0 && (
        <ul className="text-sm text-slate-700 list-disc list-inside">
          {medications.map((m) => <li key={m.id}>{m.name}{m.dosage ? ` — ${m.dosage}` : ''}</li>)}
        </ul>
      )}
      <form action={action} className="space-y-3">
        {state?.error && <Alert kind="error">{state.error}</Alert>}
        {state?.success && <Alert kind="success">{state.success}</Alert>}
        <Field label="Nome del farmaco" name="name" placeholder="es. Cardioaspirina" hint="Se non prendi farmaci puoi scrivere NESSUNO." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Dosaggio" name="dosage" placeholder="es. 100 mg" />
          <Field label="Quante volte" name="frequency" placeholder="es. 1 al giorno, dopo cena" />
        </div>
        <Field label="Da quando lo prendi (se lo ricordi)" name="startedAt" type="date" />
        <button type="submit" className="btn-secondary">Aggiungi farmaco</button>
      </form>
    </div>
  );
}

// ── Passo 4: stile di vita + misurazioni ──

export function Step4Forms({ lifestyle }: {
  lifestyle: { smoking: string; alcohol: string; physicalActivity: string; diet: string };
}) {
  const [lifeState, lifeAction] = useFormState<ActionState, FormData>(saveLifestyleAction, null);
  const [vitalState, vitalAction] = useFormState<ActionState, FormData>(addVitalAction, null);
  return (
    <div className="space-y-6">
      <form action={lifeAction} className="space-y-3">
        {lifeState?.error && <Alert kind="error">{lifeState.error}</Alert>}
        {lifeState?.success && <Alert kind="success">{lifeState.success}</Alert>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SelectField label="Fumo" name="smoking" defaultValue={lifestyle.smoking || undefined} options={[
            { value: 'MAI', label: 'Non ho mai fumato' },
            { value: 'EX', label: 'Ho smesso' },
            { value: 'ATTUALE', label: 'Fumo attualmente' },
          ]} />
          <SelectField label="Alcol" name="alcohol" defaultValue={lifestyle.alcohol || undefined} options={[
            { value: 'MAI', label: 'Mai' },
            { value: 'OCCASIONALE', label: 'Occasionale' },
            { value: 'REGOLARE', label: 'Regolare' },
          ]} />
          <SelectField label="Attività fisica" name="physicalActivity" defaultValue={lifestyle.physicalActivity || undefined} options={[
            { value: 'SEDENTARIO', label: 'Sedentaria' },
            { value: 'LEGGERA', label: 'Leggera' },
            { value: 'MODERATA', label: 'Moderata' },
            { value: 'INTENSA', label: 'Intensa' },
          ]} />
        </div>
        <Field label="Note sull'alimentazione" name="diet" defaultValue={lifestyle.diet} placeholder="es. dieta mediterranea, vegetariana…" />
        <button type="submit" className="btn-secondary">Salva stile di vita</button>
      </form>

      <form action={vitalAction} className="border-t border-slate-200 pt-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Una misurazione di partenza</h3>
        {vitalState?.error && <Alert kind="error">{vitalState.error}</Alert>}
        {vitalState?.success && <Alert kind="success">{vitalState.success}</Alert>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SelectField label="Cosa misuri" name="type" defaultValue="PESO" options={[
            { value: 'PESO', label: 'Peso (kg)' },
            { value: 'ALTEZZA', label: 'Altezza (cm)' },
            { value: 'PRESSIONE', label: 'Pressione (mmHg)' },
            { value: 'GLICEMIA', label: 'Glicemia (mg/dL)' },
          ]} />
          <Field label="Valore" name="value" inputMode="decimal" placeholder="es. 72" required />
          <Field label="Secondo valore (minima, solo pressione)" name="value2" inputMode="decimal" placeholder="es. 80" />
        </div>
        <button type="submit" className="btn-secondary">Aggiungi misurazione</button>
      </form>
    </div>
  );
}
