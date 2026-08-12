'use server';

// Azioni locali dell'area medico (quelle non coperte dalle azioni condivise in src/app/actions).
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

export type ActionState = { error?: string; success?: string } | null;

// ── Messaggi: ricevute di lettura lato medico ──
// Nota: chiamata durante il render della pagina thread, quindi niente revalidatePath qui.
export async function markDoctorConversationReadAction(conversationId: string): Promise<void> {
  const session = await requireSession(['DOCTOR']);
  const conv = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || conv.doctorId !== session.doctorId) return;
  await db.message.updateMany({
    where: { conversationId, senderRole: { not: 'DOCTOR' }, readAt: null },
    data: { readAt: new Date() },
  });
}

// ── Profilo professionale ──

export async function updateDoctorProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const bio = String(formData.get('bio') ?? '').trim() || null;
  const professionalPhone = String(formData.get('professionalPhone') ?? '').trim() || null;
  const responseTimeHours = parseInt(String(formData.get('responseTimeHours') ?? ''), 10);
  if (isNaN(responseTimeHours) || responseTimeHours < 1 || responseTimeHours > 720) {
    return { error: 'Indica un tempo di risposta valido, tra 1 e 720 ore.' };
  }
  await db.doctorProfile.update({
    where: { id: session.doctorId! },
    data: { bio, professionalPhone, responseTimeHours },
  });
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'UPDATE', targetType: 'DoctorProfile', targetId: session.doctorId! });
  revalidatePath('/medico/impostazioni');
  return { success: 'Profilo aggiornato. Il tempo di risposta dichiarato è visibile ai pazienti.' };
}

export async function addOfficeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const name = String(formData.get('name') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  if (!name || !city) return { error: 'Indica almeno nome della sede e città.' };
  const doctor = await db.doctorProfile.findUnique({ where: { id: session.doctorId! } });
  if (!doctor) return { error: 'Profilo non trovato.' };
  let offices: { name: string; address: string; city: string }[] = [];
  try { offices = JSON.parse(doctor.offices ?? '[]'); } catch { offices = []; }
  offices.push({ name, address, city });
  await db.doctorProfile.update({ where: { id: doctor.id }, data: { offices: JSON.stringify(offices) } });
  revalidatePath('/medico/impostazioni');
  return { success: 'Sede aggiunta.' };
}

export async function removeOfficeAction(index: number): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const doctor = await db.doctorProfile.findUnique({ where: { id: session.doctorId! } });
  if (!doctor) return { error: 'Profilo non trovato.' };
  let offices: unknown[] = [];
  try { offices = JSON.parse(doctor.offices ?? '[]'); } catch { offices = []; }
  offices.splice(index, 1);
  await db.doctorProfile.update({ where: { id: doctor.id }, data: { offices: JSON.stringify(offices) } });
  revalidatePath('/medico/impostazioni');
  return { success: 'Sede rimossa.' };
}

export async function addSpecializationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const specializationId = String(formData.get('specializationId') ?? '');
  if (!specializationId) return { error: 'Seleziona una specializzazione.' };
  const spec = await db.specialization.findUnique({ where: { id: specializationId } });
  if (!spec || !spec.active) return { error: 'Specializzazione non valida.' };
  await db.doctorSpecialization.upsert({
    where: { doctorId_specializationId: { doctorId: session.doctorId!, specializationId } },
    update: {},
    create: { doctorId: session.doctorId!, specializationId },
  });
  revalidatePath('/medico/impostazioni');
  return { success: 'Specializzazione aggiunta.' };
}

export async function removeSpecializationAction(id: string): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  await db.doctorSpecialization.deleteMany({ where: { id, doctorId: session.doctorId! } });
  revalidatePath('/medico/impostazioni');
  return { success: 'Specializzazione rimossa.' };
}

// ── Catalogo prestazioni (ServiceCatalog) ──

function parseServiceFields(formData: FormData): { error?: string; data?: { name: string; durationMin: number; priceCents: number; mode: string } } {
  const name = String(formData.get('name') ?? '').trim();
  const durationMin = parseInt(String(formData.get('durationMin') ?? ''), 10);
  const priceEuro = parseFloat(String(formData.get('priceEuro') ?? '').replace(',', '.'));
  const mode = String(formData.get('mode') ?? 'ENTRAMBI');
  if (!name) return { error: 'Indica il nome della prestazione.' };
  if (isNaN(durationMin) || durationMin < 5 || durationMin > 480) return { error: 'Durata non valida (5–480 minuti).' };
  if (isNaN(priceEuro) || priceEuro < 0) return { error: 'Prezzo non valido.' };
  if (!['PRESENZA', 'VIDEO', 'ENTRAMBI'].includes(mode)) return { error: 'Modalità non valida.' };
  return { data: { name, durationMin, priceCents: Math.round(priceEuro * 100), mode } };
}

export async function createServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const parsed = parseServiceFields(formData);
  if (parsed.error || !parsed.data) return { error: parsed.error };
  await db.serviceCatalog.create({ data: { doctorId: session.doctorId!, ...parsed.data } });
  revalidatePath('/medico/agenda');
  return { success: 'Prestazione aggiunta al catalogo.' };
}

export async function updateServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const id = String(formData.get('id') ?? '');
  const service = await db.serviceCatalog.findUnique({ where: { id } });
  if (!service || service.doctorId !== session.doctorId) return { error: 'Prestazione non trovata.' };
  const parsed = parseServiceFields(formData);
  if (parsed.error || !parsed.data) return { error: parsed.error };
  await db.serviceCatalog.update({ where: { id }, data: parsed.data });
  revalidatePath('/medico/agenda');
  return { success: 'Prestazione aggiornata.' };
}

export async function toggleServiceAction(id: string): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const service = await db.serviceCatalog.findUnique({ where: { id } });
  if (!service || service.doctorId !== session.doctorId) return { error: 'Prestazione non trovata.' };
  await db.serviceCatalog.update({ where: { id }, data: { active: !service.active } });
  revalidatePath('/medico/agenda');
  return { success: service.active ? 'Prestazione disattivata: non è più prenotabile.' : 'Prestazione riattivata.' };
}
