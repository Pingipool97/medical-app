'use server';

// Azioni condivise sul documentale (usate da area paziente e area medico).
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireSession, clientInfo } from '@/lib/auth';
import { assertDoctorPatientAccess, assertDocumentAccess } from '@/lib/access';
import { audit } from '@/lib/audit';
import { sha256 } from '@/lib/crypto';
import { ALLOWED_MIME, MAX_FILE_BYTES, saveEncrypted, sniffMime } from '@/lib/storage';
import { enqueueProcessing, retryJob } from '@/lib/processing';
import { notify } from '@/lib/notify';

export type ActionState = { error?: string; success?: string; documentId?: string } | null;

export async function uploadDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'DOCTOR', 'CAREGIVER']);
  const patientId = String(formData.get('patientId') ?? session.patientId ?? '');
  if (!patientId) return { error: 'Paziente non indicato.' };
  await assertDoctorPatientAccess(session, patientId);

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'Seleziona un file da caricare.' };
  if (file.size > MAX_FILE_BYTES) return { error: 'Il file supera i 25 MB. Riduci la dimensione o dividilo.' };

  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffMime(buf);
  if (!sniffed || !ALLOWED_MIME.includes(sniffed)) {
    return { error: 'Formato non supportato. Puoi caricare PDF o foto (JPG, PNG, WebP).' };
  }

  const title = String(formData.get('title') ?? '').trim() || file.name;
  const docTypeCode = String(formData.get('docTypeCode') ?? 'altro');
  const specializationCode = String(formData.get('specializationCode') ?? '') || null;
  const docDateRaw = String(formData.get('docDate') ?? '');
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const issuer = String(formData.get('issuer') ?? '').trim() || null;

  const ext = sniffed === 'application/pdf' ? '.pdf' : sniffed === 'image/png' ? '.png' : sniffed === 'image/webp' ? '.webp' : '.jpg';
  const filePath = await saveEncrypted(buf, ext);

  const doc = await db.document.create({
    data: {
      patientId,
      uploadedByUserId: session.userId,
      uploadedByRole: session.role,
      title,
      docTypeCode,
      specializationCode,
      docDate: docDateRaw ? new Date(docDateRaw) : null,
      dateConfirmed: !!docDateRaw,
      issuer,
      notes,
      fileName: file.name,
      filePath,
      mimeType: sniffed,
      fileSize: file.size,
      sha256: sha256(buf),
    },
  });

  const { ip, userAgent } = clientInfo();
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'CREATE', targetType: 'Document', targetId: doc.id, patientId, ip, userAgent });
  await enqueueProcessing(doc.id);

  // Se carica il medico, il documento è automaticamente nel suo scope
  if (session.role === 'DOCTOR' && session.doctorId) {
    await db.documentShare.create({ data: { documentId: doc.id, doctorId: session.doctorId } });
  }

  revalidatePath('/paziente/documenti');
  revalidatePath('/medico');
  return { success: 'Documento caricato. L’elaborazione è in corso: troverai qui lo stato.', documentId: doc.id };
}

// Condivisione per singolo documento a un medico collegato (regola: default privato)
export async function shareDocumentAction(documentId: string, doctorId: string): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  const doc = await assertDocumentAccess(session, documentId);
  const link = await db.doctorPatientLink.findFirst({ where: { doctorId, patientId: doc.patientId, status: 'ACTIVE' } });
  if (!link) return { error: 'Puoi condividere solo con un medico collegato al tuo profilo.' };

  await db.documentShare.upsert({
    where: { documentId_doctorId: { documentId, doctorId } },
    update: { revokedAt: null, sharedAt: new Date() },
    create: { documentId, doctorId },
  });
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'SHARE', targetType: 'Document', targetId: documentId, patientId: doc.patientId, metadata: { doctorId } });

  const docProfile = await db.doctorProfile.findUnique({ where: { id: doctorId }, include: { user: true } });
  if (docProfile) {
    await notify({
      userId: docProfile.userId,
      eventKey: 'documento_condiviso',
      title: 'Nuovo documento condiviso',
      body: `Un paziente ha condiviso con te il documento "${doc.title}".`,
      refType: 'Document',
      refId: documentId,
    });
  }
  revalidatePath('/paziente/documenti');
  return { success: 'Documento condiviso con il medico.' };
}

export async function revokeShareAction(documentId: string, doctorId: string): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  const doc = await assertDocumentAccess(session, documentId);
  await db.documentShare.updateMany({ where: { documentId, doctorId }, data: { revokedAt: new Date() } });
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'REVOKE', targetType: 'DocumentShare', targetId: documentId, patientId: doc.patientId, metadata: { doctorId } });
  revalidatePath('/paziente/documenti');
  return { success: 'Condivisione revocata. Nota: il medico conserva copia di quanto già ricevuto, come previsto dagli obblighi di conservazione.' };
}

export async function retryProcessingAction(documentId: string): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'DOCTOR', 'CAREGIVER']);
  const doc = await assertDocumentAccess(session, documentId);
  const job = await db.processingJob.findFirst({ where: { documentId: doc.id }, orderBy: { createdAt: 'desc' } });
  if (!job) {
    await enqueueProcessing(doc.id);
  } else {
    await retryJob(job.id);
  }
  revalidatePath('/paziente/documenti');
  return { success: 'Elaborazione riavviata.' };
}

// Conferma umana di un valore estratto (stato "estratto automaticamente" → "confermato")
export async function confirmLabResultAction(labResultId: string, confirmed: boolean): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'DOCTOR', 'CAREGIVER']);
  const lr = await db.labResult.findUnique({ where: { id: labResultId } });
  if (!lr) return { error: 'Valore non trovato.' };
  await assertDoctorPatientAccess(session, lr.patientId);
  if (confirmed) {
    await db.labResult.update({ where: { id: labResultId }, data: { humanConfirmed: true } });
  } else {
    await db.labResult.delete({ where: { id: labResultId } });
  }
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'UPDATE', targetType: 'LabResult', targetId: labResultId, patientId: lr.patientId, metadata: { confirmed } });
  revalidatePath('/paziente/documenti');
  return { success: confirmed ? 'Valore confermato.' : 'Valore eliminato.' };
}

export async function confirmDocDateAction(documentId: string, dateISO: string): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'DOCTOR', 'CAREGIVER']);
  const doc = await assertDocumentAccess(session, documentId);
  const d = new Date(dateISO);
  if (isNaN(d.getTime())) return { error: 'Data non valida.' };
  await db.document.update({ where: { id: doc.id }, data: { docDate: d, dateConfirmed: true } });
  await db.timelineEvent.updateMany({ where: { refType: 'Document', refId: doc.id }, data: { date: d } });
  revalidatePath('/paziente/documenti');
  return { success: 'Data confermata.' };
}

// Risoluzione della quarantena/duplicato
export async function resolveReviewAction(documentId: string, decision: 'CONFERMA' | 'ELIMINA'): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  const doc = await assertDocumentAccess(session, documentId);
  if (decision === 'ELIMINA') {
    await db.document.update({ where: { id: doc.id }, data: { deletedAt: new Date(), status: 'FAILED' } });
    await db.timelineEvent.deleteMany({ where: { refType: 'Document', refId: doc.id } });
    revalidatePath('/paziente/documenti');
    return { success: 'Documento eliminato.' };
  }
  await db.document.update({ where: { id: doc.id }, data: { status: 'PROCESSED', duplicateOfId: null } });
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'UPDATE', targetType: 'Document', targetId: doc.id, patientId: doc.patientId, metadata: { decision } });
  revalidatePath('/paziente/documenti');
  return { success: 'Documento confermato e ripristinato.' };
}
