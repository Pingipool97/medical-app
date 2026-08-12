'use client';

import { useState, useTransition } from 'react';
import { respondLinkAction, type ActionState } from '@/app/actions/communication';

// Accetta/Rifiuta una richiesta di collegamento. Disabilitato se l'account è in verifica.
export function LinkResponseButtons({ linkId, disabled }: { linkId: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);

  if (state?.success) return <span className="text-xs text-emerald-700 font-medium">{state.success}</span>;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() => start(async () => setState(await respondLinkAction(linkId, true)))}
        className="btn-primary !py-1.5 text-xs"
        title={disabled ? 'Account in verifica: non puoi accettare pazienti' : undefined}
      >
        {pending ? 'Attendi…' : 'Accetta'}
      </button>
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() => {
          if (window.confirm('Vuoi rifiutare la richiesta di collegamento? Il paziente verrà avvisato.')) {
            start(async () => setState(await respondLinkAction(linkId, false)));
          }
        }}
        className="btn-secondary !py-1.5 text-xs"
      >
        Rifiuta
      </button>
      {state?.error && <span className="text-xs text-red-700">{state.error}</span>}
    </div>
  );
}
