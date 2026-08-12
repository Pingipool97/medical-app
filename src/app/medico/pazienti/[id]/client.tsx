'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  generateDocSummaryAction, generateSynthesisAction, generateSuggestionsAction,
  drugSafetyCheckAction, type ActionState,
} from '@/app/actions/ai';
import { openConversationAction } from '@/app/actions/communication';
import { Alert, AiDisclaimer } from '@/components/ui';
import { Icon } from '@/components/icons';

function AiFeedback({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <Alert kind="warn">{state.error}</Alert>;
  if (state.success) {
    return (
      <Alert kind="success">
        {state.success}{' '}
        {state.outputId && (
          <Link href={`/medico/bozze-ia/${state.outputId}`} className="underline font-semibold">Vai alla revisione →</Link>
        )}
      </Alert>
    );
  }
  return null;
}

// Riassunti IA per singolo documento (versione tecnica e versione per il paziente)
export function DocAiButtons({ documentId }: { documentId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setState(await generateDocSummaryAction(documentId, 'DOCTOR')))}
          className="btn-secondary !py-1.5 text-xs inline-flex items-center gap-1.5"
        >
          {pending ? 'Genero…' : <><Icon name="cpu" className="w-4 h-4" /> Riassunto tecnico (IA)</>}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setState(await generateDocSummaryAction(documentId, 'PATIENT')))}
          className="btn-secondary !py-1.5 text-xs inline-flex items-center gap-1.5"
        >
          {pending ? 'Genero…' : <><Icon name="message" className="w-4 h-4" /> Spiegazione per il paziente (IA)</>}
        </button>
      </div>
      <AiFeedback state={state} />
    </div>
  );
}

// Azioni IA a livello di cartella: sintesi complessiva e suggerimenti clinici (CDS)
export function PatientAiActions({ patientId }: { patientId: string }) {
  const [pendingSynth, startSynth] = useTransition();
  const [pendingSugg, startSugg] = useTransition();
  const [synthState, setSynthState] = useState<ActionState>(null);
  const [suggState, setSuggState] = useState<ActionState>(null);
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled={pendingSynth}
          onClick={() => startSynth(async () => setSynthState(await generateSynthesisAction(patientId)))}
          className="btn-primary inline-flex items-center gap-1.5"
        >
          {pendingSynth ? 'Genero la sintesi…' : <><Icon name="file" className="w-4 h-4" /> Genera sintesi complessiva</>}
        </button>
        <button
          type="button"
          disabled={pendingSugg}
          onClick={() => startSugg(async () => setSuggState(await generateSuggestionsAction(patientId)))}
          className="btn-secondary inline-flex items-center gap-1.5"
        >
          {pendingSugg ? 'Genero…' : <><Icon name="sparkles" className="w-4 h-4" /> Suggerimenti clinici (CDS)</>}
        </button>
      </div>
      <AiFeedback state={synthState} />
      <AiFeedback state={suggState} />
      <p className="text-xs text-slate-500">Ogni generazione produce una bozza da revisionare: nulla è definitivo finché non lo approvi tu.</p>
    </div>
  );
}

// Controllo interazioni farmacologiche: motore deterministico su banca dati (perimetro CDS)
type DrugAlert = { severity: string; kind: string; message: string };
type DrugCheckResult =
  | { configured: false; message: string }
  | { configured: true; alerts: DrugAlert[]; coverage: string };

export function DrugCheckWidget({ patientId }: { patientId: string }) {
  const [pending, start] = useTransition();
  const [drug, setDrug] = useState('');
  const [result, setResult] = useState<DrugCheckResult | null>(null);

  const severityStyle = (sev: string) =>
    sev === 'GRAVE'
      ? 'alert-critical'
      : sev === 'MODERATA'
        ? 'rounded-lg border border-amber-400 bg-amber-50 text-amber-900 px-4 py-3 text-sm'
        : 'rounded-lg border border-slate-300 bg-slate-50 text-slate-700 px-4 py-3 text-sm';

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <label className="label" htmlFor="drug-check">Farmaco che intendi prescrivere</label>
          <input
            id="drug-check"
            className="input"
            value={drug}
            onChange={(e) => setDrug(e.target.value)}
            placeholder="es. ibuprofene"
          />
        </div>
        <button
          type="button"
          disabled={pending || !drug.trim()}
          onClick={() => start(async () => setResult(await drugSafetyCheckAction(patientId, drug)))}
          className="btn-primary"
        >
          {pending ? 'Controllo…' : 'Controlla interazioni'}
        </button>
      </div>

      {result && !result.configured && <Alert kind="warn">{result.message}</Alert>}

      {result && result.configured && (
        <div className="space-y-2">
          {result.alerts.length === 0 ? (
            <Alert kind="success">Nessuna interazione o controindicazione trovata nelle regole configurate.</Alert>
          ) : (
            result.alerts.map((a, i) => (
              <div key={i} className={severityStyle(a.severity)} role="alert">
                <strong>{a.severity}</strong> — {a.kind === 'INTERAZIONE' ? 'Interazione' : a.kind === 'ALLERGIA' ? 'Allergia' : a.kind === 'GRAVIDANZA' ? 'Gravidanza' : 'Allattamento'}: {a.message}
              </div>
            ))
          )}
          <p className="text-xs text-slate-500">{result.coverage}</p>
          <AiDisclaimer audience="DOCTOR" />
        </div>
      )}
    </div>
  );
}

// Apre (o crea) la conversazione col paziente e ci naviga
export function OpenConversationButton({ patientId, doctorId }: { patientId: string; doctorId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await openConversationAction(patientId, doctorId);
            if (res.error) setError(res.error);
            else if (res.conversationId) router.push(`/medico/messaggi/${res.conversationId}`);
          })
        }
        className="btn-secondary inline-flex items-center gap-1.5"
      >
        {pending ? 'Apro…' : <><Icon name="message" className="w-4 h-4" /> Scrivi messaggio</>}
      </button>
      {error && <span className="text-xs text-red-700 ml-2">{error}</span>}
    </span>
  );
}
