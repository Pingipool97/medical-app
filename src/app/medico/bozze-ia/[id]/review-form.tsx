'use client';

import { useFormState } from 'react-dom';
import { reviewAiOutputAction, type ActionState } from '@/app/actions/ai';
import { Alert } from '@/components/ui';
import { Icon } from '@/components/icons';

export function ReviewForm({
  outputId, defaultContent, audience,
}: {
  outputId: string;
  defaultContent: string;
  audience: string;
}) {
  const [state, action] = useFormState<ActionState, FormData>(reviewAiOutputAction, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}

      <input type="hidden" name="outputId" value={outputId} />

      <div>
        <label className="label" htmlFor="content">Contenuto della bozza (modificabile prima dell’approvazione)</label>
        <textarea id="content" name="content" rows={14} className="input font-mono text-sm" defaultValue={defaultContent} />
        <p className="text-xs text-slate-500 mt-1">Ciò che approvi diventa la versione finale, con la tua responsabilità clinica.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button type="submit" name="decision" value="APPROVA" className="btn-primary inline-flex items-center gap-1.5">
          <Icon name="check" className="w-4 h-4" /> Approva
        </button>
        {audience === 'PATIENT' && (
          <button
            type="submit"
            name="decision"
            value="APPROVA_E_PUBBLICA"
            className="btn-primary !bg-emerald-700 hover:!bg-emerald-800 inline-flex items-center gap-1.5"
            title="Il contenuto verrà pubblicato nell'area del paziente"
          >
            <Icon name="inbox" className="w-4 h-4" /> Approva e pubblica al paziente
          </button>
        )}
        <button type="submit" name="decision" value="SCARTA" className="btn-danger inline-flex items-center gap-1.5">
          <Icon name="trash" className="w-4 h-4" /> Scarta
        </button>
      </div>
      {audience === 'PATIENT' ? (
        <p className="text-xs text-slate-500">
          «Approva e pubblica» rende il contenuto visibile al paziente nella sua area personale, come spiegazione
          validata da te. «Approva» lo tiene per uso interno.
        </p>
      ) : (
        <p className="text-xs text-slate-500">Questa bozza è destinata solo a te: non può essere pubblicata al paziente.</p>
      )}
    </form>
  );
}
