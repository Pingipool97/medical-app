'use client';

import { useState, useTransition } from 'react';
import { cancelRequestAction, type ActionState } from '@/app/actions/communication';

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  if (state?.success) return <span className="text-xs text-emerald-700">{state.success}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm('Vuoi annullare questa richiesta?')) {
            start(async () => setState(await cancelRequestAction(requestId)));
          }
        }}
        className="btn-secondary !py-1.5 text-xs"
      >
        {pending ? 'Annullo…' : 'Annulla richiesta'}
      </button>
      {state?.error && <span className="text-xs text-red-700">{state.error}</span>}
    </span>
  );
}
