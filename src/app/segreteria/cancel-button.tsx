'use client';

import { useState, useTransition } from 'react';
import { staffCancelAppointmentAction, type ActionState } from './actions';

export function StaffCancelButton({ appointmentId }: { appointmentId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  if (state?.success) return <span className="text-xs text-emerald-700">{state.success}</span>;
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm('Vuoi annullare questo appuntamento? Paziente e medico verranno avvisati.')) {
            start(async () => setState(await staffCancelAppointmentAction(appointmentId)));
          }
        }}
        className="btn-danger !py-1.5 text-xs"
      >
        {pending ? 'Annullo…' : 'Annulla'}
      </button>
      {state?.error && <span className="text-xs text-red-700 ml-2">{state.error}</span>}
    </span>
  );
}
