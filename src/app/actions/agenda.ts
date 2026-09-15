'use server';

// Agenda, disponibilità, prenotazioni, lista d'attesa.
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { assertDoctorPatientAccess } from '@/lib/access';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { getSetting } from '@/lib/settings';
import { fromZoned, dateKey, timeKey, weekdayOf, shiftDateKey, todayKey, addMinutesToTime, timeToMinutes } from '@/lib/datetime';
import { PATIENT_COLORS } from '@/lib/constants';

export type ActionState = { error?: string; success?: string } | null;

// Calcolo slot liberi per un medico in un giorno (disponibilità − eccezioni − appuntamenti).
// Tutti gli orari sono "da muro" italiani: le conversioni passano da @/lib/datetime,
// mai da new Date('...T..:..') che verrebbe interpretata nel fuso del server.
export async function computeFreeSlots(doctorId: string, dateISO: string, serviceId: string): Promise<string[]> {
  const service = await db.serviceCatalog.findUnique({ where: { id: serviceId } });
  if (!service) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || dateISO < todayKey()) return [];

  const dayStart = fromZoned(dateISO, '00:00');
  const dayEnd = fromZoned(shiftDateKey(dateISO, 1), '00:00');

  const exception = await db.availabilityException.findFirst({
    where: { doctorId, date: { gte: dayStart, lt: dayEnd }, closed: true },
  });
  if (exception) return [];

  const avails = await db.availability.findMany({ where: { doctorId, weekday: weekdayOf(dayStart) } });
  const appts = await db.appointment.findMany({
    where: { doctorId, startsAt: { gte: dayStart, lt: dayEnd }, status: { in: ['PRENOTATO', 'CONFERMATO'] } },
    select: { startsAt: true, endsAt: true },
  });

  const slots: string[] = [];
  const now = Date.now();
  for (const a of avails) {
    // validFrom/validTo: una fascia non ancora attiva o già terminata non genera slot
    if (a.validFrom && dayStart < a.validFrom) continue;
    if (a.validTo && dayStart > a.validTo) continue;

    let time = a.startTime;
    const endMin = timeToMinutes(a.endTime);
    while (timeToMinutes(time) + service.durationMin <= endMin) {
      const start = fromZoned(dateISO, time);
      const end = new Date(start.getTime() + service.durationMin * 60_000);
      const overlaps = appts.some((ap) => start < ap.endsAt && end > ap.startsAt);
      if (!overlaps && start.getTime() > now) slots.push(time);
      time = addMinutesToTime(time, service.durationMin);
    }
  }
  return [...new Set(slots)].sort();
}

/** Quali giorni di un intervallo hanno almeno uno slot libero: serve alla vista mese. */
export async function daysWithAvailability(doctorId: string, fromISO: string, toISO: string, serviceId: string): Promise<string[]> {
  const out: string[] = [];
  let cursor = fromISO;
  // Limite di sicurezza: una vista mese non chiede mai più di ~42 giorni.
  for (let i = 0; i < 45 && cursor <= toISO; i++) {
    const slots = await computeFreeSlots(doctorId, cursor, serviceId);
    if (slots.length > 0) out.push(cursor);
    cursor = shiftDateKey(cursor, 1);
  }
  return out;
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

  const startsAt = fromZoned(dateISO, time);
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return { error: 'Data non valida.' };
  const d = fromZoned(dateISO, '00:00');
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

// ─────────────────── Azioni del professionista sull'agenda ───────────────────

/** C'è già un appuntamento attivo che si sovrappone a questa fascia? */
async function overlapsExisting(doctorId: string, startsAt: Date, endsAt: Date, exceptId?: string): Promise<boolean> {
  const clash = await db.appointment.findFirst({
    where: {
      doctorId,
      status: { in: ['PRENOTATO', 'CONFERMATO'] },
      ...(exceptId ? { id: { not: exceptId } } : {}),
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });
  return Boolean(clash);
}

/**
 * Sposta un appuntamento (drag&drop sul calendario o cambio orario dal dettaglio).
 * Non passa da computeFreeSlots: il professionista può mettere un appuntamento anche
 * fuori dalle fasce dichiarate — quelle vincolano la prenotazione del paziente, non
 * quello che il medico fa della propria agenda. La sovrapposizione con un altro
 * appuntamento resta invece bloccata: quella è un errore, non una scelta.
 */
export async function rescheduleAppointmentAction(
  appointmentId: string,
  dateISO: string,
  time: string,
  durationMin?: number,
): Promise<ActionState> {
  const session = await requireSession(['DOCTOR', 'STAFF']);
  const doctorId =
    session.role === 'DOCTOR'
      ? session.doctorId
      : (await db.staffProfile.findUnique({ where: { userId: session.userId }, select: { doctorId: true } }))?.doctorId;
  if (!doctorId) return { error: 'Profilo non trovato.' };

  const appt = await db.appointment.findUnique({ where: { id: appointmentId }, include: { patient: true } });
  if (!appt || appt.doctorId !== doctorId) return { error: 'Appuntamento non trovato.' };
  if (appt.status === 'ANNULLATO' || appt.status === 'COMPLETATO') {
    return { error: 'Un appuntamento annullato o completato non si può spostare.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || !/^\d{2}:\d{2}$/.test(time)) return { error: 'Data o orario non validi.' };

  const minutes = durationMin ?? Math.round((appt.endsAt.getTime() - appt.startsAt.getTime()) / 60_000);
  const startsAt = fromZoned(dateISO, time);
  const endsAt = new Date(startsAt.getTime() + minutes * 60_000);
  if (await overlapsExisting(doctorId, startsAt, endsAt, appointmentId)) {
    return { error: 'In quella fascia c’è già un altro appuntamento.' };
  }

  const before = { date: dateKey(appt.startsAt), time: timeKey(appt.startsAt) };
  await db.appointment.update({
    where: { id: appointmentId },
    // Spostare l'appuntamento invalida il promemoria già inviato: va rimandato.
    data: { startsAt, endsAt, reminderSentAt: null },
  });

  await notify({
    userId: appt.patient.userId,
    eventKey: 'appuntamento_prenotato',
    title: 'Appuntamento spostato',
    body: `Il tuo appuntamento è stato spostato al ${dateISO} alle ${time}.`,
    refType: 'Appointment',
    refId: appointmentId,
  });
  await audit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'UPDATE',
    targetType: 'Appointment',
    targetId: appointmentId,
    patientId: appt.patientId,
    metadata: { da: before, a: { date: dateISO, time } },
  });
  revalidatePath('/medico/agenda');
  revalidatePath('/paziente/appuntamenti');
  revalidatePath('/segreteria');
  return { success: 'Appuntamento spostato.' };
}

/** Il professionista crea un appuntamento cliccando su uno slot vuoto del calendario. */
export async function createAppointmentByDoctorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const doctorId = session.doctorId!;
  const patientId = String(formData.get('patientId') ?? '');
  const serviceId = String(formData.get('serviceId') ?? '');
  const dateISO = String(formData.get('date') ?? '');
  const time = String(formData.get('time') ?? '');
  const mode = String(formData.get('mode') ?? 'PRESENZA');
  const note = String(formData.get('note') ?? '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || !/^\d{2}:\d{2}$/.test(time)) return { error: 'Data o orario non validi.' };

  // Solo pazienti effettivamente collegati: l'agenda non è una porta di servizio per
  // creare relazioni cliniche che non esistono.
  const link = await db.doctorPatientLink.findFirst({ where: { doctorId, patientId, status: 'ACTIVE' } });
  if (!link) return { error: 'Questo paziente non è collegato al tuo profilo.' };

  const service = serviceId ? await db.serviceCatalog.findUnique({ where: { id: serviceId } }) : null;
  if (serviceId && (!service || service.doctorId !== doctorId)) return { error: 'Prestazione non valida.' };
  const minutes = service?.durationMin ?? Number(formData.get('durationMin') ?? 30);

  const startsAt = fromZoned(dateISO, time);
  const endsAt = new Date(startsAt.getTime() + minutes * 60_000);
  if (await overlapsExisting(doctorId, startsAt, endsAt)) {
    return { error: 'In quella fascia c’è già un altro appuntamento.' };
  }

  const appt = await db.appointment.create({
    data: {
      doctorId,
      patientId,
      serviceId: service?.id ?? null,
      startsAt,
      endsAt,
      mode: service?.mode === 'VIDEO' ? 'VIDEO' : mode,
      // Inserito dal professionista: nasce già confermato, non deve confermare sé stesso.
      status: 'CONFERMATO',
      questionnaire: note ? JSON.stringify({ motivo: note }) : null,
    },
    include: { patient: true },
  });

  await notify({
    userId: appt.patient.userId,
    eventKey: 'appuntamento_prenotato',
    title: 'Nuovo appuntamento in agenda',
    body: `Il tuo professionista ha fissato un appuntamento per il ${dateISO} alle ${time}.`,
    refType: 'Appointment',
    refId: appt.id,
  });
  await audit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'CREATE',
    targetType: 'Appointment',
    targetId: appt.id,
    patientId,
  });
  revalidatePath('/medico/agenda');
  revalidatePath('/paziente/appuntamenti');
  return { success: 'Appuntamento creato.' };
}

/** Transizioni di stato finora modellate ma mai scritte da nessuna parte. */
export async function setAppointmentStatusAction(
  appointmentId: string,
  status: 'CONFERMATO' | 'NO_SHOW' | 'PRENOTATO',
): Promise<ActionState> {
  const session = await requireSession(['DOCTOR', 'STAFF']);
  const doctorId =
    session.role === 'DOCTOR'
      ? session.doctorId
      : (await db.staffProfile.findUnique({ where: { userId: session.userId }, select: { doctorId: true } }))?.doctorId;
  const appt = await db.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt || !doctorId || appt.doctorId !== doctorId) return { error: 'Appuntamento non trovato.' };
  if (appt.status === 'ANNULLATO' || appt.status === 'COMPLETATO') return { error: 'Stato non modificabile.' };
  if (status === 'NO_SHOW' && appt.startsAt.getTime() > Date.now()) {
    return { error: 'Non si può segnare come “non presentato” un appuntamento futuro.' };
  }

  await db.appointment.update({ where: { id: appointmentId }, data: { status } });
  await audit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'UPDATE',
    targetType: 'Appointment',
    targetId: appointmentId,
    patientId: appt.patientId,
    metadata: { status },
  });
  revalidatePath('/medico/agenda');
  revalidatePath('/segreteria');
  revalidatePath('/paziente/appuntamenti');
  return { success: 'Stato aggiornato.' };
}

/** Colore con cui il professionista distingue un paziente in agenda. */
export async function setPatientColorAction(patientId: string, color: string): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  if (!PATIENT_COLORS.some((c) => c.key === color)) return { error: 'Colore non valido.' };
  const updated = await db.doctorPatientLink.updateMany({
    where: { doctorId: session.doctorId!, patientId, status: 'ACTIVE' },
    data: { color },
  });
  if (updated.count === 0) return { error: 'Paziente non collegato.' };
  revalidatePath('/medico/agenda');
  revalidatePath('/medico/pazienti');
  return { success: 'Colore aggiornato.' };
}

/** Cancella una chiusura/eccezione: mancava, la lista si poteva solo riempire. */
export async function deleteExceptionAction(id: string): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  await db.availabilityException.deleteMany({ where: { id, doctorId: session.doctorId! } });
  revalidatePath('/medico/agenda');
  return { success: 'Chiusura rimossa.' };
}

/** Colore della prestazione in agenda: è la modalità di colorazione predefinita. */
export async function setServiceColorAction(serviceId: string, color: string): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  if (!PATIENT_COLORS.some((c) => c.key === color)) return { error: 'Colore non valido.' };
  const updated = await db.serviceCatalog.updateMany({
    where: { id: serviceId, doctorId: session.doctorId! },
    data: { color },
  });
  if (updated.count === 0) return { error: 'Prestazione non trovata.' };
  revalidatePath('/medico/agenda');
  return { success: 'Colore aggiornato.' };
}
