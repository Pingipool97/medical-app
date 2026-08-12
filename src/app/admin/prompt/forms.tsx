'use client';

import { useFormState } from 'react-dom';
import { savePromptVersionAction, activatePromptVersionAction, type ActionState } from '../actions';
import { Alert } from '@/components/ui';

export function PromptEditor({ functionKey, initialContent, sourceVersion }: { functionKey: string; initialContent: string; sourceVersion?: number }) {
  const [state, action] = useFormState<ActionState, FormData>(savePromptVersionAction, null);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      <input type="hidden" name="functionKey" value={functionKey} />
      <div>
        <label className="label" htmlFor="content">
          Contenuto del prompt{sourceVersion ? ` (partendo dalla versione ${sourceVersion})` : ''}
        </label>
        <textarea
          id="content"
          name="content"
          rows={18}
          className="input font-mono text-sm"
          defaultValue={initialContent}
          key={`${functionKey}-${sourceVersion ?? 'new'}`}
          placeholder="Scrivi qui il prompt di sistema…"
          required
        />
      </div>
      <button type="submit" className="btn-primary">Salva come nuova versione</button>
      <p className="text-xs text-slate-500">La nuova versione viene salvata non attiva: va attivata esplicitamente dallo storico.</p>
    </form>
  );
}

export function ActivateVersionButton({ id, version }: { id: string; version: number }) {
  const [state, action] = useFormState<ActionState, FormData>(activatePromptVersionAction, null);
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn-secondary text-xs px-3 py-1.5">Attiva questa versione</button>
      {state?.error && <span className="text-xs text-red-700">{state.error}</span>}
      {state?.success && <span className="text-xs text-emerald-700">{state.success}</span>}
    </form>
  );
}
