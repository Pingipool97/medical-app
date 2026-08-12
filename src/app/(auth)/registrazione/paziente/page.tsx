'use client';
import { useFormState } from 'react-dom';
import Link from 'next/link';
import { registerPatientAction, type ActionState } from '../../actions';
import { Alert, Field, SelectField } from '@/components/ui';

// Registrazione essenziale (identità verificabile), il resto del profilo si completa
// nell'onboarding progressivo: niente muro di 60 campi al primo accesso.

export default function RegisterPatient() {
  const [state, action] = useFormState<ActionState, FormData>(registerPatientAction, null);
  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="card w-full max-w-lg mx-auto p-6 sm:p-8">
        <h1 className="text-xl font-bold">Registrazione paziente</h1>
        <p className="text-sm text-slate-600 mt-1">
          Ti chiediamo solo l’essenziale per creare un profilo sanitario sicuro. Il diario sanitario lo completerai con calma, passo dopo passo.
        </p>
        <form action={action} className="mt-6 space-y-4">
          {state?.error && <Alert kind="error">{state.error}</Alert>}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome" name="firstName" required autoComplete="given-name" />
            <Field label="Cognome" name="lastName" required autoComplete="family-name" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Data di nascita" name="birthDate" type="date" required />
            <SelectField label="Sesso biologico" name="biologicalSex" required options={[{ value: 'M', label: 'Maschio' }, { value: 'F', label: 'Femmina' }]} hint="Serve per range di riferimento e sicurezza delle terapie." />
          </div>
          <Field label="Codice fiscale" name="codiceFiscale" required minLength={16} maxLength={16} style={{ textTransform: 'uppercase' }} hint="Verifichiamo che sia valido e coerente con data di nascita e sesso." />
          <Field label="Cellulare" name="phone" type="tel" required autoComplete="tel" hint="Verrà verificato via SMS quando il servizio è attivo." />
          <Field label="Email" name="email" type="email" required autoComplete="email" />
          <Field label="Password" name="password" type="password" required minLength={10} hint="Almeno 10 caratteri, una maiuscola e un numero." autoComplete="new-password" />

          <fieldset className="space-y-2 border-t border-slate-200 pt-4">
            <legend className="sr-only">Consensi</legend>
            <label className="flex gap-2 text-sm items-start">
              <input type="checkbox" name="consenso_privacy" className="mt-1" required />
              <span>Ho letto l’<Link className="text-brand-700 underline" href="/consensi/privacy" target="_blank">informativa privacy</Link> e i termini di servizio. <span className="text-red-600">*</span></span>
            </label>
            <label className="flex gap-2 text-sm items-start">
              <input type="checkbox" name="consenso_salute" className="mt-1" required />
              <span>Acconsento espressamente al trattamento dei miei <Link className="text-brand-700 underline" href="/consensi/salute" target="_blank">dati relativi alla salute</Link> (art. 9 GDPR). <span className="text-red-600">*</span></span>
            </label>
            <label className="flex gap-2 text-sm items-start">
              <input type="checkbox" name="consenso_ia" className="mt-1" />
              <span>Acconsento all’<Link className="text-brand-700 underline" href="/consensi/ia" target="_blank">analisi automatica dei documenti</Link> con sistemi di IA (facoltativo: senza, la piattaforma funziona senza funzioni IA).</span>
            </label>
          </fieldset>

          <button type="submit" className="btn-primary w-full">Crea il profilo</button>
        </form>
      </div>
    </div>
  );
}
