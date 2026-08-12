'use server';

// Azioni locali della segreteria: solo gestione agenda del medico di appartenenza,
// nessun accesso a contenuti clinici (che richiedono delega esplicita).
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireSession, clientInfo } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';

export type ActionState = { error?: string; success?: string } | null;

export async function staffCancelAppointmentAction(appointmentId: string): Promise<ActionState> {
  const session = await requireSession(['STAFF']);
  const staff = await db.staffProfile.findUnique({ where: { id: session.staffId! } });
  if (!staff) return { error: 'Profilo segreteria non trovato.' };

  const appt = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: { include: { user: true } }, doctor: { include: { user: true } } },
  });
  // La segreteria opera SOLO sull'agenda del medico di appartenenza
  if (!appt || appt.doctorId !== staff.doctorId) return { error: 'Appuntamento non trovato.' };
  if (appt.status === 'ANNULLATO' || appt.status === 'COMPLETATO') return { error: 'L’appuntamento è già chiuso.' };

  await db.appointment.update({
    where: { id: appointmentId },
    data: { status: 'ANNULLATO', cancelReason: 'Annullato dalla segreteria', cancelledBy: 'STAFF' },
  });

  const when = `${appt.startsAt.toLocaleDateString('it-IT')} alle ${appt.startsAt.toTimeString().slice(0, 5)}`;
  await notify({
    userId: appt.patient.user.id,
    eventKey: 'appuntamento_annullato',
    title: 'Appuntamento annullato',
    body: `L’appuntamento del ${when} è stato annullato dalla segreteria.`,
    refType: 'Appointment',
    refId: appt.id,
  });
  await notify({
    userId: appt.doctor.user.id,
    eventKey: 'appuntamento_annullato',
    title: 'Appuntamento annullato dalla segreteria',
    body: `L’appuntamento del ${when} è stato annullato.`,
    refType: 'Appointment',
    refId: appt.id,
  });

  const { ip, userAgent } = clientInfo();
  await audit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'UPDATE',
    targetType: 'Appointment',
    targetId: appointmentId,
    patientId: appt.patientId,
    ip,
    userAgent,
    metadata: { status: 'ANNULLATO', by: 'STAFF' },
  });

  revalidatePath('/segreteria');
  return { success: 'Appuntamento annullato: paziente e medico sono stati avvisati.' };
}
