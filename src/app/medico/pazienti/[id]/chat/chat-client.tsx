'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clinicalChatAction } from '@/app/actions/ai';
import { Alert } from '@/components/ui';

export function ChatInput({ patientId }: { patientId: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const send = () => {
    const text = message.trim();
    if (!text) return;
    setError(null);
    start(async () => {
      const res = await clinicalChatAction(patientId, text);
      if (res && 'error' in res && res.error) {
        setError(res.error);
      } else {
        setMessage('');
        router.refresh(); // lo storico è renderizzato dal server
      }
    });
  };

  return (
    <div className="space-y-2">
      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label" htmlFor="chat-message">La tua domanda clinica</label>
          <textarea
            id="chat-message"
            className="input"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="es. Quali trend emergono dagli ultimi esami condivisi?"
            disabled={pending}
          />
        </div>
        <button type="button" onClick={send} disabled={pending || !message.trim()} className="btn-primary">
          {pending ? 'Invio…' : 'Invia'}
        </button>
      </div>
      {pending && <p className="text-xs text-slate-500">L’assistente sta elaborando la risposta sui documenti condivisi…</p>}
    </div>
  );
}
