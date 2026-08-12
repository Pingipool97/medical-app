'use server';

// Azioni IA: generazione bozze, flusso di revisione medico (bozza → revisionata → pubblicata),
// chat clinica, assistente paziente, controllo interazioni.
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { assertDoctorPatientAccess, assertDocumentAccess } from '@/lib/access';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import {
  runDocumentSummary, runPatientSynthesis, runClinicalSuggestions, runVisitPrep,
  clinicalChat, patientAssistant, checkDrugSafety,
} from '@/lib/ai/functions';

export type ActionState = { error?: string; success?: string; outputId?: string } | null;

export async function generateDocSummaryAction(documentId: string, audience: 'DOCTOR' | 'PATIENT'): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  await assertDocumentAccess(session, documentId);
  const res = await runDocumentSummary(session, documentId, audience);
  if (!res.ok) return { error: res.message };
  revalidatePath('/medico');
  return { success: 'Bozza generata: revisionala prima di usarla.', outputId: res.output.id };
}

export async function generateSynthesisAction(patientId: string): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  await assertDoctorPatientAccess(session, patientId);
  const res = await runPatientSynthesis(session, patientId);
  if (!res.ok) return { error: res.message };
  revalidatePath(`/medico/pazienti/${patientId}`);
  return { success: 'Sintesi generata come bozza.', outputId: res.output.id };
}

export async function generateSuggestionsAction(patientId: string): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  await assertDoctorPatientAccess(session, patientId);
  const res = await runClinicalSuggestions(session, patientId);
  if (!res.ok) return { error: res.message };
  revalidatePath(`/medico/pazienti/${patientId}`);
  return { success: 'Suggerimenti generati come bozza.', outputId: res.output.id };
}

export async function generateVisitPrepAction(appointmentId: string, audience: 'DOCTOR' | 'PATIENT'): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const res = await runVisitPrep(session, appointmentId, audience);
  if (!res.ok) return { error: res.message };
  revalidatePath('/medico/agenda');
  return { success: 'Briefing generato come bozza.', outputId: res.output.id };
}

// Revisione del medico: obbligatoria prima che qualunque contenuto raggiunga il paziente
export async function reviewAiOutputAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const outputId = String(formData.get('outputId') ?? '');
  const decision = String(formData.get('decision') ?? ''); // APPROVA | APPROVA_E_PUBBLICA | SCARTA
  const editedContent = String(formData.get('content') ?? '').trim();

  const output = await db.aiOutput.findUnique({ where: { id: outputId }, include: { job: { include: { patient: { include: { user: true } } } } } });
  if (!output) return { error: 'Bozza non trovata.' };
  if (output.state !== 'DRAFT' && output.state !== 'REVIEWED') return { error: 'Questa bozza è già stata gestita.' };
  if (output.job.patientId) await assertDoctorPatientAccess(session, output.job.patientId);

  if (decision === 'SCARTA') {
    await db.aiOutput.update({ where: { id: outputId }, data: { state: 'REJECTED', reviewedByUserId: session.userId, reviewedAt: new Date() } });
    revalidatePath('/medico/bozze-ia');
    return { success: 'Bozza scartata.' };
  }

  const finalContent = editedContent || output.contentDraft;
  const publish = decision === 'APPROVA_E_PUBBLICA' && output.audience === 'PATIENT';
  await db.aiOutput.update({
    where: { id: outputId },
    data: {
      state: publish ? 'PUBLISHED' : 'REVIEWED',
      contentFinal: finalContent,
      reviewedByUserId: session.userId,
      reviewedAt: new Date(),
      publishedAt: publish ? new Date() : null,
    },
  });
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'UPDATE', targetType: 'AiOutput', targetId: outputId, patientId: output.job.patientId, metadata: { decision } });

  if (publish && output.job.patient) {
    await notify({
      userId: output.job.patient.user.id,
      eventKey: 'documento_emesso',
      title: 'Il tuo medico ha pubblicato una spiegazione',
      body: 'È disponibile una spiegazione validata dal tuo medico. Accedi per leggerla.',
      refType: 'AiOutput',
      refId: outputId,
    });
  }
  revalidatePath('/medico/bozze-ia');
  return { success: publish ? 'Contenuto validato e pubblicato al paziente.' : 'Bozza approvata.' };
}

export async function clinicalChatAction(patientId: string, message: string) {
  const session = await requireSession(['DOCTOR']);
  await assertDoctorPatientAccess(session, patientId);
  if (!message.trim()) return { error: 'Scrivi una domanda.' };
  const res = await clinicalChat(session, patientId, message.trim());
  revalidatePath(`/medico/pazienti/${patientId}/chat`);
  return res;
}

export async function patientAssistantAction(question: string) {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  if (!question.trim()) return { error: 'Scrivi una domanda.' };
  // Consenso IA: senza consenso la funzione non parte
  const consent = await db.consentRecord.findFirst({
    where: { userId: session.userId, revokedAt: null, consentVersion: { kind: 'IA_TRATTAMENTO' } },
  });
  if (!consent) {
    return { answer: 'Non hai dato il consenso all’elaborazione con IA: puoi attivarlo dalle Impostazioni. Nel frattempo, per qualsiasi dubbio scrivi al tuo medico dalla sezione Richieste.', blocked: true, disclaimer: '' };
  }
  return patientAssistant(session, session.patientId!, question.trim());
}

export async function drugSafetyCheckAction(patientId: string, proposedDrug: string) {
  const session = await requireSession(['DOCTOR']);
  await assertDoctorPatientAccess(session, patientId);
  if (!proposedDrug.trim()) return { configured: false as const, message: 'Indica il farmaco da verificare.' };
  const res = await checkDrugSafety(patientId, proposedDrug.trim());
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'AI_REQUEST', targetType: 'DrugSafety', patientId, metadata: { proposedDrug: proposedDrug.slice(0, 60) } });
  return res;
}
