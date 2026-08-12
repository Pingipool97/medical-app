'use server';

// Richieste con stato, messaggistica, collegamenti medico-paziente.
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireSession, clientInfo } from '@/lib/auth';
import { assertDoctorPatientAccess } from '@/lib/access';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { detectRedFlags } from '@/lib/redflags';

export type ActionState = { error?: string; success?: string; redFlags?: string[] } | null;

// ── Collegamento medico-paziente ──

export async function requestLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['PATIENT']);
  const doctorId = String(formData.get('doctorId') ?? '');
  const doctor = await db.doctorProfile.findUnique({ where: { id: doctorId } });
  if (!doctor) return { error: 'Medico non trovato.' };
  if (doctor.verificationStatus !== 'VERIFIED') return { error: 'Questo medico non è ancora stato verificato dalla piattaforma.' };

  const existing = await db.doctorPatientLink.findUnique({ where: { doctorId_patientId: { doctorId, patientId: session.patientId! } } });
  if (existing && existing.status === 'ACTIVE') return { error: 'Sei già collegato a questo medico.' };
  if (existing && existing.status === 'PENDING') return { error: 'Hai già una richiesta in attesa per questo medico.' };

  if (existing) {
    await db.doctorPatientLink.update({ where: { id: existing.id }, data: { status: 'PENDING', requestedBy: 'PATIENT', revokedAt: null } });
  } else {
    await db.doctorPatientLink.create({ data: { doctorId, patientId: session.patientId!, status: 'PENDING', requestedBy: 'PATIENT' } });
  }
  await notify({
    userId: doctor.userId,
    eventKey: 'collegamento_richiesto',
    title: 'Nuova richiesta di collegamento',
    body: 'Un paziente chiede di collegarsi al tuo studio. Accetta o rifiuta dalla sezione Pazienti.',
  });
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'CREATE', targetType: 'DoctorPatientLink', patientId: session.patientId, metadata: { doctorId } });
  revalidatePath('/paziente/medici');
  return { success: 'Richiesta inviata. Il medico deve accettarla prima di poter vedere i tuoi dati.' };
}

export async function respondLinkAction(linkId: string, accept: boolean): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const link = await db.doctorPatientLink.findUnique({ where: { id: linkId }, include: { patient: { include: { user: true } } } });
  if (!link || link.doctorId !== session.doctorId) return { error: 'Richiesta non trovata.' };
  if (accept) {
    // Enforcement lato server: un medico non verificato non può ricevere pazienti
    const doctor = await db.doctorProfile.findUnique({ where: { id: session.doctorId! } });
    if (!doctor || doctor.verificationStatus !== 'VERIFIED') {
      return { error: 'Il tuo account non è ancora verificato: non puoi accettare pazienti.' };
    }
  }
  await db.doctorPatientLink.update({
    where: { id: linkId },
    data: accept ? { status: 'ACTIVE', acceptedAt: new Date() } : { status: 'ENDED', revokedAt: new Date(), revokedBy: 'DOCTOR' },
  });
  await notify({
    userId: link.patient.user.id,
    eventKey: 'collegamento_attivo',
    title: accept ? 'Collegamento attivato' : 'Richiesta non accettata',
    body: accept ? 'Il medico ha accettato il collegamento: ora puoi condividere documenti e inviare richieste.' : 'Il medico non ha accettato la richiesta di collegamento.',
  });
  await audit({ actorUserId: session.userId, actorRole: session.role, action: accept ? 'UPDATE' : 'REVOKE', targetType: 'DoctorPatientLink', targetId: linkId, patientId: link.patientId });
  revalidatePath('/medico/pazienti');
  return { success: accept ? 'Collegamento attivato.' : 'Richiesta rifiutata.' };
}

// Revoca dal paziente: chiude l'accesso prospettico; le copie già condivise restano al medico (obbligo di conservazione)
export async function revokeLinkAction(linkId: string): Promise<ActionState> {
  const session = await requireSession(['PATIENT']);
  const link = await db.doctorPatientLink.findUnique({ where: { id: linkId } });
  if (!link || link.patientId !== session.patientId) return { error: 'Collegamento non trovato.' };
  await db.doctorPatientLink.update({ where: { id: linkId }, data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: 'PATIENT' } });
  await db.documentShare.updateMany({
    where: { doctorId: link.doctorId, document: { patientId: link.patientId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'REVOKE', targetType: 'DoctorPatientLink', targetId: linkId, patientId: link.patientId });
  revalidatePath('/paziente/medici');
  return { success: 'Accesso revocato. Il medico non vedrà più i tuoi nuovi dati; conserva copia dei documenti già ricevuti come previsto per legge.' };
}

// ── Richieste (oggetti con stato) ──

export async function createRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  const patientId = String(formData.get('patientId') ?? session.patientId ?? '');
  await assertDoctorPatientAccess(session, patientId);
  const doctorId = String(formData.get('doctorId') ?? '');
  const typeCode = String(formData.get('typeCode') ?? '');
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const confirmedEmergency = formData.get('confirmedEmergency') === 'on';
  if (!doctorId || !typeCode || !subject || !body) return { error: 'Compila tutti i campi.' };

  const link = await db.doctorPatientLink.findFirst({ where: { doctorId, patientId, status: 'ACTIVE' } });
  if (!link) return { error: 'Puoi inviare richieste solo a un medico collegato.' };

  // Screening sintomi d'allarme: blocco con interstitial finché l'utente non conferma
  const flags = detectRedFlags(subject + ' ' + body);
  if (flags.length > 0 && !confirmedEmergency) {
    return { redFlags: flags };
  }

  const typeDef = await db.requestTypeDef.findUnique({ where: { code: typeCode } });
  const req = await db.serviceRequest.create({
    data: {
      patientId,
      doctorId,
      typeCode,
      subject,
      body,
      redFlag: flags.length > 0,
      slaHours: typeDef?.defaultSlaHours,
      attachments: JSON.stringify(formData.getAll('attachmentId').map(String).filter(Boolean)),
      history: JSON.stringify([{ from: null, to: 'NUOVA', byUserId: session.userId, at: new Date().toISOString() }]),
    },
  });
  const doctor = await db.doctorProfile.findUnique({ where: { id: doctorId } });
  if (doctor) {
    await notify({
      userId: doctor.userId,
      eventKey: flags.length > 0 ? 'red_flag' : 'richiesta_nuova',
      title: flags.length > 0 ? '⚠️ Richiesta con sintomi d’allarme' : 'Nuova richiesta',
      body: `${subject}${flags.length > 0 ? ' — il paziente è stato invitato a chiamare il 112' : ''}`,
      refType: 'ServiceRequest',
      refId: req.id,
    });
  }
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'CREATE', targetType: 'ServiceRequest', targetId: req.id, patientId });
  revalidatePath('/paziente/richieste');
  return { success: 'Richiesta inviata. Vedrai qui lo stato di avanzamento.' };
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  NUOVA: ['PRESA_IN_CARICO', 'RIFIUTATA'],
  PRESA_IN_CARICO: ['ATTESA_INFO', 'EVASA', 'RIFIUTATA'],
  ATTESA_INFO: ['PRESA_IN_CARICO', 'EVASA', 'RIFIUTATA'],
};

export async function updateRequestStatusAction(requestId: string, newStatus: string, note?: string): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const req = await db.serviceRequest.findUnique({ where: { id: requestId }, include: { patient: { include: { user: true } } } });
  if (!req || req.doctorId !== session.doctorId) return { error: 'Richiesta non trovata.' };
  const allowed = VALID_TRANSITIONS[req.status] ?? [];
  if (!allowed.includes(newStatus)) return { error: `Passaggio di stato non consentito da "${req.status}".` };
  if (newStatus === 'RIFIUTATA' && !note?.trim()) return { error: 'Il rifiuto richiede una motivazione per il paziente.' };

  const history = [...JSON.parse(req.history ?? '[]'), { from: req.status, to: newStatus, byUserId: session.userId, at: new Date().toISOString(), note }];
  await db.serviceRequest.update({
    where: { id: requestId },
    data: { status: newStatus, rejectReason: newStatus === 'RIFIUTATA' ? note : req.rejectReason, history: JSON.stringify(history) },
  });
  await notify({
    userId: req.patient.user.id,
    eventKey: 'richiesta_aggiornata',
    title: 'La tua richiesta è stata aggiornata',
    body: `"${req.subject}": ${newStatus === 'PRESA_IN_CARICO' ? 'presa in carico' : newStatus === 'ATTESA_INFO' ? 'il medico attende informazioni da te' : newStatus === 'EVASA' ? 'evasa' : 'rifiutata' + (note ? ' — ' + note : '')}.`,
    refType: 'ServiceRequest',
    refId: requestId,
  });
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'UPDATE', targetType: 'ServiceRequest', targetId: requestId, patientId: req.patientId, metadata: { newStatus } });
  revalidatePath('/medico/richieste');
  return { success: 'Stato aggiornato.' };
}

export async function cancelRequestAction(requestId: string): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  const req = await db.serviceRequest.findUnique({ where: { id: requestId } });
  if (!req) return { error: 'Richiesta non trovata.' };
  await assertDoctorPatientAccess(session, req.patientId);
  if (['EVASA', 'RIFIUTATA', 'ANNULLATA'].includes(req.status)) return { error: 'La richiesta è già chiusa.' };
  const history = [...JSON.parse(req.history ?? '[]'), { from: req.status, to: 'ANNULLATA', byUserId: session.userId, at: new Date().toISOString() }];
  await db.serviceRequest.update({ where: { id: requestId }, data: { status: 'ANNULLATA', history: JSON.stringify(history) } });
  revalidatePath('/paziente/richieste');
  return { success: 'Richiesta annullata.' };
}

// ── Messaggi ──

export async function sendMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'DOCTOR', 'CAREGIVER']);
  const conversationId = String(formData.get('conversationId') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  const confirmedEmergency = formData.get('confirmedEmergency') === 'on';
  if (!body) return { error: 'Scrivi un messaggio.' };

  const conv = await db.conversation.findUnique({ where: { id: conversationId }, include: { patient: { include: { user: true } }, doctor: { include: { user: true } } } });
  if (!conv) return { error: 'Conversazione non trovata.' };
  await assertDoctorPatientAccess(session, conv.patientId);

  let redFlag = false;
  if (session.role !== 'DOCTOR') {
    const flags = detectRedFlags(body);
    if (flags.length > 0 && !confirmedEmergency) return { redFlags: flags };
    redFlag = flags.length > 0;
  }

  await db.message.create({
    data: {
      conversationId,
      senderUserId: session.userId,
      senderRole: session.role,
      body,
      redFlag,
      attachments: JSON.stringify(formData.getAll('attachmentId').map(String).filter(Boolean)),
    },
  });
  const recipientUserId = session.role === 'DOCTOR' ? conv.patient.user.id : conv.doctor.user.id;
  await notify({
    userId: recipientUserId,
    eventKey: redFlag ? 'red_flag' : 'messaggio_nuovo',
    title: redFlag ? '⚠️ Messaggio con sintomi d’allarme' : 'Nuovo messaggio',
    body: 'Hai ricevuto un nuovo messaggio. Accedi per leggerlo.',
    refType: 'Conversation',
    refId: conversationId,
  });
  revalidatePath('/paziente/messaggi');
  revalidatePath('/medico/messaggi');
  return { success: 'Messaggio inviato.' };
}

export async function openConversationAction(patientId: string, doctorId: string): Promise<{ conversationId?: string; error?: string }> {
  const session = await requireSession(['PATIENT', 'DOCTOR', 'CAREGIVER']);
  await assertDoctorPatientAccess(session, patientId);
  const link = await db.doctorPatientLink.findFirst({ where: { doctorId, patientId, status: 'ACTIVE' } });
  if (!link) return { error: 'Nessun collegamento attivo con questo medico.' };
  const conv = await db.conversation.upsert({
    where: { patientId_doctorId: { patientId, doctorId } },
    update: {},
    create: { patientId, doctorId },
  });
  return { conversationId: conv.id };
}

export async function markNotificationsReadAction() {
  const session = await requireSession();
  await db.notification.updateMany({ where: { userId: session.userId, readAt: null }, data: { readAt: new Date() } });
  revalidatePath('/paziente/notifiche');
  revalidatePath('/medico/notifiche');
}
