'use client';

import { useFormState } from 'react-dom';
import { saveNotificationPrefsAction, type ActionState } from '@/app/actions/notifications';
import { Alert } from './ui';
import { DEFAULT_REMINDER_HOURS, REMINDER_HOURS_OPTIONS } from '@/lib/constants';

export type PrefRow = {
  eventKey: string;
  label: string;
  /** Canali che la policy della piattaforma ammette per questo evento. */
  allowed: string[];
  email: boolean;
  sms: boolean;
  push: boolean;
  reminderHours: number | null;
};

// Pannello preferenze notifica, condiviso da paziente e professionista.
// Un canale non ammesso dalla regola globale è mostrato disabilitato con la
// spiegazione: meglio di una casella che si spunta e non fa nulla.

export function NotificationPrefs({ rows }: { rows: PrefRow[] }) {
  const [state, action] = useFormState<ActionState, FormData>(saveNotificationPrefsAction, null);
  const reminder = rows.find((r) => r.eventKey === 'appuntamento_promemoria');

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3 font-medium">Evento</th>
              <th className="py-2 px-2 font-medium text-center">In app</th>
              <th className="py-2 px-2 font-medium text-center">Email</th>
              <th className="py-2 px-2 font-medium text-center">SMS</th>
              <th className="py-2 px-2 font-medium text-center">Push</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.eventKey} className="border-b border-slate-100">
                <td className="py-2 pr-3">
                  {r.label}
                  <input type="hidden" name="eventKey" value={r.eventKey} />
                </td>
                <td className="py-2 px-2 text-center">
                  {/* Sempre attiva: è il registro dell'account, non un canale opzionale */}
                  <input type="checkbox" checked disabled aria-label={`${r.label}: in app, sempre attiva`} />
                </td>
                {(['email', 'sms', 'push'] as const).map((ch) => {
                  const allowed = r.allowed.includes(ch.toUpperCase());
                  return (
                    <td key={ch} className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        name={`${ch}:${r.eventKey}`}
                        defaultChecked={allowed && r[ch]}
                        disabled={!allowed}
                        title={allowed ? undefined : 'Canale non previsto per questo evento dalla piattaforma'}
                        aria-label={`${r.label}: ${ch}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reminder && (
        <div className="max-w-xs">
          <label className="label" htmlFor="reminderHours">Promemoria appuntamento: quanto prima</label>
          <select
            id="reminderHours"
            name="reminderHours"
            defaultValue={String(reminder.reminderHours ?? DEFAULT_REMINDER_HOURS)}
            className="input"
          >
            {REMINDER_HOURS_OPTIONS.map((h) => (
              <option key={h} value={h}>{h === 1 ? '1 ora prima' : `${h} ore prima`}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary">Salva preferenze</button>
        <p className="text-xs text-slate-500">
          Le notifiche via email e SMS non contengono mai contenuti clinici: solo un avviso e il link all’area riservata.
        </p>
      </div>
    </form>
  );
}
