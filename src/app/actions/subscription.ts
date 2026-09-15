'use server';

// Abbonamento premium del paziente (8,99 €/anno) — sblocca le funzioni IA.
// Nessun incasso automatico: senza provider di pagamento l'attivazione è manuale
// da pannello admin. Qui c'è tutta la logica di stato, pronta per essere agganciata
// a un webhook di pagamento quando ci sarà.

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { activatePremium, cancelPremium, getPlanState } from '@/lib/subscription';
import { PREMIUM_PERIOD_DAYS } from '@/lib/constants';

export type ActionState = { error?: string; success?: string } | null;

/**
 * Richiesta di attivazione da parte del paziente.
 * Finché il pagamento non è integrato l'abbonamento resta PENDING_PAYMENT e deve
 * essere confermato da un amministratore: non si dichiara attivo qualcosa che non
 * è stato incassato.
 */
export async function requestPremiumAction(): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  const state = await getPlanState(session.userId);
  if (state.isPremium) return { error: 'Hai già un abbonamento attivo.' };

  const existing = await db.subscription.findUnique({ where: { userId: session.userId } });
  if (existing?.status === 'PENDING_PAYMENT') {
    return { error: 'Hai già una richiesta in attesa di conferma.' };
  }

  const sub = await db.subscription.upsert({
    where: { userId: session.userId },
    update: { plan: 'PREMIUM', status: 'PENDING_PAYMENT', cancelledAt: null },
    create: { userId: session.userId, plan: 'PREMIUM', status: 'PENDING_PAYMENT' },
  });
  await db.subscriptionEvent.create({
    data: { subscriptionId: sub.id, kind: 'CREATED', note: 'Richiesta dal paziente', actorUserId: session.userId },
  });
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'CREATE', targetType: 'Subscription', targetId: sub.id });
  revalidatePath('/paziente/abbonamento');
  return { success: 'Richiesta registrata. Ti confermiamo l’attivazione a pagamento ricevuto.' };
}

/** Disdetta dal paziente: resta utilizzabile fino alla scadenza già pagata. */
export async function cancelPremiumAction(): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  const sub = await cancelPremium({ userId: session.userId, actorUserId: session.userId, note: 'Disdetta dal paziente' });
  if (!sub) return { error: 'Nessun abbonamento da disdire.' };
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'UPDATE', targetType: 'Subscription', targetId: sub.id, metadata: { status: 'CANCELLED' } });
  revalidatePath('/paziente/abbonamento');
  return { success: 'Abbonamento disdetto. Resta attivo fino alla scadenza già pagata.' };
}

// ── Azioni amministrative ──

export async function adminActivatePremiumAction(userId: string, days?: number): Promise<ActionState> {
  const session = await requireSession(['ADMIN']);
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) return { error: 'Utente non trovato.' };

  const sub = await activatePremium({
    userId,
    actorUserId: session.userId,
    days: days ?? PREMIUM_PERIOD_DAYS,
    activatedBy: 'ADMIN',
    note: 'Attivazione manuale da amministrazione',
  });
  await notify({
    userId,
    eventKey: 'messaggio_nuovo',
    title: 'Abbonamento Premium attivo',
    body: 'Le funzioni di intelligenza artificiale sono ora disponibili nel tuo account.',
    refType: 'Subscription',
    refId: sub.id,
  });
  await audit({ actorUserId: session.userId, actorRole: 'ADMIN', action: 'UPDATE', targetType: 'Subscription', targetId: sub.id, metadata: { action: 'ACTIVATE', days: days ?? PREMIUM_PERIOD_DAYS } });
  revalidatePath('/admin/abbonamenti');
  return { success: `Premium attivato per ${user.email}.` };
}

export async function adminCancelPremiumAction(userId: string): Promise<ActionState> {
  const session = await requireSession(['ADMIN']);
  const sub = await cancelPremium({ userId, actorUserId: session.userId, note: 'Disdetta da amministrazione' });
  if (!sub) return { error: 'Nessun abbonamento da disdire.' };
  await audit({ actorUserId: session.userId, actorRole: 'ADMIN', action: 'UPDATE', targetType: 'Subscription', targetId: sub.id, metadata: { action: 'CANCEL' } });
  revalidatePath('/admin/abbonamenti');
  return { success: 'Abbonamento disdetto.' };
}

/** Interruttore dell'IA inclusa per un professionista (casi particolari, non è un paywall). */
export async function adminSetDoctorAiAction(doctorId: string, included: boolean): Promise<ActionState> {
  const session = await requireSession(['ADMIN']);
  const updated = await db.doctorProfile.update({ where: { id: doctorId }, data: { aiIncluded: included } });
  await audit({ actorUserId: session.userId, actorRole: 'ADMIN', action: 'UPDATE', targetType: 'DoctorProfile', targetId: doctorId, metadata: { aiIncluded: included } });
  revalidatePath('/admin/abbonamenti');
  return { success: `IA ${included ? 'inclusa' : 'disattivata'} per ${updated.firstName} ${updated.lastName}.` };
}
