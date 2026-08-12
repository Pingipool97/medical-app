'use client';

import { useFormState } from 'react-dom';
import { publishConsentVersionAction, type ActionState } from '../actions';
import { Alert, Field, SelectField, TextArea } from '@/components/ui';

export function PublishConsentForm({ kinds }: { kinds: { value: string; label: string }[] }) {
  const [state, action] = useFormState<ActionState, FormData>(publishConsentVersionAction, null);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      <SelectField label="Tipo di informativa" name="kind" required options={kinds} />
      <Field label="Titolo" name="title" required placeholder="es. Informativa privacy — v2" />
      <TextArea
        label="Testo dell'informativa"
        name="text"
        required
        rows={12}
        placeholder="Testo completo dell'informativa…"
        hint="La pubblicazione crea una nuova versione (numero progressivo) e disattiva la precedente dello stesso tipo. Gli utenti dovranno riaccettare dove previsto."
      />
      <button type="submit" className="btn-primary">Pubblica nuova versione</button>
    </form>
  );
}
