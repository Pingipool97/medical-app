'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { issueDocumentAction, type ActionState } from '@/app/actions/issued';
import { Alert, Field, TextArea } from '@/components/ui';

export function IssueDocumentForm({
  patientId, requestId, kinds, defaultKind, defaultTitle, defaultBody, disabled,
}: {
  patientId: string;
  requestId?: string;
  kinds: { value: string; label: string }[];
  defaultKind?: string;
  defaultTitle?: string;
  defaultBody?: string;
  disabled?: boolean;
}) {
  const [state, action] = useFormState<ActionState, FormData>(issueDocumentAction, null);
  const [kind, setKind] = useState(defaultKind && kinds.some((k) => k.value === defaultKind) ? defaultKind : '');

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}

      <input type="hidden" name="patientId" value={patientId} />
      {requestId && <input type="hidden" name="requestId" value={requestId} />}

      <div>
        <label className="label" htmlFor="kind">Tipo di documento<span className="text-red-600" aria-hidden> *</span></label>
        <select id="kind" name="kind" required className="input" value={kind} onChange={(e) => setKind(e.target.value)} disabled={disabled}>
          <option value="" disabled>Seleziona…</option>
          {kinds.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </div>

      {kind === 'PROMEMORIA_NRE' && (
        <Field
          label="Codice NRE della ricetta dematerializzata"
          name="nreCode"
          required
          placeholder="es. 0500A4012345678"
          hint="L’NRE è generato dal Sistema TS al momento dell’emissione della ricetta: qui ne invii solo il promemoria al paziente."
        />
      )}

      <Field label="Titolo" name="title" required defaultValue={defaultTitle} placeholder="es. Referto visita cardiologica" disabled={disabled} />
      <TextArea label="Contenuto" name="body" required rows={10} defaultValue={defaultBody} placeholder="Testo del documento…" />

      <button type="submit" className="btn-primary" disabled={disabled}>
        {disabled ? 'Emissione non disponibile (account in verifica)' : 'Emetti e invia al paziente'}
      </button>
    </form>
  );
}
