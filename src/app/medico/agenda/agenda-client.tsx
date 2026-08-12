'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useFormState } from 'react-dom';
import {
  saveAvailabilityAction, addExceptionAction, deleteAvailabilityAction,
  completeAppointmentAction, cancelAppointmentAction, type ActionState,
} from '@/app/actions/agenda';
import { generateVisitPrepAction, type ActionState as AiActionState } from '@/app/actions/ai';
import { createServiceAction, updateServiceAction, toggleServiceAction, type ActionState as LocalActionState } from '../actions';
import { Alert, Field, SelectField } from '@/components/ui';
import { Icon } from '@/components/icons';

const WEEKDAYS = [
  { value: '1', label: 'Lunedì' }, { value: '2', label: 'Martedì' }, { value: '3', label: 'Mercoledì' },
  { value: '4', label: 'Giovedì' }, { value: '5', label: 'Venerdì' }, { value: '6', label: 'Sabato' }, { value: '0', label: 'Domenica' },
];

// ── Azioni sull'appuntamento ──

export function BriefingButton({ appointmentId }: { appointmentId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<AiActionState>(null);
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await generateVisitPrepAction(appointmentId, 'DOCTOR')))}
        className="btn-secondary !py-1.5 text-xs inline-flex items-center gap-1.5"
      >
        {pending ? 'Genero…' : <><Icon name="sparkles" className="w-4 h-4" /> Briefing IA</>}
      </button>
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
      {state?.success && (
        <p className="text-xs text-emerald-700">
          {state.success}{' '}
          {state.outputId && <Link href={`/medico/bozze-ia/${state.outputId}`} className="underline font-semibold">Apri →</Link>}
        </p>
      )}
    </div>
  );
}

export function CompleteWithNotesForm({ appointmentId, defaultNotes }: { appointmentId: string; defaultNotes?: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(defaultNotes ?? '');
  const [state, setState] = useState<ActionState>(null);

  if (state?.success) return <p className="text-xs text-emerald-700">{state.success}</p>;

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn-secondary !py-1.5 text-xs inline-flex items-center gap-1.5">
        <Icon name="check" className="w-4 h-4" /> Completa con note
      </button>
      {open && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="label" htmlFor={`note-${appointmentId}`}>Note della visita (base per il referto)</label>
          <textarea
            id={`note-${appointmentId}`}
            className="input"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Esame obiettivo, valutazione, indicazioni…"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => setState(await completeAppointmentAction(appointmentId, notes)))}
            className="btn-primary !py-1.5 text-xs"
          >
            {pending ? 'Salvo…' : 'Segna come completata'}
          </button>
          {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
        </div>
      )}
    </div>
  );
}

export function CancelAppointmentButton({ appointmentId }: { appointmentId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  if (state?.success) return <p className="text-xs text-emerald-700">{state.success}</p>;
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm('Vuoi annullare questo appuntamento? Il paziente verrà avvisato.')) {
            start(async () => setState(await cancelAppointmentAction(appointmentId, 'Annullato dallo studio')));
          }
        }}
        className="btn-danger !py-1.5 text-xs"
      >
        {pending ? 'Annullo…' : 'Annulla'}
      </button>
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
    </div>
  );
}

// ── Disponibilità ──

export function AvailabilityForm() {
  const [state, action] = useFormState<ActionState, FormData>(saveAvailabilityAction, null);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <SelectField label="Giorno" name="weekday" required options={WEEKDAYS} />
        <Field label="Dalle" name="startTime" type="time" required />
        <Field label="Alle" name="endTime" type="time" required />
        <button type="submit" className="btn-primary">Aggiungi fascia</button>
      </div>
    </form>
  );
}

export function DeleteAvailabilityButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const res = await deleteAvailabilityAction(id);
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

export function ExceptionForm() {
  const [state, action] = useFormState<ActionState, FormData>(addExceptionAction, null);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <Field label="Data di chiusura" name="date" type="date" required />
        <Field label="Motivo (facoltativo)" name="reason" placeholder="es. ferie, congresso" />
        <button type="submit" className="btn-secondary">Aggiungi chiusura</button>
      </div>
    </form>
  );
}

// ── Catalogo prestazioni ──

const MODE_OPTIONS = [
  { value: 'PRESENZA', label: 'Solo in presenza' },
  { value: 'VIDEO', label: 'Solo videoconsulto' },
  { value: 'ENTRAMBI', label: 'Presenza o video' },
];

export function CreateServiceForm() {
  const [state, action] = useFormState<LocalActionState, FormData>(createServiceAction, null);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
        <div className="sm:col-span-2"><Field label="Nome prestazione" name="name" required placeholder="es. Visita cardiologica" /></div>
        <Field label="Durata (min)" name="durationMin" type="number" required defaultValue="30" min={5} max={480} />
        <Field label="Prezzo (€)" name="priceEuro" type="number" required defaultValue="0" min={0} step="0.01" />
        <SelectField label="Modalità" name="mode" defaultValue="ENTRAMBI" options={MODE_OPTIONS} />
      </div>
      <button type="submit" className="btn-primary">Aggiungi prestazione</button>
    </form>
  );
}

export function EditServiceForm({ service }: { service: { id: string; name: string; durationMin: number; priceCents: number; mode: string; active: boolean } }) {
  const [state, action] = useFormState<LocalActionState, FormData>(updateServiceAction, null);
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-brand-700 hover:underline">
        {open ? 'Chiudi modifica' : 'Modifica'}
      </button>
      {open && (
        <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          {state?.error && <Alert kind="error">{state.error}</Alert>}
          {state?.success && <Alert kind="success">{state.success}</Alert>}
          <input type="hidden" name="id" value={service.id} />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <Field label="Nome" name="name" required defaultValue={service.name} />
            <Field label="Durata (min)" name="durationMin" type="number" required defaultValue={String(service.durationMin)} min={5} max={480} />
            <Field label="Prezzo (€)" name="priceEuro" type="number" required defaultValue={(service.priceCents / 100).toFixed(2)} min={0} step="0.01" />
            <SelectField label="Modalità" name="mode" defaultValue={service.mode} options={MODE_OPTIONS} />
          </div>
          <button type="submit" className="btn-secondary !py-1.5 text-xs">Salva modifiche</button>
        </form>
      )}
    </div>
  );
}

export function ToggleServiceButton({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const res = await toggleServiceAction(id);
          if (res?.error) setError(res.error);
        })}
        className={`text-xs hover:underline disabled:opacity-50 ${active ? 'text-red-700' : 'text-emerald-700'}`}
      >
        {pending ? 'Attendi…' : active ? 'Disattiva' : 'Riattiva'}
      </button>
      {error && <span className="text-xs text-red-700 ml-2">{error}</span>}
    </span>
  );
}
