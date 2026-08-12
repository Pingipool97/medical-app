'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { sendMessageAction, type ActionState } from '@/app/actions/communication';
import { Alert } from '@/components/ui';
import { Icon } from '@/components/icons';

function SendButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary shrink-0">
      {pending ? 'Invio…' : label}
    </button>
  );
}

export function SendMessageForm({ conversationId, documents }: {
  conversationId: string;
  documents: { id: string; label: string }[];
}) {
  const [state, action] = useFormState<ActionState, FormData>(sendMessageAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const hasRedFlags = !!state?.redFlags && state.redFlags.length > 0;

  return (
    <form ref={formRef} action={action} className="space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}

      {hasRedFlags && (
        <div className="alert-critical" role="alert">
          <p className="font-bold">⚠️ I sintomi che descrivi potrebbero richiedere assistenza immediata: chiama il 112</p>
          <p className="text-sm mt-1">Parole riconosciute nel tuo messaggio:</p>
          <ul className="list-disc list-inside text-sm">
            {state!.redFlags!.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
          <p className="text-sm mt-1">Il messaggio <strong>non è stato inviato</strong>: il medico potrebbe leggerlo anche dopo molte ore.</p>
          <label className="mt-2 flex items-start gap-2 text-sm font-medium">
            <input type="checkbox" name="confirmedEmergency" className="mt-0.5 h-5 w-5" />
            Non è un’emergenza, voglio comunque inviare
          </label>
        </div>
      )}

      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="sr-only" htmlFor="body">Scrivi un messaggio</label>
          <textarea id="body" name="body" rows={3} required placeholder="Scrivi qui il tuo messaggio…" className="input" />
        </div>
        <SendButton label={hasRedFlags ? 'Invia comunque' : 'Invia'} />
      </div>

      {documents.length > 0 && (
        <details>
          <summary className="text-sm text-brand-700 cursor-pointer select-none"><Icon name="paperclip" className="w-4 h-4 inline align-[-2px] mr-1" />Allega un documento</summary>
          <select name="attachmentId" multiple size={Math.min(documents.length, 4)} className="input mt-2" aria-label="Documenti da allegare">
            {documents.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </details>
      )}
    </form>
  );
}
