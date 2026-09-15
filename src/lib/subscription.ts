import 'server-only';
import { db } from './db';
import { PLANS, PREMIUM_PRICE_CENTS, PREMIUM_PERIOD_DAYS, PREMIUM_AI_FUNCTIONS } from './constants';

// Piano dell'utente e accesso alle funzioni IA.
//
// Modello commerciale:
//  - PAZIENTE  → l'IA è a pagamento (8,99 €/anno). Tutto il resto dell'app resta gratuito.
//  - PROFESSIONISTA → l'IA è inclusa: si monetizza nel prezzo di vendita dell'app, non in-app.
//    Resta l'interruttore DoctorProfile.aiIncluded per i casi particolari.
//  - STAFF     → eredita dal professionista a cui è collegato.
//  - ADMIN     → sempre abilitato (deve poter testare i provider).
//
// Nessun incasso automatico: finché non c'è un provider di pagamento l'attivazione è
// manuale da pannello admin. Il modello dati regge già rinnovi, scadenze e storico.

export type PlanState = {
  plan: string;
  status: string;
  expiresAt: Date | null;
  /** Giorni alla scadenza; null se non scade. Negativo = già scaduto. */
  daysLeft: number | null;
  isPremium: boolean;
};

const FREE_STATE: PlanState = { plan: PLANS.FREE, status: 'ACTIVE', expiresAt: null, daysLeft: null, isPremium: false };

/**
 * Stato del piano, con la scadenza già applicata: un PREMIUM con `expiresAt` passata
 * vale FREE anche se nel DB la riga dice ancora ACTIVE (il job di scadenza può non
 * essere ancora passato, e non si può far dipendere un gate da un cron).
 */
export async function getPlanState(userId: string): Promise<PlanState> {
  const sub = await db.subscription.findUnique({ where: { userId } });
  if (!sub) return FREE_STATE;

  const expired = sub.expiresAt != null && sub.expiresAt.getTime() <= Date.now();
  const active = sub.status === 'ACTIVE' && !expired;
  const daysLeft = sub.expiresAt == null ? null : Math.ceil((sub.expiresAt.getTime() - Date.now()) / 86_400_000);

  return {
    plan: active ? sub.plan : PLANS.FREE,
    status: expired && sub.status === 'ACTIVE' ? 'EXPIRED' : sub.status,
    expiresAt: sub.expiresAt,
    daysLeft,
    isPremium: active && sub.plan === PLANS.PREMIUM,
  };
}

/**
 * Può questo utente usare questa funzione IA?
 * Restituisce anche il motivo, così la UI può spiegarlo invece di limitarsi a negare.
 */
export async function canUseAi(
  userId: string,
  role: string,
  functionKey: string,
): Promise<{ allowed: true } | { allowed: false; reason: 'PLAN' | 'DOCTOR_AI_OFF' }> {
  if (role === 'ADMIN') return { allowed: true };

  if (role === 'DOCTOR' || role === 'STAFF') {
    const doctor =
      role === 'DOCTOR'
        ? await db.doctorProfile.findUnique({ where: { userId }, select: { aiIncluded: true } })
        : await db.staffProfile
            .findUnique({ where: { userId }, select: { doctor: { select: { aiIncluded: true } } } })
            .then((s) => s?.doctor ?? null);
    // Nessun profilo: non è un caso da monetizzazione, lo bloccano i controlli d'accesso a monte.
    return doctor && !doctor.aiIncluded ? { allowed: false, reason: 'DOCTOR_AI_OFF' } : { allowed: true };
  }

  // Paziente e caregiver: solo le funzioni fuori dall'elenco premium sono libere.
  if (!PREMIUM_AI_FUNCTIONS.includes(functionKey)) return { allowed: true };
  const state = await getPlanState(userId);
  return state.isPremium ? { allowed: true } : { allowed: false, reason: 'PLAN' };
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

/**
 * Attiva (o rinnova) il premium. Se l'abbonamento è ancora valido la scadenza si somma
 * invece di ripartire da oggi: rinnovare in anticipo non deve far perdere giorni pagati.
 */
export async function activatePremium(opts: {
  userId: string;
  actorUserId?: string;
  days?: number;
  activatedBy?: string;
  externalRef?: string;
  note?: string;
}) {
  const days = opts.days ?? PREMIUM_PERIOD_DAYS;
  const existing = await db.subscription.findUnique({ where: { userId: opts.userId } });
  const stillValid =
    existing?.plan === PLANS.PREMIUM &&
    existing.status === 'ACTIVE' &&
    existing.expiresAt != null &&
    existing.expiresAt.getTime() > Date.now();
  const base = stillValid ? existing!.expiresAt! : new Date();
  const expiresAt = addDays(base, days);

  const sub = await db.subscription.upsert({
    where: { userId: opts.userId },
    update: {
      plan: PLANS.PREMIUM,
      status: 'ACTIVE',
      priceCents: PREMIUM_PRICE_CENTS,
      expiresAt,
      cancelledAt: null,
      activatedBy: opts.activatedBy ?? 'ADMIN',
      externalRef: opts.externalRef ?? null,
    },
    create: {
      userId: opts.userId,
      plan: PLANS.PREMIUM,
      status: 'ACTIVE',
      priceCents: PREMIUM_PRICE_CENTS,
      startedAt: new Date(),
      expiresAt,
      activatedBy: opts.activatedBy ?? 'ADMIN',
      externalRef: opts.externalRef ?? null,
    },
  });

  await db.subscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      kind: stillValid ? 'RENEWED' : existing ? 'REACTIVATED' : 'ACTIVATED',
      note: opts.note ?? `${days} giorni · scadenza ${expiresAt.toISOString().slice(0, 10)}`,
      actorUserId: opts.actorUserId ?? null,
    },
  });
  return sub;
}

/**
 * Disdetta: l'abbonamento resta utilizzabile fino alla scadenza già pagata.
 * Non si revoca un servizio per cui l'utente ha già versato il corrispettivo.
 */
export async function cancelPremium(opts: { userId: string; actorUserId?: string; note?: string }) {
  const sub = await db.subscription.findUnique({ where: { userId: opts.userId } });
  if (!sub) return null;
  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), autoRenew: false },
  });
  await db.subscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      kind: 'CANCELLED',
      note: opts.note ?? (sub.expiresAt ? `Attivo fino al ${sub.expiresAt.toISOString().slice(0, 10)}` : null),
      actorUserId: opts.actorUserId ?? null,
    },
  });
  return updated;
}

/** Riporta a FREE gli abbonamenti scaduti. Idempotente: chiamabile da un job periodico. */
export async function expireOverdueSubscriptions(): Promise<number> {
  const overdue = await db.subscription.findMany({
    where: { status: 'ACTIVE', plan: PLANS.PREMIUM, expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  for (const s of overdue) {
    await db.subscription.update({ where: { id: s.id }, data: { status: 'EXPIRED' } });
    await db.subscriptionEvent.create({ data: { subscriptionId: s.id, kind: 'EXPIRED' } });
  }
  return overdue.length;
}
