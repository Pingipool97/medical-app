'use client';

import { useState, useTransition } from 'react';
import {
  adminActivatePremiumAction,
  adminCancelPremiumAction,
  adminSetDoctorAiAction,
  type ActionState,
} from '@/app/actions/subscription';
import { PREMIUM_PERIOD_DAYS } from '@/lib/constants';

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) return <span className="text-xs text-red-700">{state.error}</span>;
  if (state?.success) return <span className="text-xs text-emerald-700">{state.success}</span>;
  return null;
}

export function ActivateForm({ userId, label = 'Attiva Premium' }: { userId: string; label?: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const [days, setDays] = useState(String(PREMIUM_PERIOD_DAYS));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`days-${userId}`}>Giorni</label>
      <input
        id={`days-${userId}`}
        type="number"
        min={1}
        max={3650}
        value={days}
        onChange={(e) => setDays(e.target.value)}
        className="input !w-20 !py-1 text-xs"
        title="Giorni di abbonamento"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await adminActivatePremiumAction(userId, Number(days) || PREMIUM_PERIOD_DAYS)))}
        className="btn-primary !py-1.5 text-xs"
      >
        {pending ? 'Attendi…' : label}
      </button>
      <Feedback state={state} />
    </div>
  );
}

export function CancelButton({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm('Disdire questo abbonamento? Resta utilizzabile fino alla scadenza già pagata.')) {
            start(async () => setState(await adminCancelPremiumAction(userId)));
          }
        }}
        className="btn-secondary !py-1.5 text-xs"
      >
        {pending ? 'Attendi…' : 'Disdici'}
      </button>
      <Feedback state={state} />
    </span>
  );
}

export function DoctorAiToggle({ doctorId, included }: { doctorId: string; included: boolean }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await adminSetDoctorAiAction(doctorId, !included)))}
        className={`text-xs hover:underline disabled:opacity-50 ${included ? 'text-red-700' : 'text-emerald-700'}`}
      >
        {pending ? 'Attendi…' : included ? 'Disattiva IA' : 'Attiva IA'}
      </button>
      <Feedback state={state} />
    </span>
  );
}
