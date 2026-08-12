'use client';

import { useState, useTransition } from 'react';
import { useFormState } from 'react-dom';
import { updateProfileAction, type ActionState } from '@/app/actions/diary';
import { revokeAiConsentAction, type ActionState as LocalActionState } from '../actions';
import { Alert, Field } from '@/components/ui';

export function ProfileForm({ profile }: {
  profile: {
    addressStreet: string; addressCity: string; addressProvince: string; addressZip: string;
    gpName: string; asl: string; insurance: string;
    emergencyName: string; emergencyPhone: string;
    onboardingStep: number;
  };
}) {
  const [state, action] = useFormState<ActionState, FormData>(updateProfileAction, null);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      <input type="hidden" name="onboardingStep" value={profile.onboardingStep} />
      <Field label="Via e numero civico" name="addressStreet" defaultValue={profile.addressStreet} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Città" name="addressCity" defaultValue={profile.addressCity} />
        <Field label="Provincia" name="addressProvince" defaultValue={profile.addressProvince} />
        <Field label="CAP" name="addressZip" defaultValue={profile.addressZip} inputMode="numeric" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Medico di base" name="gpName" defaultValue={profile.gpName} />
        <Field label="ASL" name="asl" defaultValue={profile.asl} />
        <Field label="Assicurazione" name="insurance" defaultValue={profile.insurance} />
      </div>
      <fieldset className="border border-slate-200 rounded-lg p-4">
        <legend className="text-sm font-medium text-slate-700 px-1">Contatto di emergenza</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome e cognome" name="emergencyName" defaultValue={profile.emergencyName} />
          <Field label="Telefono" name="emergencyPhone" type="tel" defaultValue={profile.emergencyPhone} />
        </div>
        <p className="text-xs text-slate-500 mt-2">Questi dati sono conservati in forma cifrata.</p>
      </fieldset>
      <button type="submit" className="btn-primary">Salva le modifiche</button>
    </form>
  );
}

export function RevokeConsentButton({ consentRecordId }: { consentRecordId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<LocalActionState>(null);
  if (state?.success) return <p className="text-xs text-emerald-700">{state.success}</p>;
  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            window.confirm(
              'Vuoi revocare il consenso all’uso dell’intelligenza artificiale?\n\nL’assistente e le spiegazioni automatiche non saranno più disponibili finché non darai di nuovo il consenso.'
            )
          ) {
            start(async () => setState(await revokeAiConsentAction(consentRecordId)));
          }
        }}
        className="btn-danger !py-1.5 text-xs"
      >
        {pending ? 'Revoco…' : 'Revoca il consenso'}
      </button>
      {state?.error && <p className="text-xs text-red-700 mt-1">{state.error}</p>}
    </div>
  );
}
