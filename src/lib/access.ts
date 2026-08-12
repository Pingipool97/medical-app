import 'server-only';
import { db } from './db';
import type { Session } from './auth';

// Regola di condivisione multi-medico: "per scope, default privato".
// Un medico vede SOLO: i documenti che il paziente gli ha condiviso, i propri documenti emessi,
// le proprie note/bozze IA. Il diario sanitario è visibile ai medici con collegamento ATTIVO
// (è il quadro di sicurezza: allergie e farmaci devono essere visibili a chiunque curi il paziente).

export async function activeLink(doctorId: string, patientId: string) {
  return db.doctorPatientLink.findFirst({
    where: { doctorId, patientId, status: 'ACTIVE' },
  });
}

export async function assertDoctorPatientAccess(session: Session, patientId: string) {
  if (session.role === 'ADMIN') return;
  if (session.role === 'PATIENT' && session.patientId === patientId) return;
  if (session.role === 'DOCTOR' && session.doctorId) {
    const link = await activeLink(session.doctorId, patientId);
    if (link) return;
  }
  if (session.role === 'STAFF' && session.staffId) {
    // La segreteria accede a dati clinici solo con delega esplicita, valida e non revocata
    const del = await db.staffDelegation.findFirst({
      where: {
        staffId: session.staffId,
        patientId,
        scope: 'CLINICO',
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (del) return;
  }
  if (session.role === 'CAREGIVER') {
    const del = await db.caregiverDelegation.findFirst({
      where: {
        caregiverUserId: session.userId,
        patientId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (del) return;
  }
  throw new Error('FORBIDDEN');
}

// Documenti visibili a un medico per un paziente: solo quelli condivisi (non revocati) o emessi da lui
export async function visibleDocumentsForDoctor(doctorId: string, patientId: string) {
  return db.document.findMany({
    where: {
      patientId,
      deletedAt: null,
      sharedWith: { some: { doctorId, revokedAt: null } },
    },
    orderBy: { docDate: 'desc' },
    include: { sharedWith: true, labResults: { include: { analyte: true } } },
  });
}

export async function assertDocumentAccess(session: Session, documentId: string) {
  const doc = await db.document.findUnique({ where: { id: documentId }, include: { sharedWith: true, patient: true } });
  if (!doc || doc.deletedAt) throw new Error('NOT_FOUND');
  if (session.role === 'ADMIN') return doc;
  if (session.role === 'PATIENT' && session.patientId === doc.patientId) return doc;
  if (session.role === 'DOCTOR' && session.doctorId) {
    const share = doc.sharedWith.find((s) => s.doctorId === session.doctorId && !s.revokedAt);
    if (share) return doc;
    // copia giuridica del medico: documento revocato ma con copia conservata per obbligo di legge
    const retained = doc.sharedWith.find((s) => s.doctorId === session.doctorId && s.doctorCopyRetained);
    if (retained) return doc;
  }
  if (session.role === 'CAREGIVER') {
    await assertDoctorPatientAccess(session, doc.patientId);
    return doc;
  }
  throw new Error('FORBIDDEN');
}

export async function patientsOfDoctor(doctorId: string) {
  const links = await db.doctorPatientLink.findMany({
    where: { doctorId, status: 'ACTIVE' },
    include: { patient: { include: { allergies: true, pregnancy: true } } },
    orderBy: { acceptedAt: 'desc' },
  });
  return links.map((l) => l.patient);
}
