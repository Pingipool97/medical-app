'use client';

import { useFormState } from 'react-dom';
import { sendMessageAction, type ActionState } from '@/app/actions/communication';
import { Alert } from '@/components/ui';

export function MessageForm({ conversationId }: { conversationId: string }) {
  const [state, action] = useFormState<ActionState, FormData>(sendMessageAction, null);

  return (
    <form action={action} className="space-y-2">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label" htmlFor="body">Scrivi al paziente</label>
          <textarea id="body" name="body" rows={2} required className="input" placeholder="Il tuo messaggio…" />
        </div>
        <button type="submit" className="btn-primary">Invia</button>
      </div>
    </form>
  );
}
