'use client';

import { useState, useTransition } from 'react';
import { requestPremiumAction, cancelPremiumAction, type ActionState } from '@/app/actions/subscription';
import { Alert } from '@/components/ui';

export function RequestPremiumButton() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);

  if (state?.success) return <Alert kind="success">{state.success}</Alert>;

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await requestPremiumAction()))}
        className="btn-primary"
      >
        {pending ? 'Invio…' : 'Attiva Premium'}
      </button>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <p className="text-xs text-slate-500">
        Il pagamento online non è ancora attivo: la richiesta viene confermata manualmente dallo studio.
      </p>
    </div>
  );
}

export function CancelPremiumButton() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);

  if (state?.success) return <Alert kind="success">{state.success}</Alert>;

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm('Vuoi disdire il rinnovo? Le funzioni IA restano attive fino alla scadenza già pagata.')) {
            start(async () => setState(await cancelPremiumAction()));
          }
        }}
        className="btn-secondary"
      >
        {pending ? 'Attendi…' : 'Disdici il rinnovo'}
      </button>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
    </div>
  );
}
