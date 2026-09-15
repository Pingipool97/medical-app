import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getPlanState } from '@/lib/subscription';
import { fmtDate, fmtDateTime, fmtEuro } from '@/lib/format';
import {
  PREMIUM_BENEFITS,
  PREMIUM_PRICE_CENTS,
  SUBSCRIPTION_EVENT_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
} from '@/lib/constants';
import { Alert, Badge, Card, PageTitle } from '@/components/ui';
import { Icon } from '@/components/icons';
import { RequestPremiumButton, CancelPremiumButton } from './forms';

export const dynamic = 'force-dynamic';

export default async function AbbonamentoPage() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');

  const [state, sub] = await Promise.all([
    getPlanState(session.userId),
    db.subscription.findUnique({
      where: { userId: session.userId },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 10 } },
    }),
  ]);

  const pending = sub?.status === 'PENDING_PAYMENT';

  return (
    <div className="space-y-5">
      <PageTitle
        title="Abbonamento"
        subtitle="Le funzioni di intelligenza artificiale di HABITUS."
      />

      {/* Stato corrente */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-brand-950">
                {state.isPremium ? 'Premium attivo' : pending ? 'Attivazione in corso' : 'Piano gratuito'}
              </h2>
              <Badge color={state.isPremium ? 'green' : pending ? 'amber' : 'gray'}>
                {sub ? SUBSCRIPTION_STATUS_LABEL[state.status] ?? state.status : 'Gratuito'}
              </Badge>
            </div>
            {state.isPremium && state.expiresAt && (
              <p className="text-sm text-slate-600 mt-1">
                Rinnovo previsto il <strong>{fmtDate(state.expiresAt)}</strong>
                {state.daysLeft != null && state.daysLeft <= 30 && (
                  <span className="text-amber-700"> · fra {state.daysLeft} giorni</span>
                )}
              </p>
            )}
            {!state.isPremium && !pending && (
              <p className="text-sm text-slate-600 mt-1">
                Documenti, timeline, diario, agenda e messaggi restano sempre gratuiti.
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-brand-950">{fmtEuro(PREMIUM_PRICE_CENTS)}</p>
            <p className="text-xs text-slate-500">all’anno</p>
          </div>
        </div>

        {sub?.status === 'CANCELLED' && sub.expiresAt && sub.expiresAt.getTime() > Date.now() && (
          <Alert kind="info">
            Hai disdetto il rinnovo. Le funzioni IA restano disponibili fino al {fmtDate(sub.expiresAt)}.
          </Alert>
        )}

        {pending && (
          <Alert kind="warn">
            La richiesta è registrata. L’abbonamento diventa attivo a pagamento ricevuto: ti avvisiamo con una notifica.
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!state.isPremium && !pending && <RequestPremiumButton />}
          {state.isPremium && sub?.status === 'ACTIVE' && <CancelPremiumButton />}
        </div>
      </Card>

      {/* Cosa include */}
      <Card title="Cosa include il Premium">
        <ul className="space-y-3">
          {PREMIUM_BENEFITS.map((b) => (
            <li key={b.title} className="flex gap-3">
              <span className="shrink-0 w-8 h-8 rounded-lg bg-accent-50 text-accent-700 flex items-center justify-center">
                <Icon name="sparkles" className="w-4 h-4" />
              </span>
              <div>
                <p className="font-medium text-brand-950">{b.title}</p>
                <p className="text-sm text-slate-600">{b.desc}</p>
              </div>
            </li>
          ))}
        </ul>
        <Alert kind="info">
          Le elaborazioni con IA richiedono il tuo consenso, che puoi dare o revocare quando vuoi dalle{' '}
          <Link href="/paziente/impostazioni" className="underline font-medium">Impostazioni</Link>. Senza consenso
          le funzioni restano spente anche con l’abbonamento attivo.
        </Alert>
      </Card>

      {/* Storico */}
      {sub && sub.events.length > 0 && (
        <Card title="Storico abbonamento">
          <ul className="divide-y divide-slate-100">
            {sub.events.map((e) => (
              <li key={e.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{SUBSCRIPTION_EVENT_LABEL[e.kind] ?? e.kind}</span>
                  {e.note && <span className="text-slate-500"> — {e.note}</span>}
                </span>
                <span className="text-xs text-slate-500">{fmtDateTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
