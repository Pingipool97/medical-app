'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useFormState } from 'react-dom';
import {
  saveAvailabilityAction, addExceptionAction, deleteAvailabilityAction, deleteExceptionAction,
  completeAppointmentAction, cancelAppointmentAction, rescheduleAppointmentAction,
  createAppointmentByDoctorAction, setAppointmentStatusAction, setPatientColorAction, setServiceColorAction,
  type ActionState,
} from '@/app/actions/agenda';
import { generateVisitPrepAction, type ActionState as AiActionState } from '@/app/actions/ai';
import { createServiceAction, updateServiceAction, toggleServiceAction, type ActionState as LocalActionState } from '../actions';
import { Alert, Badge, Field, SelectField, statusBadgeColor } from '@/components/ui';
import { Icon } from '@/components/icons';
import Calendar, { type CalEvent } from '@/components/calendar';
import { APPOINTMENT_STATUS_LABEL, PATIENT_COLORS, STATUS_COLOR } from '@/lib/constants';

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

export function EditServiceForm({ service }: { service: { id: string; name: string; durationMin: number; priceCents: number; mode: string } }) {
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

export function DeleteExceptionButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const res = await deleteExceptionAction(id);
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

// ── Calendario e azioni collegate ──

type PatientOpt = { id: string; name: string; color: string };
type ServiceOpt = { id: string; name: string; durationMin: number; mode: string; color: string };
type Upcoming = {
  id: string;
  status: string;
  when: string;
  patient: string;
  patientId: string;
  service: string | null;
  notes: string;
};

/** Modale di creazione appuntamento, aperta dal clic su uno slot libero del calendario. */
function CreateDialog({
  slot,
  patients,
  services,
  onClose,
}: {
  slot: { day: string; time: string };
  patients: PatientOpt[];
  services: ServiceOpt[];
  onClose: () => void;
}) {
  const [state, action] = useFormState<ActionState, FormData>(createAppointmentByDoctorAction, null);
  if (state?.success) {
    // La revalidatePath dell'action ha già aggiornato la pagina: resta solo da chiudere.
    return (
      <Overlay onClose={onClose}>
        <Alert kind="success">{state.success}</Alert>
        <button type="button" onClick={onClose} className="btn-primary w-full mt-3">Chiudi</button>
      </Overlay>
    );
  }
  return (
    <Overlay onClose={onClose}>
      <h3 className="text-lg font-semibold text-brand-950">Nuovo appuntamento</h3>
      <p className="text-sm text-slate-600 mb-3">
        {slot.day.split('-').reverse().join('/')} alle <span className="tabular-nums font-medium">{slot.time}</span>
      </p>
      <form action={action} className="space-y-3">
        {state?.error && <Alert kind="error">{state.error}</Alert>}
        <input type="hidden" name="date" value={slot.day} />
        <input type="hidden" name="time" value={slot.time} />
        {patients.length === 0 ? (
          <Alert kind="warn">Non hai ancora pazienti collegati: l’appuntamento si può creare solo per un paziente collegato.</Alert>
        ) : (
          <SelectField
            label="Paziente"
            name="patientId"
            required
            options={patients.map((p) => ({ value: p.id, label: p.name }))}
          />
        )}
        <SelectField
          label="Prestazione"
          name="serviceId"
          options={services.map((s) => ({ value: s.id, label: `${s.name} (${s.durationMin} min)` }))}
          placeholder="Nessuna — durata libera"
        />
        <Field label="Durata se nessuna prestazione (min)" name="durationMin" type="number" defaultValue="30" min={5} max={480} />
        <SelectField label="Modalità" name="mode" defaultValue="PRESENZA" options={MODE_OPTIONS.filter((m) => m.value !== 'ENTRAMBI')} />
        <Field label="Motivo (facoltativo)" name="note" placeholder="es. controllo post-operatorio" />
        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn-primary flex-1" disabled={patients.length === 0}>Crea appuntamento</button>
          <button type="button" onClick={onClose} className="btn-secondary">Annulla</button>
        </div>
      </form>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="card p-5 w-full max-w-md my-auto">{children}</div>
    </div>
  );
}

/** Righe di scelta colore riusabili dalle due sezioni del pannello. */
function ColorRow({
  label,
  current,
  onPick,
  disabled,
}: {
  label: string;
  current: string;
  onPick: (key: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex-1 truncate text-slate-700">{label}</span>
      <div className="flex gap-1">
        {PATIENT_COLORS.filter((c) => c.key !== 'slate').map((c) => {
          const active = current === c.key;
          return (
            <button
              key={c.key}
              type="button"
              title={c.label}
              aria-label={`${label}: ${c.label}`}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onPick(c.key)}
              className={`w-4 h-4 rounded-full ${c.dot} ${active ? 'ring-2 ring-offset-1 ring-slate-800' : 'opacity-50 hover:opacity-100'}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Pannello colori a tendina: prestazioni e pazienti.
 * Le prestazioni vengono prima perché sono la modalità predefinita del calendario.
 */
function ColorPanel({ services, patients }: { services: ServiceOpt[]; patients: PatientOpt[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [svcColors, setSvcColors] = useState<Record<string, string>>(
    Object.fromEntries(services.map((s) => [s.id, s.color])),
  );
  const [patColors, setPatColors] = useState<Record<string, string>>(
    Object.fromEntries(patients.map((p) => [p.id, p.color])),
  );

  if (services.length === 0 && patients.length === 0) return null;

  return (
    <div className="border-t border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 text-sm text-left text-slate-600 hover:bg-slate-50 flex items-center gap-2"
        aria-expanded={open}
      >
        <Icon name="settings" className="w-4 h-4 text-slate-400" />
        Colori del calendario
        <span className="ml-auto text-slate-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-4 max-h-80 overflow-y-auto">
          {services.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Prestazioni</p>
              {services.map((s) => (
                <ColorRow
                  key={s.id}
                  label={s.name}
                  current={svcColors[s.id] ?? s.color}
                  disabled={pending}
                  onPick={(key) => {
                    setSvcColors((v) => ({ ...v, [s.id]: key }));
                    start(async () => { await setServiceColorAction(s.id, key); });
                  }}
                />
              ))}
            </div>
          )}
          {patients.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pazienti</p>
              {patients.map((p) => (
                <ColorRow
                  key={p.id}
                  label={p.name}
                  current={patColors[p.id] ?? p.color}
                  disabled={pending}
                  onPick={(key) => {
                    setPatColors((v) => ({ ...v, [p.id]: key }));
                    start(async () => { await setPatientColorAction(p.id, key); });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusButton({ id, status, label }: { id: string; status: 'CONFERMATO' | 'NO_SHOW'; label: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  if (state?.success) return <span className="text-xs text-emerald-700">{state.success}</span>;
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await setAppointmentStatusAction(id, status)))}
        className="btn-secondary !py-1.5 text-xs"
      >
        {pending ? 'Attendi…' : label}
      </button>
      {state?.error && <span className="text-xs text-red-700 ml-2">{state.error}</span>}
    </span>
  );
}

export default function AgendaClient({
  events,
  today,
  patients,
  services,
  upcoming,
}: {
  events: CalEvent[];
  today: string;
  patients: PatientOpt[];
  services: ServiceOpt[];
  upcoming: Upcoming[];
}) {
  const [slot, setSlot] = useState<{ day: string; time: string } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Una legenda per modalità: mostra solo ciò che compare davvero nel periodo caricato.
  const serviceKeys = new Set(events.map((e) => e.colors?.service).filter(Boolean) as string[]);
  const patientKeys = new Set(events.map((e) => e.colors?.patient).filter(Boolean) as string[]);
  const legends = {
    service: services.filter((s) => serviceKeys.has(s.color)).map((s) => ({ key: s.color, label: s.name })),
    patient: patients.filter((p) => patientKeys.has(p.color)).map((p) => ({ key: p.color, label: p.name })),
    status: [...new Set(events.map((e) => e.status))].map((st) => ({
      key: STATUS_COLOR[st] ?? 'slate',
      label: APPOINTMENT_STATUS_LABEL[st] ?? st,
    })),
  };

  return (
    <>
      {moveError && <Alert kind="error">{moveError}</Alert>}

      <div className="space-y-0">
        <Calendar
          events={events}
          today={today}
          canEdit
          legends={legends}
          colorModes={['service', 'patient', 'status']}
          emptyHint="Nessun appuntamento in questo periodo. Clicca su uno spazio libero per crearne uno."
          onCreate={(day, time) => { setMoveError(null); setSlot({ day, time }); }}
          onMove={async (id, day, time) => {
            setMoveError(null);
            const res = await rescheduleAppointmentAction(id, day, time);
            if (res?.error) setMoveError(res.error);
          }}
        />
        <div className="card rounded-t-none border-t-0">
          <ColorPanel services={services} patients={patients} />
        </div>
      </div>

      {slot && (
        <CreateDialog slot={slot} patients={patients} services={services} onClose={() => setSlot(null)} />
      )}

      {upcoming.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-brand-950 mb-3">Prossimi appuntamenti</h3>
          <ul className="divide-y divide-slate-100">
            {upcoming.map((a) => (
              <li key={a.id} className="py-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="tabular-nums text-slate-600">{a.when}</span>
                  <Link href={`/medico/pazienti/${a.patientId}`} className="font-medium text-brand-700 hover:underline">
                    {a.patient}
                  </Link>
                  {a.service && <span className="text-slate-500">· {a.service}</span>}
                  <Badge color={statusBadgeColor(a.status)}>{APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}</Badge>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  {a.status === 'PRENOTATO' && <StatusButton id={a.id} status="CONFERMATO" label="Conferma" />}
                  <BriefingButton appointmentId={a.id} />
                  <CompleteWithNotesForm appointmentId={a.id} defaultNotes={a.notes} />
                  <Link href={`/medico/pazienti/${a.patientId}/emetti`} className="btn-secondary !py-1.5 text-xs">
                    Genera referto
                  </Link>
                  <CancelAppointmentButton appointmentId={a.id} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
