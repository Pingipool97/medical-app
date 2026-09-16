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

/**
 * Riscrive in blocco l'elenco delle professioni del medico: arriva l'insieme completo
 * di caselle spuntate, non una aggiunta per volta. Il paziente le legge sotto al nome
 * del medico, quindi devono cambiare tutte insieme o nessuna: niente stato intermedio
 * in cui il profilo mostra meta' elenco.
 */
export async function setSpecializationsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession(['DOCTOR']);
  const doctorId = session.doctorId!;
  const ids = Array.from(new Set(formData.getAll('specializations').map(String).filter(Boolean)));
  if (ids.length === 0) return { error: 'Tieni almeno una professione: è quella che il paziente vede sotto al tuo nome.' };

  const valide = await db.specialization.findMany({ where: { id: { in: ids }, active: true } });
  if (valide.length !== ids.length) return { error: 'Una delle professioni scelte non è più disponibile. Ricarica la pagina e riprova.' };

  // Un medico senza albo che si aggiunge una professione iscritta a un Ordine deve
  // passare dalla verifica: il numero lo chiede l'amministrazione, non questo modulo.
  const doctor = await db.doctorProfile.findUnique({ where: { id: doctorId } });
  const serveAlbo = valide.some((s) => s.requiresOrdine);
  if (serveAlbo && !doctor?.ordineNumber) {
    return { error: 'Per una professione iscritta a un Ordine serve il numero di albo: scrivi all’amministrazione per aggiungerlo.' };
  }

  await db.$transaction([
    db.doctorSpecialization.deleteMany({ where: { doctorId, specializationId: { notIn: ids } } }),
    ...ids.map((specializationId) =>
      db.doctorSpecialization.upsert({
        where: { doctorId_specializationId: { doctorId, specializationId } },
        update: {},
        create: { doctorId, specializationId },
      }),
    ),
  ]);

  revalidatePath('/medico/impostazioni');
  revalidatePath('/paziente/medici');
  return { success: valide.length === 1 ? 'Professione aggiornata.' : `Professioni aggiornate (${valide.length}).` };
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
