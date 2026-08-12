'use client';

import { useFormState } from 'react-dom';
import { saveProviderAction, testProviderAction, type ActionState } from '../actions';
import { Alert, Field, SelectField } from '@/components/ui';

export type ProviderView = {
  id: string;
  kind: string;
  name: string;
  baseUrl: string;
  maskedKey: string; // già mascherata lato server, la chiave in chiaro non arriva mai qui
  enabled: boolean;
};

export function ProviderForm({ provider, kinds }: { provider?: ProviderView; kinds: { value: string; label: string }[] }) {
  const [state, action] = useFormState<ActionState, FormData>(saveProviderAction, null);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      {provider && <input type="hidden" name="id" value={provider.id} />}
      <div className="grid sm:grid-cols-2 gap-4">
        <SelectField label="Tipo" name="kind" required options={kinds} defaultValue={provider?.kind} />
        <Field label="Nome" name="name" required defaultValue={provider?.name} placeholder="es. Anthropic" />
      </div>
      <Field
        label="Base URL (facoltativa)"
        name="baseUrl"
        type="url"
        defaultValue={provider?.baseUrl}
        placeholder="https://api.esempio.com"
        hint="Se vuota viene usato l'endpoint di default del provider."
      />
      <Field
        label="Chiave API"
        name="apiKey"
        type="password"
        autoComplete="off"
        placeholder={provider ? '•••• (lascia vuoto per non cambiare)' : 'Chiave API del provider'}
        hint={provider?.maskedKey ? `Chiave attuale (mascherata): ${provider.maskedKey}` : 'La chiave viene cifrata a riposo (AES-256-GCM).'}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={provider?.enabled ?? false} />
        <span>Provider attivo</span>
      </label>
      <button type="submit" className="btn-primary">{provider ? 'Salva modifiche' : 'Aggiungi provider'}</button>
    </form>
  );
}

export function TestProviderButton({ providerId }: { providerId: string }) {
  const [state, action] = useFormState<ActionState, FormData>(testProviderAction, null);
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={providerId} />
      <button type="submit" className="btn-secondary text-xs px-3 py-1.5">Testa connessione</button>
      {state?.error && <span className="text-xs text-red-700 max-w-xs">{state.error}</span>}
      {state?.success && <span className="text-xs text-emerald-700 max-w-xs">{state.success}</span>}
    </form>
  );
}
