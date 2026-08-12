'use client';

import { useFormState } from 'react-dom';
import { saveAnagraficaAction, toggleAnagraficaAction, type ActionState } from '../../actions';
import { Alert } from '@/components/ui';

export type FieldSpec = {
  name: string;
  label: string;
  type?: 'text' | 'number';
  required?: boolean;
  hint?: string;
  placeholder?: string;
  step?: string;
  readOnlyOnEdit?: boolean;
  options?: { value: string; label: string }[];
};

export function AnagraficaForm({
  tipo,
  id,
  fields,
  defaults,
  submitLabel,
}: {
  tipo: string;
  id?: string;
  fields: FieldSpec[];
  defaults?: Record<string, string>;
  submitLabel: string;
}) {
  const [state, action] = useFormState<ActionState, FormData>(saveAnagraficaAction, null);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      <input type="hidden" name="tipo" value={tipo} />
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const fieldId = `${tipo}-${id ?? 'new'}-${f.name}`;
          const defaultValue = defaults?.[f.name] ?? '';
          const readOnly = Boolean(id && f.readOnlyOnEdit);
          return (
            <div key={f.name}>
              <label className="label" htmlFor={fieldId}>
                {f.label}
                {f.required && <span className="text-red-600" aria-hidden> *</span>}
              </label>
              {f.options ? (
                <select id={fieldId} name={f.name} required={f.required} defaultValue={defaultValue} className="input">
                  <option value="" disabled>Seleziona…</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={fieldId}
                  name={f.name}
                  type={f.type ?? 'text'}
                  step={f.step}
                  required={f.required}
                  defaultValue={defaultValue}
                  placeholder={f.placeholder}
                  readOnly={readOnly}
                  className={`input ${readOnly ? 'bg-slate-100 text-slate-500' : ''}`}
                />
              )}
              {f.hint && <p className="text-xs text-slate-500 mt-1">{f.hint}</p>}
            </div>
          );
        })}
      </div>
      <button type="submit" className="btn-primary text-sm">{submitLabel}</button>
    </form>
  );
}

export function ToggleActiveButton({ tipo, id, active }: { tipo: string; id: string; active: boolean }) {
  const [state, action] = useFormState<ActionState, FormData>(toggleAnagraficaAction, null);
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <button type="submit" className={`text-xs px-3 py-1.5 ${active ? 'btn-danger' : 'btn-secondary'}`}>
        {active ? 'Disattiva' : 'Riattiva'}
      </button>
      {state?.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}
