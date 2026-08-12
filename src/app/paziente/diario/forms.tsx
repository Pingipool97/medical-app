'use client';

import { useState, useTransition } from 'react';
import { useFormState } from 'react-dom';
import {
  addConditionAction, addAllergyAction, addMedicationAction, stopMedicationAction,
  addSurgeryAction, addVaccinationAction, addFamilyHistoryAction, saveLifestyleAction,
  addVitalAction, savePregnancyAction, deleteDiaryItemAction, type ActionState,
} from '@/app/actions/diary';
import { Alert, Field, SelectField, TextArea } from '@/components/ui';

function Feedback({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <Alert kind="error">{state.error}</Alert>;
  if (state.success) return <Alert kind="success">{state.success}</Alert>;
  return null;
}

// Bottone elimina generico per le voci del diario
export function DeleteItemButton({ kind, id, label = 'Elimina' }: { kind: string; id: string; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('Vuoi davvero eliminare questa voce dal diario?')) return;
          start(async () => {
            const res = await deleteDiaryItemAction(kind, id);
            if (res?.error) setError(res.error);
          });
        }}
        className="text-xs text-red-700 hover:underline disabled:opacity-50"
      >
        {pending ? 'Elimino…' : label}
      </button>
      {error && <span className="text-xs text-red-700 ml-2">{error}</span>}
    </span>
  );
}

export function AddConditionForm() {
  const [state, action] = useFormState<ActionState, FormData>(addConditionAction, null);
  return (
    <form action={action} className="space-y-3 mt-3">
      <Feedback state={state} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Patologia" name="name" required placeholder="es. Ipertensione" />
        <SelectField label="Stato" name="status" defaultValue="ACTIVE" options={[
          { value: 'ACTIVE', label: 'In corso' },
          { value: 'RESOLVED', label: 'Risolta' },
        ]} />
        <Field label="Da quando" name="onsetDate" type="date" />
      </div>
      <Field label="Note" name="notes" placeholder="es. seguita dal cardiologo" />
      <button type="submit" className="btn-secondary">Aggiungi patologia</button>
    </form>
  );
}

export function AddAllergyForm() {
  const [state, action] = useFormState<ActionState, FormData>(addAllergyAction, null);
  return (
    <form action={action} className="space-y-3 mt-3">
      <Feedback state={state} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Allergene" name="allergen" required placeholder="es. Penicillina" />
        <SelectField label="Tipo" name="kind" defaultValue="FARMACO" options={[
          { value: 'FARMACO', label: 'Farmaco' },
          { value: 'ALIMENTO', label: 'Alimento' },
          { value: 'AMBIENTALE', label: 'Ambientale' },
          { value: 'ALTRO', label: 'Altro' },
        ]} />
        <SelectField label="Gravità" name="severity" defaultValue="MODERATA" options={[
          { value: 'LIEVE', label: 'Lieve' },
          { value: 'MODERATA', label: 'Moderata' },
          { value: 'GRAVE', label: 'Grave' },
        ]} />
      </div>
      <Field label="Reazione" name="reaction" placeholder="es. orticaria" />
      <button type="submit" className="btn-secondary">Aggiungi allergia</button>
    </form>
  );
}

export function AddMedicationForm() {
  const [state, action] = useFormState<ActionState, FormData>(addMedicationAction, null);
  return (
    <form action={action} className="space-y-3 mt-3">
      <Feedback state={state} />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Field label="Farmaco" name="name" required placeholder="es. Metformina" />
        <Field label="Dosaggio" name="dosage" placeholder="es. 500 mg" />
        <Field label="Frequenza" name="frequency" placeholder="es. 2 al giorno" />
        <Field label="Dal" name="startedAt" type="date" />
      </div>
      <button type="submit" className="btn-secondary">Aggiungi farmaco</button>
    </form>
  );
}

// Sospensione farmaco con motivo
export function StopMedicationForm({ medicationId }: { medicationId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="text-xs text-amber-700 hover:underline">Sospendi</button>;
  }
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <label className="sr-only" htmlFor={`stop-${medicationId}`}>Motivo della sospensione</label>
      <input
        id={`stop-${medicationId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (es. indicazione del medico)"
        className="input !w-56 !py-1 text-sm"
      />
      <button
        type="button"
        disabled={pending}
        className="text-xs text-amber-800 font-semibold hover:underline disabled:opacity-50"
        onClick={() =>
          start(async () => {
            const res = await stopMedicationAction(medicationId, reason);
            if (res?.error) setMsg(res.error);
          })
        }
      >
        {pending ? 'Salvo…' : 'Conferma sospensione'}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:underline">Annulla</button>
      {msg && <span className="text-xs text-red-700">{msg}</span>}
    </span>
  );
}

export function AddSurgeryForm() {
  const [state, action] = useFormState<ActionState, FormData>(addSurgeryAction, null);
  return (
    <form action={action} className="space-y-3 mt-3">
      <Feedback state={state} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Intervento" name="name" required placeholder="es. Appendicectomia" />
        <Field label="Data" name="date" type="date" />
        <Field label="Ospedale / struttura" name="hospital" placeholder="es. Ospedale San Carlo" />
      </div>
      <button type="submit" className="btn-secondary">Aggiungi intervento</button>
    </form>
  );
}

export function AddVaccinationForm() {
  const [state, action] = useFormState<ActionState, FormData>(addVaccinationAction, null);
  return (
    <form action={action} className="space-y-3 mt-3">
      <Feedback state={state} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Vaccino" name="name" required placeholder="es. Antinfluenzale" />
        <Field label="Data" name="date" type="date" />
      </div>
      <button type="submit" className="btn-secondary">Aggiungi vaccinazione</button>
    </form>
  );
}

export function AddFamilyHistoryForm() {
  const [state, action] = useFormState<ActionState, FormData>(addFamilyHistoryAction, null);
  return (
    <form action={action} className="space-y-3 mt-3">
      <Feedback state={state} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Parente" name="relation" required placeholder="es. Padre, madre, nonna…" />
        <Field label="Condizione" name="condition" required placeholder="es. Infarto, diabete…" />
      </div>
      <button type="submit" className="btn-secondary">Aggiungi familiarità</button>
    </form>
  );
}

export function LifestyleForm({ current }: {
  current: { smoking: string; alcohol: string; physicalActivity: string; diet: string };
}) {
  const [state, action] = useFormState<ActionState, FormData>(saveLifestyleAction, null);
  return (
    <form action={action} className="space-y-3 mt-3">
      <Feedback state={state} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SelectField label="Fumo" name="smoking" defaultValue={current.smoking || undefined} options={[
          { value: 'MAI', label: 'Non ho mai fumato' },
          { value: 'EX', label: 'Ho smesso' },
          { value: 'ATTUALE', label: 'Fumo attualmente' },
        ]} />
        <SelectField label="Alcol" name="alcohol" defaultValue={current.alcohol || undefined} options={[
          { value: 'MAI', label: 'Mai' },
          { value: 'OCCASIONALE', label: 'Occasionale' },
          { value: 'REGOLARE', label: 'Regolare' },
        ]} />
        <SelectField label="Attività fisica" name="physicalActivity" defaultValue={current.physicalActivity || undefined} options={[
          { value: 'SEDENTARIO', label: 'Sedentaria' },
          { value: 'LEGGERA', label: 'Leggera' },
          { value: 'MODERATA', label: 'Moderata' },
          { value: 'INTENSA', label: 'Intensa' },
        ]} />
      </div>
      <Field label="Alimentazione" name="diet" defaultValue={current.diet} placeholder="es. dieta mediterranea" />
      <button type="submit" className="btn-secondary">Salva stile di vita</button>
    </form>
  );
}

export function AddVitalForm() {
  const [state, action] = useFormState<ActionState, FormData>(addVitalAction, null);
  return (
    <form action={action} className="space-y-3 mt-3">
      <Feedback state={state} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SelectField label="Tipo" name="type" defaultValue="PESO" options={[
          { value: 'PESO', label: 'Peso (kg)' },
          { value: 'PRESSIONE', label: 'Pressione (mmHg)' },
          { value: 'GLICEMIA', label: 'Glicemia (mg/dL)' },
          { value: 'SPO2', label: 'Saturazione (%)' },
          { value: 'FC', label: 'Battiti (bpm)' },
          { value: 'TEMPERATURA', label: 'Temperatura (°C)' },
          { value: 'ALTEZZA', label: 'Altezza (cm)' },
        ]} />
        <Field label="Valore" name="value" required inputMode="decimal" placeholder="es. 120" />
        <Field label="Minima (solo pressione)" name="value2" inputMode="decimal" placeholder="es. 80" />
        <Field label="Data e ora" name="measuredAt" type="datetime-local" />
      </div>
      <button type="submit" className="btn-secondary">Aggiungi misurazione</button>
    </form>
  );
}

export function PregnancyForm({ current }: {
  current: { isPregnant: boolean; isBreastfeeding: boolean; dueDate: string };
}) {
  const [state, action] = useFormState<ActionState, FormData>(savePregnancyAction, null);
  return (
    <form action={action} className="space-y-3 mt-3">
      <Feedback state={state} />
      <div className="flex flex-col gap-2">
        <label className="inline-flex items-center gap-2 text-sm text-slate-800">
          <input type="checkbox" name="isPregnant" defaultChecked={current.isPregnant} className="h-5 w-5" />
          Sono in gravidanza
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-slate-800">
          <input type="checkbox" name="isBreastfeeding" defaultChecked={current.isBreastfeeding} className="h-5 w-5" />
          Sto allattando
        </label>
      </div>
      <Field label="Data presunta del parto" name="dueDate" type="date" defaultValue={current.dueDate} hint="Se sei in gravidanza, indica il termine previsto." />
      <button type="submit" className="btn-secondary">Aggiorna e conferma</button>
    </form>
  );
}
