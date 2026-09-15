'use server';

// Preferenze di notifica per utente. Le NotificationRule dell'admin restano la policy
// della piattaforma: qui l'utente sceglie solo dentro quel perimetro (può spegnere un
// canale ammesso, non accenderne uno vietato). In-app non è disattivabile.

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { DEFAULT_REMINDER_HOURS, REMINDER_HOURS_OPTIONS } from '@/lib/constants';

export type ActionState = { error?: string; success?: string } | null;

export async function saveNotificationPrefsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'DOCTOR', 'STAFF', 'CAREGIVER', 'ADMIN']);

  // Gli eventi arrivano dalla form come elenco esplicito: così una casella non spuntata
  // si distingue da un evento non presente nella form (che non va toccato).
  const keys = formData.getAll('eventKey').map(String).filter(Boolean);
  if (keys.length === 0) return { error: 'Nessuna preferenza da salvare.' };

  const reminderRaw = Number(formData.get('reminderHours') ?? DEFAULT_REMINDER_HOURS);
  const reminderHours = (REMINDER_HOURS_OPTIONS as readonly number[]).includes(reminderRaw)
    ? reminderRaw
    : DEFAULT_REMINDER_HOURS;

  for (const eventKey of keys) {
    const data = {
      email: formData.get(`email:${eventKey}`) === 'on',
      sms: formData.get(`sms:${eventKey}`) === 'on',
      push: formData.get(`push:${eventKey}`) === 'on',
      reminderHours: eventKey === 'appuntamento_promemoria' ? reminderHours : null,
    };
    await db.notificationPreference.upsert({
      where: { userId_eventKey: { userId: session.userId, eventKey } },
      update: data,
      create: { userId: session.userId, eventKey, ...data },
    });
  }

  revalidatePath('/paziente/impostazioni');
  revalidatePath('/medico/impostazioni');
  return { success: 'Preferenze di notifica salvate.' };
}
