'use client';

import { useState, useTransition } from 'react';
import { useFormState } from 'react-dom';
import { requestLinkAction, revokeLinkAction, type ActionState } from '@/app/actions/communication';
import { Alert } from '@/components/ui';

export function RevokeLinkButton({ linkId }: { linkId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  if (state?.success) return <Alert kind="success">{state.success}</Alert>;
  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            window.confirm(
              'Vuoi revocare l’accesso a questo medico?\n\nCosa succede:\n• il medico non vedrà più il tuo diario né i nuovi documenti;\n• non potrai più inviargli richieste o messaggi;\n• conserverà copia dei documenti già ricevuti, come previsto dagli obblighi di legge.'
            )
          ) {
            start(async () => setState(await revokeLinkAction(linkId)));
          }
        }}
        className="btn-danger !py-1.5 text-xs"
      >
        {pending ? 'Revoco…' : 'Revoca accesso'}
      </button>
      {state?.error && <p className="text-xs text-red-700 mt-1">{state.error}</p>}
    </div>
  );
}

export function ConnectDoctorForm({ doctorId }: { doctorId: string }) {
  const [state, action] = useFormState<ActionState, FormData>(requestLinkAction, null);
  if (state?.success) return <p className="text-xs text-emerald-700 max-w-[220px]">{state.success}</p>;
  return (
    <form action={action} className="text-right">
      <input type="hidden" name="doctorId" value={doctorId} />
      <button type="submit" className="btn-primary !py-1.5 text-xs">Chiedi il collegamento</button>
      {state?.error && <p className="text-xs text-red-700 mt-1">{state.error}</p>}
    </form>
  );
}
