'use client';
import { useFormState } from 'react-dom';
import { registerDoctorAction, type ActionState } from '../../actions';
import { Alert, Field, SelectField } from '@/components/ui';

export default function DoctorForm({ specializations }: { specializations: { value: string; label: string }[] }) {
  const [state, action] = useFormState<ActionState, FormData>(registerDoctorAction, null);
  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="card w-full max-w-lg mx-auto p-6 sm:p-8">
        <h1 className="text-xl font-bold">Registrazione medico</h1>
        <Alert kind="info">
          L’account sarà attivo in sola consultazione finché non verifichiamo la tua iscrizione all’Ordine:
          fino ad allora non potrai emettere documenti né ricevere pazienti.
        </Alert>
        <form action={action} className="mt-5 space-y-4">
          {state?.error && <Alert kind="error">{state.error}</Alert>}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome" name="firstName" required />
            <Field label="Cognome" name="lastName" required />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="N. iscrizione Ordine" name="ordineNumber" required />
            <Field label="Provincia Ordine" name="ordineProvince" required maxLength={2} placeholder="MI" style={{ textTransform: 'uppercase' }} />
          </div>
          <SelectField label="Specializzazione principale" name="specialization" required options={specializations} hint="Potrai aggiungerne altre dal profilo." />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Partita IVA (facoltativa)" name="vatNumber" />
            <Field label="Studio / struttura (facoltativo)" name="structureName" />
          </div>
          <Field label="Email professionale" name="email" type="email" required />
          <Field label="Password" name="password" type="password" required minLength={10} hint="Almeno 10 caratteri, una maiuscola e un numero. Ti verrà chiesta anche l’autenticazione a due fattori, obbligatoria per i medici." />
          <label className="flex gap-2 text-sm items-start">
            <input type="checkbox" name="consenso_privacy" className="mt-1" required />
            <span>Ho letto l’informativa privacy e accetto i termini di servizio. <span className="text-red-600">*</span></span>
          </label>
          <button type="submit" className="btn-primary w-full">Registrati come medico</button>
        </form>
      </div>
    </div>
  );
}
