'use client';

import { useFormState } from 'react-dom';
import { saveNotificationRuleAction, type ActionState } from '../actions';

export function RuleRow({
  eventKey,
  label,
  channels,
  enabled,
}: {
  eventKey: string;
  label: string;
  channels: string[]; // canali attivi oltre a INAPP
  enabled: boolean;
}) {
  const [state, action] = useFormState<ActionState, FormData>(saveNotificationRuleAction, null);
  return (
    <form action={action} className="border border-slate-200 rounded-lg p-3 bg-white">
      <input type="hidden" name="eventKey" value={eventKey} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="min-w-[220px] flex-1">
          <p className="text-sm font-medium text-slate-800">{label}</p>
          <code className="text-xs text-slate-500">{eventKey}</code>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-500" title="Il canale in-app è sempre attivo">
          <input type="checkbox" checked disabled />
          <span>In-app</span>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="ch_EMAIL" defaultChecked={channels.includes('EMAIL')} />
          <span>Email</span>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="ch_SMS" defaultChecked={channels.includes('SMS')} />
          <span>SMS</span>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="ch_PUSH" defaultChecked={channels.includes('PUSH')} />
          <span>Push</span>
        </label>
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <input type="checkbox" name="enabled" defaultChecked={enabled} />
          <span>Evento attivo</span>
        </label>
        <button type="submit" className="btn-secondary text-xs px-3 py-1.5">Salva</button>
      </div>
      {state?.error && <p className="text-xs text-red-700 mt-2">{state.error}</p>}
      {state?.success && <p className="text-xs text-emerald-700 mt-2">{state.success}</p>}
    </form>
  );
}
