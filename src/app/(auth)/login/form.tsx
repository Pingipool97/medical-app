'use client';
import { useFormState } from 'react-dom';
import Link from 'next/link';
import { loginAction, type ActionState } from '../actions';
import { Alert, Field } from '@/components/ui';

export default function LoginForm() {
  const [state, action] = useFormState<ActionState, FormData>(loginAction, null);
  return (
    <>
      <form action={action} className="mt-6 space-y-4">
        {state?.error && <Alert kind="error">{state.error}</Alert>}
        <Field label="Email" name="email" type="email" required autoComplete="email" />
        <Field label="Password" name="password" type="password" required autoComplete="current-password" />
        <button type="submit" className="btn-primary w-full">Accedi</button>
      </form>
      <p className="text-sm text-slate-600 mt-5 text-center">
        Non hai un account? <Link href="/registrazione" className="text-brand-700 font-medium hover:underline">Registrati</Link>
      </p>
    </>
  );
}
