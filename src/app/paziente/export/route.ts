import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, clientInfo } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { decryptField } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

// Portabilità dei dati: il paziente scarica una copia completa dei propri dati in JSON.
export async function GET() {
  const session = await getSession();
  if (!session?.patientId || session.twoFactorPending) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 401 });
  }
  const patientId = session.patientId;

  const profile = await db.patientProfile.findUnique({
    where: { id: patientId },
    include: {
      conditions: true,
      allergies: true,
      medications: true,
      surgeries: true,
      vaccinations: true,
      familyHistory: true,
      lifestyle: true,
      vitals: { orderBy: { measuredAt: 'asc' } },
      pregnancy: true,
    },
  });
  if (!profile) return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 });

  const [documents, requests, appointments, issued, timeline] = await Promise.all([
    db.document.findMany({
      where: { patientId, deletedAt: null },
      select: {
        id: true, title: true, docTypeCode: true, specializationCode: true, docDate: true,
        dateConfirmed: true, issuer: true, notes: true, fileName: true, mimeType: true,
        fileSize: true, status: true, extractionQuality: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.serviceRequest.findMany({ where: { patientId }, orderBy: { createdAt: 'asc' } }),
    db.appointment.findMany({ where: { patientId }, include: { service: true, doctor: { select: { firstName: true, lastName: true } } }, orderBy: { startsAt: 'asc' } }),
    db.issuedDocument.findMany({ where: { patientId }, include: { doctor: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } }),
    db.timelineEvent.findMany({ where: { patientId }, orderBy: { date: 'asc' } }),
  ]);

  const {
    codiceFiscaleEnc, codiceFiscaleHash, emergencyNameEnc, emergencyPhoneEnc, healthCardEnc,
    conditions, allergies, medications, surgeries, vaccinations, familyHistory, lifestyle, vitals, pregnancy,
    ...profileRest
  } = profile;

  const payload = {
    esportatoIl: new Date().toISOString(),
    nota: 'Copia completa dei tuoi dati registrati su Cartella Intelligente. I file dei documenti si scaricano singolarmente dalla sezione Documenti.',
    profilo: {
      ...profileRest,
      codiceFiscale: decryptField(codiceFiscaleEnc),
      tesseraSanitaria: decryptField(healthCardEnc) || null,
      contattoEmergenza: {
        nome: decryptField(emergencyNameEnc) || null,
        telefono: decryptField(emergencyPhoneEnc) || null,
      },
    },
    diario: {
      patologie: conditions,
      allergie: allergies,
      farmaci: medications,
      interventi: surgeries,
      vaccinazioni: vaccinations,
      familiarita: familyHistory,
      stileDiVita: lifestyle,
      misurazioni: vitals,
      gravidanza: pregnancy,
    },
    documenti: documents,
    documentiRicevuti: issued,
    richieste: requests,
    appuntamenti: appointments,
    timeline,
  };

  const { ip, userAgent } = clientInfo();
  await audit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'EXPORT',
    targetType: 'Export',
    patientId,
    ip,
    userAgent,
    metadata: { documenti: documents.length, richieste: requests.length },
  });

  const fileName = `miei-dati-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
