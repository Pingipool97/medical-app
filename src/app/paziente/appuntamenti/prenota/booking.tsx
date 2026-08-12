'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { computeFreeSlots, bookAppointmentAction, type ActionState } from '@/app/actions/agenda';
import { Alert } from '@/components/ui';

export type BookingDoctor = {
  id: string;
  label: string;
  services: { id: string; name: string; durationMin: number; priceLabel: string; mode: string }[];
};

const MODE_LABEL: Record<string, string> = {
  PRESENZA: 'Solo in presenza',
  VIDEO: 'Solo in videoconsulto',
  ENTRAMBI: 'In presenza o in video',
};

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full text-base py-3">
      {pending ? 'Prenotazione in corso…' : 'Conferma la prenotazione'}
    </button>
  );
}

export function BookingFlow({ doctors }: { doctors: BookingDoctor[] }) {
  const [doctorId, setDoctorId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<string[] | null>(null);
  const [time, setTime] = useState('');
  const [loadingSlots, startSlots] = useTransition();
  const [state, formAction] = useFormState<ActionState, FormData>(bookAppointmentAction, null);

  const doctor = doctors.find((d) => d.id === doctorId);
  const service = doctor?.services.find((s) => s.id === serviceId);
  const minDate = new Date().toISOString().slice(0, 10);

  const loadSlots = (d: string) => {
    setDate(d);
    setTime('');
    setSlots(null);
    if (d && doctorId && serviceId) {
      startSlots(async () => {
        const free = await computeFreeSlots(doctorId, d, serviceId);
        setSlots(free);
      });
    }
  };

  if (state?.success) {
    return <Alert kind="success">{state.success} La trovi tra i tuoi appuntamenti.</Alert>;
  }

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && <Alert kind="error">{state.error}</Alert>}

      {/* 1. Medico */}
      <fieldset className="border border-slate-200 rounded-lg p-4">
        <legend className="text-sm font-semibold text-slate-800 px-1">1. Con quale medico</legend>
        <label className="label" htmlFor="prenota-medico">Medico</label>
        <select
          id="prenota-medico"
          name="doctorId"
          required
          value={doctorId}
          onChange={(e) => { setDoctorId(e.target.value); setServiceId(''); setDate(''); setSlots(null); setTime(''); }}
          className="input"
        >
          <option value="" disabled>Seleziona il medico…</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </fieldset>

      {/* 2. Prestazione */}
      {doctor && (
        <fieldset className="border border-slate-200 rounded-lg p-4">
          <legend className="text-sm font-semibold text-slate-800 px-1">2. Che tipo di visita</legend>
          {doctor.services.length === 0 ? (
            <p className="text-sm text-slate-500">Questo medico non ha ancora prestazioni prenotabili online. Contatta lo studio.</p>
          ) : (
            <div className="space-y-2" role="radiogroup" aria-label="Prestazione">
              {doctor.services.map((s) => (
                <label key={s.id} className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer ${serviceId === s.id ? 'border-brand-600 bg-brand-50' : 'border-slate-200'}`}>
                  <input
                    type="radio"
                    name="serviceId"
                    value={s.id}
                    required
                    checked={serviceId === s.id}
                    onChange={() => { setServiceId(s.id); setDate(''); setSlots(null); setTime(''); }}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">{s.name}</span>
                    <span className="block text-xs text-slate-500">
                      Durata {s.durationMin} minuti · {s.priceLabel} · {MODE_LABEL[s.mode] ?? s.mode}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

      {/* 3. Data e orario */}
      {service && (
        <fieldset className="border border-slate-200 rounded-lg p-4 space-y-3">
          <legend className="text-sm font-semibold text-slate-800 px-1">3. Quando</legend>
          <div>
            <label className="label" htmlFor="prenota-data">Scegli il giorno</label>
            <input
              id="prenota-data"
              name="date"
              type="date"
              required
              min={minDate}
              value={date}
              onChange={(e) => loadSlots(e.target.value)}
              className="input !w-auto"
            />
          </div>
          {loadingSlots && <p className="text-sm text-slate-500">Cerco gli orari liberi…</p>}
          {!loadingSlots && slots && slots.length === 0 && (
            <Alert kind="warn">Nessun orario libero in questo giorno: prova un altro giorno, oppure mettiti in lista d’attesa dalla pagina Appuntamenti.</Alert>
          )}
          {!loadingSlots && slots && slots.length > 0 && (
            <div>
              <p className="label">Orari liberi</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Orario">
                {slots.map((s) => (
                  <label key={s} className={`px-3 py-2 rounded-lg border text-sm cursor-pointer ${time === s ? 'border-brand-600 bg-brand-700 text-white font-semibold' : 'border-slate-300 bg-white text-slate-700'}`}>
                    <input
                      type="radio"
                      name="time"
                      value={s}
                      required
                      checked={time === s}
                      onChange={() => setTime(s)}
                      className="sr-only"
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
          )}
          {service.mode === 'ENTRAMBI' && (
            <div>
              <label className="label" htmlFor="prenota-mode">Come preferisci fare la visita</label>
              <select id="prenota-mode" name="mode" defaultValue="PRESENZA" className="input !w-auto">
                <option value="PRESENZA">In presenza</option>
                <option value="VIDEO">In videoconsulto</option>
              </select>
            </div>
          )}
        </fieldset>
      )}

      {/* 4. Questionario pre-visita */}
      {time && (
        <fieldset className="border border-slate-200 rounded-lg p-4">
          <legend className="text-sm font-semibold text-slate-800 px-1">4. Prepariamo la visita</legend>
          <label className="label" htmlFor="questionnaire">Motivo della visita</label>
          <textarea
            id="questionnaire"
            name="questionnaire"
            rows={4}
            placeholder="Racconta in poche parole perché vuoi fare questa visita: aiuterà il medico a prepararsi."
            className="input"
          />
        </fieldset>
      )}

      {/* 5. Conferma */}
      {time && service && doctor && (
        <div className="space-y-3">
          <Alert kind="info">
            Stai prenotando: <strong>{service.name}</strong> con <strong>{doctor.label}</strong> il <strong>{new Date(date + 'T00:00:00').toLocaleDateString('it-IT')}</strong> alle <strong>{time}</strong> ({service.priceLabel}).
          </Alert>
          <ConfirmButton />
        </div>
      )}
    </form>
  );
}
