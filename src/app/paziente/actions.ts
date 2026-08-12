'use server';

// Azioni locali dell'area paziente (quelle non coperte dalle azioni condivise).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

export type ActionState = { error?: string; success?: string } | null;

// Avanzamento onboarding: salva lo step raggiunto e porta allo step successivo (o alla home)
export async function advanceOnboardingAction(step: number, next: number | null) {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  if (!session.patientId) throw new Error('FORBIDDEN');
  const profile = await db.patientProfile.findUnique({ where: { id: session.patientId } });
  if (profile && step > profile.onboardingStep) {
    await db.patientProfile.update({ where: { id: session.patientId }, data: { onboardingStep: step } });
  }
  revalidatePath('/paziente');
  redirect(next ? `/paziente/onboarding?step=${next}` : '/paziente');
}

// Ricevute di lettura: segna come letti i messaggi del medico quando il paziente apre il thread
export async function markConversationReadAction(conversationId: string): Promise<void> {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  if (!session.patientId) return;
  const conv = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || conv.patientId !== session.patientId) return;
  await db.message.updateMany({
    where: { conversationId, senderRole: 'DOCTOR', readAt: null },
    data: { readAt: new Date() },
  });
}

// Revoca del consenso al trattamento IA: dal momento della revoca l'assistente IA non è più utilizzabile
export async function revokeAiConsentAction(consentRecordId: string): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  const record = await db.consentRecord.findUnique({ where: { id: consentRecordId }, include: { consentVersion: true } });
  if (!record || record.userId !== session.userId) return { error: 'Consenso non trovato.' };
  if (record.revokedAt) return { error: 'Questo consenso risulta già revocato.' };
  await db.consentRecord.update({ where: { id: consentRecordId }, data: { revokedAt: new Date() } });
  await audit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'REVOKE',
    targetType: 'ConsentRecord',
    targetId: consentRecordId,
    patientId: session.patientId,
    metadata: { kind: record.consentVersion.kind },
  });
  revalidatePath('/paziente/impostazioni');
  return { success: 'Consenso revocato. Le funzioni di intelligenza artificiale non useranno più i tuoi dati.' };
}
