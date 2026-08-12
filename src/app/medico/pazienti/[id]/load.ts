import 'server-only';

// Caricamento sicuro del paziente per l'area medico: verifica il collegamento ATTIVO,
// registra l'accesso nell'audit log (consultabile dal paziente) e restituisce i dati
// minimi per l'header di sicurezza (allergie sempre visibili, gravidanza/allattamento).
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession, clientInfo, type Session } from '@/lib/auth';
import { activeLink } from '@/lib/access';
import { auditClinicalRead } from '@/lib/audit';

export async function loadPatientForDoctor(patientId: string, targetType: string) {
  const session = await getSession();
  if (!session?.doctorId) redirect('/login');
  const link = await activeLink(session!.doctorId!, patientId);
  if (!link) redirect('/medico/pazienti'); // nessun collegamento attivo: nessun accesso

  const patient = await db.patientProfile.findUnique({
    where: { id: patientId },
    include: { allergies: true, pregnancy: true },
  });
  if (!patient) redirect('/medico/pazienti');

  const { ip, userAgent } = clientInfo();
  await auditClinicalRead(
    { userId: session!.userId, role: session!.role, ip, userAgent },
    patientId,
    targetType,
    patientId
  );

  return { session: session as Session, doctorId: session!.doctorId as string, patient: patient! };
}
