'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { saveAiFunctionAction, saveSpendingCapsAction, type ActionState } from '../actions';
import { Alert, Badge } from '@/components/ui';

export type AiFunctionView = {
  functionKey: string;
  label: string;
  isCds: boolean;
  enabled: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
};

export function AiFunctionRow({ cfg, knownModels }: { cfg: AiFunctionView; knownModels: string[] }) {
  const [state, action] = useFormState<ActionState, FormData>(saveAiFunctionAction, null);
  const [custom, setCustom] = useState(!knownModels.includes(cfg.model));

  return (
    <form action={action} className="border border-slate-200 rounded-lg p-3 sm:p-4 bg-white">
      <input type="hidden" name="functionKey" value={cfg.functionKey} />
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="font-medium text-slate-800">{cfg.label}</span>
        <code className="text-xs text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{cfg.functionKey}</code>
        {cfg.isCds && <Badge color="violet">CDS</Badge>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
        <label className="flex items-center gap-2 text-sm lg:pb-2.5">
          <input type="checkbox" name="enabled" defaultChecked={cfg.enabled} />
          <span>Abilitata</span>
        </label>
        <div className="lg:col-span-2">
          <label className="label" htmlFor={`model-${cfg.functionKey}`}>Modello</label>
          <select
            id={`model-${cfg.functionKey}`}
            name="model"
            className="input"
            defaultValue={custom ? '__custom' : cfg.model}
            onChange={(e) => setCustom(e.target.value === '__custom')}
          >
            {knownModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
            <option value="__custom">Altro modello…</option>
          </select>
          {custom && (
            <input
              name="modelCustom"
              className="input mt-2"
              defaultValue={knownModels.includes(cfg.model) ? '' : cfg.model}
              placeholder="ID modello (es. claude-...)"
              aria-label="ID modello personalizzato"
            />
          )}
        </div>
        <div>
          <label className="label" htmlFor={`temp-${cfg.functionKey}`}>Temperatura</label>
          <input id={`temp-${cfg.functionKey}`} name="temperature" type="number" step="0.05" min={0} max={1} defaultValue={cfg.temperature} className="input" />
        </div>
        <div>
          <label className="label" htmlFor={`maxtok-${cfg.functionKey}`}>Max token</label>
          <input id={`maxtok-${cfg.functionKey}`} name="maxTokens" type="number" step="1" min={100} max={64000} defaultValue={cfg.maxTokens} className="input" />
        </div>
      </div>
      {cfg.isCds && (
        <p className="text-xs text-slate-500 mt-2">
          Funzione nel perimetro di supporto decisionale clinico: per abilitarla deve essere attivo il feature flag CDS corrispondente.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-secondary text-sm">Salva riga</button>
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
        {state?.success && <span className="text-sm text-emerald-700">{state.success}</span>}
      </div>
    </form>
  );
}

export function SpendingCapsForm({ dailyEuro, monthlyEuro }: { dailyEuro: string; monthlyEuro: string }) {
  const [state, action] = useFormState<ActionState, FormData>(saveSpendingCapsAction, null);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="dailyEuro">Tetto giornaliero (€)</label>
          <input id="dailyEuro" name="dailyEuro" type="number" step="0.01" min="0.01" required defaultValue={dailyEuro} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="monthlyEuro">Tetto mensile (€)</label>
          <input id="monthlyEuro" name="monthlyEuro" type="number" step="0.01" min="0.01" required defaultValue={monthlyEuro} className="input" />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Al raggiungimento del tetto le chiamate IA vengono bloccate automaticamente e l&rsquo;evento è registrato nell&rsquo;audit log.
      </p>
      <button type="submit" className="btn-primary">Salva tetti di spesa</button>
    </form>
  );
}
