'use client';

import { useFormState } from 'react-dom';
import { setUserStatusAction, verifyDoctorAction, type ActionState } from '../actions';
import { Alert } from '@/components/ui';

export function UserStatusButton({ userId, suspended }: { userId: string; suspended: boolean }) {
  const [state, action] = useFormState<ActionState, FormData>(setUserStatusAction, null);
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={suspended ? 'ACTIVE' : 'SUSPENDED'} />
      <button type="submit" className={`text-xs px-3 py-1.5 ${suspended ? 'btn-secondary' : 'btn-danger'}`}>
        {suspended ? 'Riattiva' : 'Sospendi'}
      </button>
      {state?.error && <span className="text-xs text-red-700 max-w-[200px]">{state.error}</span>}
      {state?.success && <span className="text-xs text-emerald-700">{state.success}</span>}
    </form>
  );
}

export function VerifyDoctorForm({ doctorId }: { doctorId: string }) {
  const [state, action] = useFormState<ActionState, FormData>(verifyDoctorAction, null);
  return (
    <form action={action} className="space-y-2">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      <input type="hidden" name="doctorId" value={doctorId} />
      <div>
        <label className="label" htmlFor={`note-${doctorId}`}>Nota di verifica</label>
        <textarea
          id={`note-${doctorId}`}
          name="note"
          rows={2}
          className="input text-sm"
          placeholder="Es. iscrizione verificata sul portale FNOMCeO — obbligatoria in caso di rifiuto"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="VERIFIED" className="btn-primary text-sm">Verifica</button>
        <button type="submit" name="decision" value="REJECTED" className="btn-danger text-sm">Rifiuta</button>
      </div>
    </form>
  );
}
