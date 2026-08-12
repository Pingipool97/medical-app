'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import Link from 'next/link';
import { patientAssistantAction } from '@/app/actions/ai';

type ChatEntry = {
  role: 'user' | 'assistant';
  text: string;
  blocked?: boolean;
  disclaimer?: string;
};

export function AssistantChat() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [question, setQuestion] = useState('');
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, pending]);

  const send = () => {
    const q = question.trim();
    if (!q || pending) return;
    setEntries((prev) => [...prev, { role: 'user', text: q }]);
    setQuestion('');
    start(async () => {
      const res = await patientAssistantAction(q);
      if ('error' in res && res.error) {
        setEntries((prev) => [...prev, { role: 'assistant', text: String(res.error), blocked: false }]);
      } else if ('answer' in res) {
        setEntries((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: res.answer ?? 'Non è arrivata una risposta: riprova tra poco.',
            blocked: res.blocked ?? false,
            disclaimer: res.disclaimer ?? undefined,
          },
        ]);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="min-h-[200px] max-h-[50vh] overflow-y-auto space-y-3 pr-1" aria-live="polite">
        {entries.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">
            Fai una domanda, ad esempio: “Cosa vuol dire emoglobina glicata?”
          </p>
        )}
        {entries.map((e, i) => (
          <div key={i} className={`flex ${e.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${e.role === 'user' ? 'bg-brand-700 text-white rounded-br-sm' : e.blocked ? 'alert-critical' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
              <p className="whitespace-pre-wrap">{e.text}</p>
              {e.blocked && (
                <p className="text-sm mt-2">
                  <Link href="/paziente/richieste/nuova" className="underline font-semibold">
                    Scrivi al tuo medico da qui →
                  </Link>
                </p>
              )}
              {e.disclaimer && !e.blocked && (
                <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-1.5 mt-2">⚕️ {e.disclaimer}</p>
              )}
            </div>
          </div>
        ))}
        {pending && <p className="text-sm text-slate-500">L’assistente sta scrivendo…</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex gap-2 items-end"
      >
        <div className="flex-1">
          <label className="sr-only" htmlFor="domanda">La tua domanda</label>
          <textarea
            id="domanda"
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Scrivi qui la tua domanda…"
            className="input"
          />
        </div>
        <button type="submit" disabled={pending || !question.trim()} className="btn-primary shrink-0">
          {pending ? 'Attendi…' : 'Chiedi'}
        </button>
      </form>
    </div>
  );
}
