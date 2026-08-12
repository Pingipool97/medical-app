'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { saveTemplateVersionAction, sendTestTemplateAction, type ActionState } from '../actions';
import { renderTemplate, SAMPLE_VARS } from './render';
import { Alert } from '@/components/ui';

export function TemplateEditor({
  templateKey,
  channel,
  initialSubject,
  initialBody,
  sourceVersion,
}: {
  templateKey: string;
  channel: string;
  initialSubject: string;
  initialBody: string;
  sourceVersion?: number;
}) {
  const [state, action] = useFormState<ActionState, FormData>(saveTemplateVersionAction, null);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={action} className="space-y-3">
        {state?.error && <Alert kind="error">{state.error}</Alert>}
        {state?.success && <Alert kind="success">{state.success}</Alert>}
        <input type="hidden" name="key" value={templateKey} />
        <input type="hidden" name="channel" value={channel} />
        <div>
          <label className="label" htmlFor="subject">Oggetto (facoltativo, usato per le email)</label>
          <input id="subject" name="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="body">
            Contenuto{sourceVersion ? ` (partendo dalla versione ${sourceVersion})` : ''}
          </label>
          <textarea
            id="body"
            name="body"
            rows={12}
            className="input font-mono text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            Variabili disponibili: {Object.keys(SAMPLE_VARS).map((k) => `{{${k}}}`).join(', ')}
          </p>
        </div>
        <button type="submit" className="btn-primary">Salva come nuova versione (e attiva)</button>
      </form>

      <div>
        <p className="label">Anteprima con dati di esempio</p>
        <div className="border border-slate-200 rounded-lg bg-slate-50 p-4 text-sm space-y-2">
          {subject && <p className="font-semibold border-b border-slate-200 pb-2">{renderTemplate(subject)}</p>}
          <div className="whitespace-pre-wrap">{renderTemplate(body) || <span className="text-slate-400">L&rsquo;anteprima comparirà qui…</span>}</div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Esempi usati: {'{{nome}}'} → «{SAMPLE_VARS.nome}», {'{{link}}'} → «{SAMPLE_VARS.link}».
        </p>
      </div>
    </div>
  );
}

export function SendTestButton({ templateId }: { templateId: string }) {
  const [state, action] = useFormState<ActionState, FormData>(sendTestTemplateAction, null);
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={templateId} />
      <button type="submit" className="btn-secondary text-xs px-3 py-1.5">Invia test</button>
      {state?.error && <span className="text-xs text-red-700 max-w-sm">{state.error}</span>}
      {state?.success && <span className="text-xs text-emerald-700 max-w-sm">{state.success}</span>}
    </form>
  );
}
