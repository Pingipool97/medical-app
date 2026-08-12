'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { openConversationAction } from '@/app/actions/communication';
import { Icon } from '@/components/icons';

export function OpenConversationButton({ patientId, doctorId, label = 'Apri conversazione' }: {
  patientId: string;
  doctorId: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await openConversationAction(patientId, doctorId);
            if (res.conversationId) router.push(`/paziente/messaggi/${res.conversationId}`);
            else setError(res.error ?? 'Non è stato possibile aprire la conversazione.');
          })
        }
        className="btn-secondary !py-1.5 text-sm inline-flex items-center gap-1.5"
      >
        {pending ? 'Apro…' : <><Icon name="message" className="w-4 h-4" /> {label}</>}
      </button>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
