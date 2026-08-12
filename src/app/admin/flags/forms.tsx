'use client';

import { useFormState } from 'react-dom';
import { toggleFlagAction, type ActionState } from '../actions';
import { Badge } from '@/components/ui';

export type FlagView = {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  isCdsGate: boolean;
};

export function FlagRow({ flag }: { flag: FlagView }) {
  const [state, action] = useFormState<ActionState, FormData>(toggleFlagAction, null);
  const willEnable = !flag.enabled;

  return (
    <form action={action} className={`border rounded-lg p-4 bg-white ${flag.isCdsGate ? 'border-violet-300' : 'border-slate-200'}`}>
      <input type="hidden" name="key" value={flag.key} />
      <input type="hidden" name="enable" value={willEnable ? 'true' : 'false'} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[240px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">{flag.label}</span>
            <code className="text-xs text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{flag.key}</code>
            {flag.isCdsGate && <Badge color="violet">Gate regolatorio CDS</Badge>}
            {flag.enabled ? <Badge color="green">Attivo</Badge> : <Badge color="gray">Disattivato</Badge>}
          </div>
          {flag.description && <p className="text-sm text-slate-600 mt-1">{flag.description}</p>}
        </div>
        <button type="submit" className={`text-sm ${flag.enabled ? 'btn-danger' : 'btn-primary'}`}>
          {flag.enabled ? 'Disattiva' : 'Attiva'}
        </button>
      </div>

      {flag.isCdsGate && willEnable && (
        <label className="flex gap-2 items-start text-sm mt-3 p-3 rounded-lg border border-violet-200 bg-violet-50">
          <input type="checkbox" name="cdsAck" className="mt-1" required />
          <span>
            Dichiaro di essere consapevole che l&rsquo;attivazione configura la piattaforma come software con funzione di
            supporto decisionale clinico (potenziale dispositivo medico ai sensi del MDR 2017/745) e che questa scelta è
            documentata nell&rsquo;audit log. <span className="text-red-600">*</span>
          </span>
        </label>
      )}

      {state?.error && <p className="text-sm text-red-700 mt-2">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700 mt-2">{state.success}</p>}
    </form>
  );
}
