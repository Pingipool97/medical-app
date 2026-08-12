'use client';

import { useState, useTransition } from 'react';
import { cancelAppointmentAction, joinWaitlistAction, type ActionState } from '@/app/actions/agenda';
import { Alert } from '@/components/ui';

export function CancelAppointmentForm({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);

  if (state?.success) return <Alert kind="success">{state.success}</Alert>;

  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary !py-1.5 text-xs">Disdici</button>
        {state?.error && <p className="text-xs text-red-700 mt-1">{state.error}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <label className="label" htmlFor={`motivo-${appointmentId}`}>Motivo della disdetta (facoltativo)</label>
      <input
        id={`motivo-${appointmentId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="es. impegno improvviso"
        className="input"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setState(await cancelAppointmentAction(appointmentId, reason || undefined)))}
          className="btn-danger !py-1.5 text-xs"
        >
          {pending ? 'Disdico…' : 'Conferma la disdetta'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary !py-1.5 text-xs">Annulla</button>
      </div>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
    </div>
  );
}

export function JoinWaitlistForm({ doctors }: {
  doctors: { id: string; label: string; services: { id: string; label: string }[] }[];
}) {
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? '');
  const [serviceId, setServiceId] = useState('');
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const doctor = doctors.find((d) => d.id === doctorId);

  if (state?.success) return <Alert kind="success">{state.success}</Alert>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="wl-doctor">Medico</label>
          <select id="wl-doctor" value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setServiceId(''); }} className="input">
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="wl-service">Prestazione (facoltativa)</label>
          <select id="wl-service" value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="input">
            <option value="">Qualsiasi</option>
            {doctor?.services.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <button
        type="button"
        disabled={pending || !doctorId}
        onClick={() => start(async () => setState(await joinWaitlistAction(doctorId, serviceId || null)))}
        className="btn-secondary"
      >
        {pending ? 'Iscrizione…' : 'Mettimi in lista d’attesa'}
      </button>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
    </div>
  );
}
