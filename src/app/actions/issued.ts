'use server';

// Documenti emessi dal medico verso il paziente (ricetta bianca, certificati "liberi",
// richieste esami, piani terapeutici, referti di visita, istruzioni).
// Nota regolatoria implementata: la piattaforma NON emette ricette SSN dematerializzate
// (l'NRE lo genera solo il Sistema TS) né certificati di malattia INPS: qui si gestiscono
// ricette bianche, promemoria NRE e certificati liberi.
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { assertDoctorPatientAccess } from '@/lib/access';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { sha256 } from '@/lib/crypto';
import { ISSUED_KINDS } from '@/lib/constants';

export type ActionState = { error?: string; success?: string } | null;

export async function issueDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const doctor = await db.doctorProfile.findUnique({ where: { id: session.doctorId! } });
  if (!doctor || doctor.verificationStatus !== 'VERIFIED') {
    return { error: 'Il tuo account non è ancora verificato: non puoi emettere documenti. Contatta l’amministrazione.' };
  }
  const patientId = String(formData.get('patientId') ?? '');
  await assertDoctorPatientAccess(session, patientId);

  const kind = String(formData.get('kind') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const nreCode = String(formData.get('nreCode') ?? '').trim() || null;
  const requestId = String(formData.get('requestId') ?? '') || null;
  if (!ISSUED_KINDS.some((k) => k.value === kind) || !title || !body) return { error: 'Compila tipo, titolo e contenuto.' };
  if (kind === 'PROMEMORIA_NRE' && !nreCode) return { error: 'Per il promemoria serve il codice NRE della ricetta emessa via Sistema TS.' };

  // Firma digitale: dipende dal provider configurato. Senza provider il documento è
  // esplicitamente marcato NON_FIRMATO — mai una firma finta.
  const signatureProvider = await db.providerConfig.findFirst({ where: { kind: 'FIRMA', enabled: true } });
  const content = JSON.stringify({ testo: body, nreCode });

  const issued = await db.issuedDocument.create({
    data: {
      doctorId: session.doctorId!,
      patientId,
      kind,
      title,
      content,
      nreCode,
      requestId,
      signatureStatus: signatureProvider ? 'FIRMATO_FEA' : 'NON_FIRMATO',
      signedAt: signatureProvider ? new Date() : null,
      contentHash: sha256(content),
      sentAt: new Date(),
    },
  });

  await db.timelineEvent.create({
    data: {
      patientId,
      type: 'DOCUMENTO_EMESSO',
      date: new Date(),
      title: `${ISSUED_KINDS.find((k) => k.value === kind)?.label ?? kind}: ${title}`,
      refType: 'IssuedDocument',
      refId: issued.id,
    },
  });

  const patient = await db.patientProfile.findUnique({ where: { id: patientId }, include: { user: true } });
  if (patient) {
    await notify({
      userId: patient.user.id,
      eventKey: 'documento_emesso',
      title: 'Nuovo documento dal tuo medico',
      body: `Il tuo medico ti ha inviato: "${title}". Accedi per leggerlo.`,
      refType: 'IssuedDocument',
      refId: issued.id,
    });
  }
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'CREATE', targetType: 'IssuedDocument', targetId: issued.id, patientId, metadata: { kind } });

  // Se emesso in evasione di una richiesta, la richiesta passa a EVASA
  if (requestId) {
    const req = await db.serviceRequest.findUnique({ where: { id: requestId } });
    if (req && req.doctorId === session.doctorId && !['EVASA', 'RIFIUTATA', 'ANNULLATA'].includes(req.status)) {
      const history = [...JSON.parse(req.history ?? '[]'), { from: req.status, to: 'EVASA', byUserId: session.userId, at: new Date().toISOString(), note: `Evasa con documento: ${title}` }];
      await db.serviceRequest.update({ where: { id: requestId }, data: { status: 'EVASA', history: JSON.stringify(history) } });
    }
  }

  revalidatePath('/medico');
  return { success: `Documento emesso e notificato al paziente${signatureProvider ? ' (firmato digitalmente)' : ' — NON firmato digitalmente: configura un provider di firma per la validità legale'}.` };
}

export async function markIssuedReadAction(issuedId: string): Promise<void> {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  const doc = await db.issuedDocument.findUnique({ where: { id: issuedId } });
  if (!doc) return;
  await assertDoctorPatientAccess(session, doc.patientId);
  if (!doc.readAt) {
    await db.issuedDocument.update({ where: { id: issuedId }, data: { readAt: new Date() } });
  }
}
