'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { uploadDocumentAction, type ActionState } from '@/app/actions/documents';
import { Alert, Field, TextArea } from '@/components/ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full text-base py-3">
      {pending ? 'Caricamento in corso… non chiudere la pagina' : 'Carica il documento'}
    </button>
  );
}

export function UploadForm({ docTypes, specializations }: {
  docTypes: { code: string; name: string }[];
  specializations: { code: string; name: string }[];
}) {
  const [state, action] = useFormState<ActionState, FormData>(uploadDocumentAction, null);

  if (state?.success && state.documentId) {
    return (
      <div className="space-y-4">
        <Alert kind="success">{state.success}</Alert>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href={`/paziente/documenti/${state.documentId}`} className="btn-primary flex-1 text-center">
            Vai al documento caricato
          </Link>
          <Link href="/paziente/documenti/carica" className="btn-secondary flex-1 text-center">
            Carica un altro documento
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      {state?.error && <Alert kind="error">{state.error}</Alert>}

      {/* Passo 1: il file */}
      <fieldset className="border border-slate-200 rounded-lg p-4">
        <legend className="text-sm font-semibold text-slate-800 px-1">1. Scegli il file</legend>
        <label className="label" htmlFor="file">Referto in PDF oppure una foto ben leggibile</label>
        <input
          id="file"
          name="file"
          type="file"
          required
          accept="application/pdf,image/*"
          capture="environment"
          className="block w-full text-sm text-slate-700 file:mr-3 file:border-0 file:rounded-lg file:px-4 file:py-2.5 file:bg-brand-700 file:text-white file:font-semibold file:cursor-pointer"
        />
        <p className="text-xs text-slate-500 mt-2">
          Dal telefono puoi anche scattare una foto direttamente. Dimensione massima: 25 MB.
        </p>
      </fieldset>

      {/* Passo 2: che documento è */}
      <fieldset className="border border-slate-200 rounded-lg p-4 space-y-4">
        <legend className="text-sm font-semibold text-slate-800 px-1">2. Che documento è</legend>
        <Field label="Titolo" name="title" placeholder="es. Analisi del sangue di marzo" hint="Se lo lasci vuoto useremo il nome del file." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="docTypeCode">Tipo di documento <span className="text-red-600" aria-hidden>*</span></label>
            <select id="docTypeCode" name="docTypeCode" required className="input" defaultValue="">
              <option value="" disabled>Seleziona…</option>
              {docTypes.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="specializationCode">Specializzazione (se la conosci)</label>
            <select id="specializationCode" name="specializationCode" className="input" defaultValue="">
              <option value="">Non lo so / non serve</option>
              {specializations.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      {/* Passo 3: dettagli */}
      <fieldset className="border border-slate-200 rounded-lg p-4 space-y-4">
        <legend className="text-sm font-semibold text-slate-800 px-1">3. Qualche dettaglio (facoltativo)</legend>
        <Field label="Data del documento" name="docDate" type="date" hint="Se non la sai non preoccuparti: la cercheremo noi nel documento e ti chiederemo conferma." />
        <Field label="Struttura o medico che lo ha emesso" name="issuer" placeholder="es. Laboratorio Analisi Rossi" />
        <TextArea label="Note" name="notes" rows={3} placeholder="es. esami fatti dopo il ricovero" />
      </fieldset>

      <SubmitButton />
    </form>
  );
}
