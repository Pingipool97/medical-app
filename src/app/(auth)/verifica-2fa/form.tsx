'use client';
import { useFormState } from 'react-dom';
import { verify2faAction, type ActionState } from '../actions';
import { Alert, Field } from '@/components/ui';

export default function TwoFaForm({ enabled, secret, uri }: { enabled: boolean; secret?: string; uri?: string }) {
  const [state, action] = useFormState<ActionState, FormData>(verify2faAction, null);
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-bold">Autenticazione a due fattori</h1>
        {!enabled ? (
          <>
            <p className="text-sm text-slate-600 mt-2">
              Per il tuo ruolo la 2FA è obbligatoria. Aggiungi questo account a un’app di autenticazione
              (Google Authenticator, Aegis, 1Password…):
            </p>
            <ol className="text-sm text-slate-700 mt-3 space-y-2 list-decimal pl-5">
              <li>Apri l’app e scegli “Aggiungi account” → “Inserisci chiave manualmente”.</li>
              <li>Inserisci questa chiave segreta:
                <code className="block bg-slate-100 rounded p-2 mt-1 text-xs break-all select-all">{secret}</code>
              </li>
              <li>Inserisci qui sotto il codice a 6 cifre generato.</li>
            </ol>
            {uri && <p className="text-xs text-slate-500 mt-2 break-all">In alternativa, URI per QR: <span className="select-all">{uri}</span></p>}
          </>
        ) : (
          <p className="text-sm text-slate-600 mt-2">Inserisci il codice a 6 cifre dalla tua app di autenticazione.</p>
        )}
        <form action={action} className="mt-5 space-y-4">
          {state?.error && <Alert kind="error">{state.error}</Alert>}
          {!enabled && <input type="hidden" name="secret" value={secret} />}
          <Field label="Codice a 6 cifre" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={7} />
          <button type="submit" className="btn-primary w-full">Verifica</button>
        </form>
      </div>
    </div>
  );
}
