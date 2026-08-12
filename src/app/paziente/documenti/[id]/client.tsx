'use client';

import { useState, useTransition } from 'react';
import {
  retryProcessingAction, confirmDocDateAction, resolveReviewAction,
  confirmLabResultAction, shareDocumentAction, revokeShareAction, type ActionState,
} from '@/app/actions/documents';
import { Alert } from '@/components/ui';
import { Icon } from '@/components/icons';

function useAction() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const run = (fn: () => Promise<ActionState>) => start(async () => setState(await fn()));
  return { pending, state, run };
}

export function RetryProcessingButton({ documentId }: { documentId: string }) {
  const { pending, state, run } = useAction();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} onClick={() => run(() => retryProcessingAction(documentId))} className="btn-secondary inline-flex items-center gap-1.5">
        {pending ? 'Riavvio…' : <><Icon name="refresh" className="w-4 h-4" /> Riprova elaborazione</>}
      </button>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
    </div>
  );
}

export function ConfirmDateForm({ documentId, suggested }: { documentId: string; suggested: string }) {
  const { pending, state, run } = useAction();
  const [date, setDate] = useState(suggested);
  if (state?.success) return <Alert kind="success">{state.success}</Alert>;
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 flex-wrap">
        <div>
          <label className="label" htmlFor="conferma-data">Data del documento</label>
          <input id="conferma-data" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input !w-auto" />
        </div>
        <button type="button" disabled={pending || !date} onClick={() => run(() => confirmDocDateAction(documentId, date))} className="btn-primary">
          {pending ? 'Salvo…' : 'Conferma la data'}
        </button>
      </div>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
    </div>
  );
}

export function ResolveReviewButtons({ documentId }: { documentId: string }) {
  const { pending, state, run } = useAction();
  if (state?.success) return <Alert kind="success">{state.success}</Alert>;
  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <button type="button" disabled={pending} onClick={() => run(() => resolveReviewAction(documentId, 'CONFERMA'))} className="btn-primary">
          Non è un duplicato, conferma
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm('Vuoi eliminare questo documento? L’operazione non si può annullare.')) {
              run(() => resolveReviewAction(documentId, 'ELIMINA'));
            }
          }}
          className="btn-danger"
        >
          È un doppione, elimina
        </button>
      </div>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
    </div>
  );
}

export function LabResultButtons({ labResultId }: { labResultId: string }) {
  const { pending, state, run } = useAction();
  if (state?.success) return <span className="text-xs text-emerald-700">{state.success}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={pending} onClick={() => run(() => confirmLabResultAction(labResultId, true))} className="text-xs text-emerald-700 font-semibold hover:underline disabled:opacity-50">
        Conferma
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm('Il valore verrà eliminato perché letto male. Confermi?')) run(() => confirmLabResultAction(labResultId, false));
        }}
        className="text-xs text-red-700 hover:underline disabled:opacity-50"
      >
        Elimina
      </button>
      {state?.error && <span className="text-xs text-red-700">{state.error}</span>}
    </span>
  );
}

export function ShareButtons({ documentId, doctorId, shared }: { documentId: string; doctorId: string; shared: boolean }) {
  const { pending, state, run } = useAction();
  return (
    <div className="text-right">
      {shared ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm('Vuoi revocare la condivisione? Il medico non vedrà più questo documento, ma conserva copia di ciò che ha già ricevuto, come previsto per legge.')) {
              run(() => revokeShareAction(documentId, doctorId));
            }
          }}
          className="btn-secondary !py-1.5 text-xs"
        >
          {pending ? 'Revoco…' : 'Revoca condivisione'}
        </button>
      ) : (
        <button type="button" disabled={pending} onClick={() => run(() => shareDocumentAction(documentId, doctorId))} className="btn-primary !py-1.5 text-xs">
          {pending ? 'Condivido…' : 'Condividi'}
        </button>
      )}
      {state?.error && <p className="text-xs text-red-700 mt-1">{state.error}</p>}
      {state?.success && <p className="text-xs text-emerald-700 mt-1">{state.success}</p>}
    </div>
  );
}
