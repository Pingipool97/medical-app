'use server';

// Agenda, disponibilità, prenotazioni, lista d'attesa.
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { assertDoctorPatientAccess } from '@/lib/access';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { getSetting } from '@/lib/settings';

export type ActionState = { error?: string; success?: string } | null;

// Calcolo slot liberi per un medico in un giorno (disponibilità − eccezioni − appuntamenti)
export async function computeFreeSlots(doctorId: string, dateISO: string, serviceId: string): Promise<string[]> {
  const service = await db.serviceCatalog.findUnique({ where: { id: serviceId } });
  if (!service) return [];
  const date = new Date(dateISO + 'T00:00:00');
  if (isNaN(date.getTime()) || date < new Date(new Date().toDateString())) return [];

  const exception = await db.availabilityException.findFirst({
    where: { doctorId, date: { gte: date, lt: new Date(date.getTime() + 86400_000) }, closed: true },
  });
  if (exception) return [];

  const avails = await db.availability.findMany({ where: { doctorId, weekday: date.getDay() } });
  const appts = await db.appointment.findMany({
    where: { doctorId, startsAt: { gte: date, lt: new Date(date.getTime() + 86400_000) }, status: { in: ['PRENOTATO', 'CONFERMATO'] } },
  });

  const slots: string[] = [];
  const now = new Date();
  for (const a of avails) {
    const [sh, sm] = a.startTime.split(':').map(Number);
    const [eh, em] = a.endTime.split(':').map(Number);
    let t = new Date(date); t.setHours(sh, sm, 0, 0);
    const end = new Date(date); end.setHours(eh, em, 0, 0);
    while (t.getTime() + service.durationMin * 60_000 <= end.getTime()) {
      const slotEnd = new Date(t.getTime() + service.durationMin * 60_000);
      const overlaps = appts.some((ap) => t < ap.endsAt && slotEnd > ap.startsAt);
      if (!overlaps && t > now) {
        slots.push(t.toTimeString().slice(0, 5));
      }
      t = new Date(t.getTime() + service.durationMin * 60_000);
    }
  }
  return slots.sort();
}

export async function bookAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'CAREGIVER', 'STAFF']);
  const patientId = String(formData.get('patientId') ?? session.patientId ?? '');
  await assertDoctorPatientAccess(session, patientId);
  const doctorId = String(formData.get('doctorId') ?? '');
  const serviceId = String(formData.get('serviceId') ?? '');
  const dateISO = String(formData.get('date') ?? '');
  const time = String(formData.get('time') ?? '');
  const questionnaire = String(formData.get('questionnaire') ?? '').trim();

  const service = await db.serviceCatalog.findUnique({ where: { id: serviceId } });
  if (!service || service.doctorId !== doctorId) return { error: 'Prestazione non valida.' };
  const free = await computeFreeSlots(doctorId, dateISO, serviceId);
  if (!free.includes(time)) return { error: 'Lo slot scelto non è più disponibile. Scegline un altro.' };

  const startsAt = new Date(`${dateISO}T${time}:00`);
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
  const mode = service.mode === 'VIDEO' ? 'VIDEO' : String(formData.get('mode') ?? 'PRESENZA');

  const appt = await db.appointment.create({
    data: {
      doctorId, patientId, serviceId, startsAt, endsAt, mode,
      questionnaire: questionnaire ? JSON.stringify({ motivo: questionnaire }) : null,
    },
  });

  const doctor = await db.doctorProfile.findUnique({ where: { id: doctorId } });
  const patient = await db.patientProfile.findUnique({ where: { id: patientId }, include: { user: true } });
  if (doctor) {
    await notify({
      userId: doctor.userId, eventKey: 'appuntamento_prenotato',
      title: 'Nuovo appuntamento',
      body: `${service.name} il ${startsAt.toLocaleDateString('it-IT')} alle ${time}.`,
      refType: 'Appointment', refId: appt.id,
    });
  }
  if (patient) {
    await notify({
      userId: patient.user.id, eventKey: 'appuntamento_prenotato',
      title: 'Appuntamento prenotato',
      body: `${service.name} con ${doctor ? 'Dr. ' + doctor.lastName : 'il medico'} il ${startsAt.toLocaleDateString('it-IT')} alle ${time}.`,
      refType: 'Appointment', refId: appt.id,
    });
  }
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'CREATE', targetType: 'Appointment', targetId: appt.id, patientId });
  revalidatePath('/paziente/appuntamenti');
  revalidatePath('/medico/agenda');
  return { success: `Appuntamento prenotato per il ${startsAt.toLocaleDateString('it-IT')} alle ${time}.` };
}

export async function cancelAppointmentAction(appointmentId: string, reason?: string): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'DOCTOR', 'CAREGIVER', 'STAFF']);
  const appt = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: { include: { user: true } }, doctor: true, service: true },
  });
  if (!appt) return { error: 'Appuntamento non trovato.' };
  await assertDoctorPatientAccess(session, appt.patientId);
  if (appt.status === 'ANNULLATO' || appt.status === 'COMPLETATO') return { error: 'L’appuntamento è già chiuso.' };

  // Limite di disdetta configurabile (solo per il paziente)
  if (session.role !== 'DOCTOR' && session.role !== 'STAFF') {
    const limitHours = parseInt(await getSetting<string>('disdetta_ore_limite', '24'), 10);
    if (appt.startsAt.getTime() - Date.now() < limitHours * 3600_000) {
      return { error: `La disdetta online è possibile fino a ${limitHours} ore prima. Contatta direttamente lo studio.` };
    }
  }

  await db.appointment.update({
    where: { id: appointmentId },
    data: { status: 'ANNULLATO', cancelReason: reason || null, cancelledBy: session.role },
  });

  // Lista d'attesa: notifica chi aspetta uno slot
  const wait = await db.waitlistEntry.findFirst({
    where: { doctorId: appt.doctorId, notifiedAt: null, ...(appt.serviceId ? { OR: [{ serviceId: appt.serviceId }, { serviceId: null }] } : {}) },
    orderBy: { createdAt: 'asc' },
    include: { patient: { include: { user: true } } },
  });
  if (wait) {
    await db.waitlistEntry.update({ where: { id: wait.id }, data: { notifiedAt: new Date() } });
    await notify({
      userId: wait.patient.user.id, eventKey: 'slot_liberato',
      title: 'Si è liberato un posto',
      body: `Si è liberato uno slot il ${appt.startsAt.toLocaleDateString('it-IT')} alle ${appt.startsAt.toTimeString().slice(0, 5)}. Prenota subito se ti interessa.`,
    });
  }

  const counterpartUserId = session.role === 'DOCTOR' ? appt.patient.user.id : (await db.user.findFirst({ where: { doctorProfile: { id: appt.doctorId } } }))?.id;
  if (counterpartUserId) {
    await notify({
      userId: counterpartUserId, eventKey: 'appuntamento_annullato',
      title: 'Appuntamento annullato',
      body: `L’appuntamento del ${appt.startsAt.toLocaleDateString('it-IT')} alle ${appt.startsAt.toTimeString().slice(0, 5)} è stato annullato.`,
    });
  }
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'UPDATE', targetType: 'Appointment', targetId: appointmentId, patientId: appt.patientId, metadata: { status: 'ANNULLATO' } });
  revalidatePath('/paziente/appuntamenti');
  revalidatePath('/medico/agenda');
  return { success: 'Appuntamento annullato.' };
}

export async function joinWaitlistAction(doctorId: string, serviceId: string | null): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  const patientId = session.patientId!;
  const link = await db.doctorPatientLink.findFirst({ where: { doctorId, patientId, status: 'ACTIVE' } });
  if (!link) return { error: 'Puoi metterti in lista solo con un medico collegato.' };
  await db.waitlistEntry.create({ data: { doctorId, patientId, serviceId } });
  revalidatePath('/paziente/appuntamenti');
  return { success: 'Sei in lista d’attesa: ti avviseremo se si libera un posto.' };
}

// Gestione disponibilità (medico)
export async function saveAvailabilityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const weekday = parseInt(String(formData.get('weekday')), 10);
  const startTime = String(formData.get('startTime') ?? '');
  const endTime = String(formData.get('endTime') ?? '');
  if (isNaN(weekday) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) {
    return { error: 'Orari non validi.' };
  }
  await db.availability.create({ data: { doctorId: session.doctorId!, weekday, startTime, endTime } });
  revalidatePath('/medico/agenda');
  return { success: 'Fascia di disponibilità aggiunta.' };
}

export async function deleteAvailabilityAction(id: string): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  await db.availability.deleteMany({ where: { id, doctorId: session.doctorId! } });
  revalidatePath('/medico/agenda');
  return { success: 'Fascia rimossa.' };
}

export async function addExceptionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const dateISO = String(formData.get('date') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || null;
  const d = new Date(dateISO + 'T00:00:00');
  if (isNaN(d.getTime())) return { error: 'Data non valida.' };
  await db.availabilityException.create({ data: { doctorId: session.doctorId!, date: d, reason } });
  revalidatePath('/medico/agenda');
  return { success: 'Chiusura registrata.' };
}

export async function completeAppointmentAction(appointmentId: string, notes: string): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const appt = await db.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt || appt.doctorId !== session.doctorId) return { error: 'Appuntamento non trovato.' };
  await db.appointment.update({ where: { id: appointmentId }, data: { status: 'COMPLETATO', doctorNotes: notes || appt.doctorNotes } });
  revalidatePath('/medico/agenda');
  return { success: 'Visita completata. Puoi generare il referto dalle note.' };
}
