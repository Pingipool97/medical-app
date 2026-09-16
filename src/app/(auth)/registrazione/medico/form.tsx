'use client';
import { useState } from 'react';
import { useFormState } from 'react-dom';
import Link from 'next/link';
import { registerDoctorAction, type ActionState } from '../../actions';
import { Alert, CheckboxGroupField, Field } from '@/components/ui';
import { Logo } from '@/components/logo';

export type SpecOption = { value: string; label: string; requiresOrdine: boolean };

export default function DoctorForm({ specializations }: { specializations: SpecOption[] }) {
  const [state, action] = useFormState<ActionState, FormData>(registerDoctorAction, null);
  const [specCodes, setSpecCodes] = useState<string[]>([]);

  const toggle = (code: string) =>
    setSpecCodes((prima) => (prima.includes(code) ? prima.filter((c) => c !== code) : [...prima, code]));

  // I campi Ordine compaiono solo quando servono davvero. Con piu' professioni scelte
  // basta che UNA sia iscritta a un albo: il numero si chiede una volta sola, perche'
  // il profilo ne conserva uno solo.
  const selected = specializations.filter((s) => specCodes.includes(s.value));
  const conOrdine = selected.filter((s) => s.requiresOrdine);
  const senzaOrdine = selected.filter((s) => !s.requiresOrdine);
  const needsOrdine = conOrdine.length > 0;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="w-full max-w-lg mx-auto">
        <Link href="/" className="flex justify-center mb-6" aria-label="HABITUS — home">
          <Logo variant="full" className="h-12 w-auto" priority />
        </Link>
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-bold">Registrazione professionista</h1>
          <Alert kind="info">
            {needsOrdine
              ? 'L’account sarà attivo in sola consultazione finché non verifichiamo la tua iscrizione all’Ordine: fino ad allora non potrai emettere documenti né ricevere pazienti.'
              : 'L’account sarà attivo in sola consultazione finché non verifichiamo la tua qualifica professionale: fino ad allora non potrai emettere documenti né ricevere pazienti.'}
          </Alert>
          <form action={action} className="mt-5 space-y-4">
            {state?.error && <Alert kind="error">{state.error}</Alert>}

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nome" name="firstName" required />
              <Field label="Cognome" name="lastName" required />
            </div>

            <CheckboxGroupField
              label="Professioni / specializzazioni"
              name="specializations"
              required
              options={specializations.map((s) => ({
                value: s.value,
                label: s.label,
                note: s.requiresOrdine ? 'Iscritta a un Ordine professionale' : 'Nessun Ordine professionale',
              }))}
              selected={specCodes}
              onToggle={toggle}
              hint="Puoi sceglierne piu' di una. Restano modificabili dal tuo profilo."
            />

            {needsOrdine && (
              <div className="grid sm:grid-cols-2 gap-4 rounded-lg bg-brand-50/60 border border-brand-100 p-4">
                <Field label="N. iscrizione Ordine" name="ordineNumber" required />
                <Field
                  label="Provincia Ordine"
                  name="ordineProvince"
                  required
                  maxLength={2}
                  placeholder="MI"
                  style={{ textTransform: 'uppercase' }}
                />
                <p className="sm:col-span-2 text-xs text-slate-600 -mt-1">
                  Richiesto per <strong>{conOrdine.map((s) => s.label).join(', ')}</strong>
                  {conOrdine.length > 1 ? ', professioni iscritte a un Ordine professionale.' : ', professione iscritta a un Ordine professionale.'}
                </p>
              </div>
            )}

            {senzaOrdine.length > 0 && (
              <p className="text-xs text-slate-600 rounded-lg bg-accent-50 border border-accent-100 px-3 py-2">
                Per <strong>{senzaOrdine.map((s) => s.label).join(', ')}</strong> non è prevista l’iscrizione a un Ordine:
                {needsOrdine ? ' per queste non serve alcun numero di albo.' : ' nessun numero di albo da inserire.'}
              </p>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Partita IVA (facoltativa)" name="vatNumber" />
              <Field label="Studio / struttura (facoltativo)" name="structureName" />
            </div>
            <Field label="Email professionale" name="email" type="email" required />
            <Field
              label="Password"
              name="password"
              type="password"
              required
              minLength={10}
              hint="Almeno 10 caratteri, una maiuscola e un numero."
            />
            <label className="flex gap-2 text-sm items-start">
              <input type="checkbox" name="consenso_privacy" className="mt-1" required />
              <span>Ho letto l’informativa privacy e accetto i termini di servizio. <span className="text-red-600">*</span></span>
            </label>
            <button type="submit" className="btn-primary w-full">Crea l’account professionale</button>
          </form>
          <p className="text-center mt-4 text-sm text-slate-600">
            Hai già un account? <Link href="/login" className="text-brand-700 font-medium hover:underline">Accedi</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
