'use client';

import { useState, useTransition } from 'react';
import { updateRequestStatusAction, type ActionState } from '@/app/actions/communication';
import { Alert } from '@/components/ui';

// Azioni di transizione di stato per una richiesta, coerenti con le transizioni valide lato server.
export function RequestActions({ requestId, status }: { requestId: string; status: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const go = (newStatus: string, note?: string) =>
    start(async () => setState(await updateRequestStatusAction(requestId, newStatus, note)));

  if (state?.success) return <Alert kind="success">{state.success}</Alert>;

  const canTake = status === 'NUOVA';
  const canAskInfo = status === 'PRESA_IN_CARICO';
  const canResume = status === 'ATTESA_INFO';
  const canFulfill = status === 'PRESA_IN_CARICO' || status === 'ATTESA_INFO';
  const canReject = ['NUOVA', 'PRESA_IN_CARICO', 'ATTESA_INFO'].includes(status);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {canTake && (
          <button type="button" disabled={pending} onClick={() => go('PRESA_IN_CARICO')} className="btn-primary !py-1.5 text-xs">
            Prendi in carico
          </button>
        )}
        {canAskInfo && (
          <button type="button" disabled={pending} onClick={() => go('ATTESA_INFO')} className="btn-secondary !py-1.5 text-xs">
            Chiedi informazioni al paziente
          </button>
        )}
        {canResume && (
          <button type="button" disabled={pending} onClick={() => go('PRESA_IN_CARICO')} className="btn-secondary !py-1.5 text-xs">
            Riprendi in carico
          </button>
        )}
        {canFulfill && (
          <button type="button" disabled={pending} onClick={() => go('EVASA')} className="btn-primary !py-1.5 text-xs">
            Segna come evasa
          </button>
        )}
        {canReject && (
          <button type="button" disabled={pending} onClick={() => setShowReject((v) => !v)} className="btn-danger !py-1.5 text-xs">
            Rifiuta…
          </button>
        )}
      </div>

      {showReject && (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <label className="label" htmlFor={`reject-${requestId}`}>Motivo del rifiuto (obbligatorio, visibile al paziente)</label>
          <textarea
            id={`reject-${requestId}`}
            className="input"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Spiega al paziente perché la richiesta non può essere accolta e cosa fare in alternativa."
          />
          <button
            type="button"
            disabled={pending || !rejectReason.trim()}
            onClick={() => go('RIFIUTATA', rejectReason.trim())}
            className="btn-danger !py-1.5 text-xs"
          >
            {pending ? 'Invio…' : 'Conferma il rifiuto'}
          </button>
        </div>
      )}

      {state?.error && <Alert kind="error">{state.error}</Alert>}
    </div>
  );
}
