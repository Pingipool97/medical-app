'use client';

import { useState, useTransition } from 'react';
import { useFormState } from 'react-dom';
import {
  updateDoctorProfileAction, addOfficeAction, removeOfficeAction,
  setSpecializationsAction, addServicesAction, removeServiceAction, type ActionState,
} from '../actions';
import { Alert, CheckboxGroupField, Field, TextArea } from '@/components/ui';

function Feedback({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <Alert kind="error">{state.error}</Alert>;
  if (state.success) return <Alert kind="success">{state.success}</Alert>;
  return null;
}

export function ProfileForm({ bio, professionalPhone, responseTimeHours }: { bio: string; professionalPhone: string; responseTimeHours: number }) {
  const [state, action] = useFormState<ActionState, FormData>(updateDoctorProfileAction, null);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      <TextArea label="Bio professionale" name="bio" rows={4} defaultValue={bio} placeholder="Formazione, esperienza, ambiti di interesse…" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Telefono professionale" name="professionalPhone" type="tel" defaultValue={professionalPhone} placeholder="es. 02 1234567" />
        <Field
          label="Tempo di risposta dichiarato (ore)"
          name="responseTimeHours"
          type="number"
          required
          defaultValue={String(responseTimeHours)}
          min={1}
          max={720}
          hint="Il paziente vede questo valore: è l’impegno di risposta che dichiari per richieste e messaggi."
        />
      </div>
      <button type="submit" className="btn-primary">Salva profilo</button>
    </form>
  );
}

export function AddOfficeForm() {
  const [state, action] = useFormState<ActionState, FormData>(addOfficeAction, null);
  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <Field label="Nome sede" name="name" required placeholder="es. Studio centro" />
        <Field label="Indirizzo" name="address" placeholder="es. Via Roma 1" />
        <Field label="Città" name="city" required placeholder="es. Milano" />
        <button type="submit" className="btn-secondary">Aggiungi sede</button>
      </div>
    </form>
  );
}

export function RemoveOfficeButton({ index }: { index: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const res = await removeOfficeAction(index);
          if (res?.error) setError(res.error);
        })}
        className="text-xs text-red-700 hover:underline disabled:opacity-50"
      >
        {pending ? 'Rimuovo…' : 'Rimuovi'}
      </button>
      {error && <span className="text-xs text-red-700 ml-2">{error}</span>}
    </span>
  );
}

export function ServicesForm({ suggerite, gia }: {
  suggerite: string[];
  gia: { id: string; name: string; active: boolean; durationMin: number; priceCents: number }[];
}) {
  const [state, action] = useFormState<ActionState, FormData>(addServicesAction, null);
  const nomiGia = new Set(gia.map((g) => g.name.toLowerCase()));
  // Cio' che ha gia' non si ripropone: comparirebbe spuntabile una prestazione che ha gia'.
  const daProporre = suggerite.filter((n) => !nomiGia.has(n.toLowerCase()));

  return (
    <div className="space-y-4">
      {gia.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {gia.map((s) => (
            <li key={s.id} className="py-2.5 px-3 flex items-center justify-between gap-2 text-sm">
              <span className={s.active ? '' : 'text-slate-400 line-through'}>
                {s.name}
                <span className="text-xs text-slate-500 ml-2">
                  {s.durationMin} min · {s.priceCents > 0 ? `${(s.priceCents / 100).toFixed(2)} €` : 'prezzo da concordare'}
                </span>
              </span>
              <RemoveServiceButton id={s.id} />
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-3">
        <Feedback state={state} />
        {daProporre.length > 0 && (
          <CheckboxGroupField
            label="Prestazioni per le tue professioni"
            name="prestazioni"
            options={daProporre.map((n) => ({ value: n, label: n }))}
            hint="Spunta quelle che offri. Sono proposte: se non ti servono, scrivi le tue qui sotto."
          />
        )}
        <TextArea
          label="Aggiungine altre a mano"
          name="prestazioniLibere"
          rows={3}
          placeholder={'Una per riga, ad esempio:\nBendaggio funzionale\nTaping neuromuscolare'}
          hint="Una per riga. Nascono con 30 minuti e prezzo da concordare: durata e prezzo si regolano in Agenda."
        />
        <button type="submit" className="btn-secondary">Salva le prestazioni</button>
      </form>
    </div>
  );
}

function RemoveServiceButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="shrink-0">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const res = await removeServiceAction(id);
          if (res?.error) setError(res.error);
        })}
        className="text-xs text-red-700 hover:underline disabled:opacity-50"
      >
        {pending ? 'Rimuovo…' : 'Rimuovi'}
      </button>
      {error && <span className="text-xs text-red-700 ml-2">{error}</span>}
    </span>
  );
}

export function SpecializationsForm({ options, selected }: {
  options: { value: string; label: string; note?: string }[];
  selected: string[];
}) {
  const [state, action] = useFormState<ActionState, FormData>(setSpecializationsAction, null);
  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <CheckboxGroupField
        label="Le tue professioni"
        name="specializations"
        options={options}
        defaultSelected={selected}
        hint="Spunta tutte quelle che eserciti. Il paziente le vede sotto al tuo nome, in ordine alfabetico."
      />
      <button type="submit" className="btn-secondary">Salva le professioni</button>
    </form>
  );
}

