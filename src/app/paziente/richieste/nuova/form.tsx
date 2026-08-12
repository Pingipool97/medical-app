'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createRequestAction, type ActionState } from '@/app/actions/communication';
import { Alert, Field, SelectField, TextArea } from '@/components/ui';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? 'Invio in corso…' : label}
    </button>
  );
}

export function NewRequestForm({ doctors, types, documents }: {
  doctors: { id: string; label: string }[];
  types: { value: string; label: string }[];
  documents: { id: string; label: string }[];
}) {
  const [state, action] = useFormState<ActionState, FormData>(createRequestAction, null);

  if (state?.success) {
    return <Alert kind="success">{state.success}</Alert>;
  }

  const hasRedFlags = !!state?.redFlags && state.redFlags.length > 0;

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}

      {/* Interstitial sintomi d'allarme: blocco rosso, invio non avvenuto */}
      {hasRedFlags && (
        <div className="alert-critical" role="alert">
          <p className="font-bold text-base">⚠️ I sintomi che descrivi potrebbero richiedere assistenza immediata: chiama il 112</p>
          <p className="text-sm mt-2">Abbiamo riconosciuto queste parole nel tuo testo:</p>
          <ul className="list-disc list-inside text-sm mt-1">
            {state!.redFlags!.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
          <p className="text-sm mt-2">
            La tua richiesta <strong>non è stata inviata</strong>. Le richieste non sono un canale di emergenza:
            il medico potrebbe leggerla anche dopo molte ore.
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm font-medium">
            <input type="checkbox" name="confirmedEmergency" className="mt-0.5 h-5 w-5" />
            Non è un’emergenza, voglio comunque inviare la richiesta
          </label>
        </div>
      )}

      <SelectField label="A quale medico" name="doctorId" required options={doctors.map((d) => ({ value: d.id, label: d.label }))} hint="Vedi accanto al nome entro quante ore il medico dichiara di rispondere." />
      <SelectField label="Tipo di richiesta" name="typeCode" required options={types} />
      <Field label="Oggetto" name="subject" required placeholder="es. Rinnovo ricetta per la pressione" />
      <TextArea label="Descrivi la tua richiesta" name="body" required rows={6} placeholder="Scrivi qui cosa ti serve, con parole tue." />

      {documents.length > 0 && (
        <div>
          <label className="label" htmlFor="attachmentId">Allega documenti (facoltativo)</label>
          <select id="attachmentId" name="attachmentId" multiple size={Math.min(documents.length, 5)} className="input">
            {documents.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Tieni premuto Ctrl (o Cmd sul Mac) per selezionarne più di uno. Sul telefono, tocca ogni documento da allegare.
          </p>
        </div>
      )}

      <SubmitButton label={hasRedFlags ? 'Invia comunque la richiesta' : 'Invia la richiesta'} />
    </form>
  );
}
