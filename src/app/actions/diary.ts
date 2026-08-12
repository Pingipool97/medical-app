'use server';

// Diario sanitario: CRUD compilabile in modo progressivo.
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { assertDoctorPatientAccess } from '@/lib/access';
import { audit } from '@/lib/audit';
import { recomputeCompleteness } from '@/lib/completeness';

export type ActionState = { error?: string; success?: string } | null;

async function ctx(formData: FormData) {
  const session = await requireSession(['PATIENT', 'CAREGIVER', 'DOCTOR']);
  const patientId = String(formData.get('patientId') ?? session.patientId ?? '');
  await assertDoctorPatientAccess(session, patientId);
  return { session, patientId };
}

async function done(session: { userId: string; role: string }, patientId: string, targetType: string, msg: string): Promise<ActionState> {
  await recomputeCompleteness(patientId);
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'UPDATE', targetType, patientId });
  revalidatePath('/paziente/diario');
  return { success: msg };
}

export async function addConditionAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { session, patientId } = await ctx(f);
  const name = String(f.get('name') ?? '').trim();
  if (!name) return { error: 'Indica la patologia.' };
  await db.condition.create({
    data: {
      patientId, name,
      status: String(f.get('status') ?? 'ACTIVE'),
      onsetDate: f.get('onsetDate') ? new Date(String(f.get('onsetDate'))) : null,
      notes: String(f.get('notes') ?? '').trim() || null,
    },
  });
  return done(session, patientId, 'Condition', 'Patologia registrata.');
}

export async function addAllergyAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { session, patientId } = await ctx(f);
  const allergen = String(f.get('allergen') ?? '').trim();
  if (!allergen) return { error: 'Indica l’allergene.' };
  await db.allergy.create({
    data: {
      patientId, allergen,
      kind: String(f.get('kind') ?? 'ALTRO'),
      severity: String(f.get('severity') ?? 'MODERATA'),
      reaction: String(f.get('reaction') ?? '').trim() || null,
    },
  });
  return done(session, patientId, 'Allergy', 'Allergia registrata. Sarà evidenziata ovunque nel tuo profilo.');
}

export async function addMedicationAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { session, patientId } = await ctx(f);
  const name = String(f.get('name') ?? '').trim();
  if (!name) return { error: 'Indica il farmaco.' };
  await db.medication.create({
    data: {
      patientId, name,
      dosage: String(f.get('dosage') ?? '').trim() || null,
      frequency: String(f.get('frequency') ?? '').trim() || null,
      startedAt: f.get('startedAt') ? new Date(String(f.get('startedAt'))) : null,
      active: true,
    },
  });
  return done(session, patientId, 'Medication', 'Farmaco registrato.');
}

export async function stopMedicationAction(id: string, reason: string): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'CAREGIVER', 'DOCTOR']);
  const med = await db.medication.findUnique({ where: { id } });
  if (!med) return { error: 'Farmaco non trovato.' };
  await assertDoctorPatientAccess(session, med.patientId);
  await db.medication.update({ where: { id }, data: { active: false, stoppedAt: new Date(), stopReason: reason || null } });
  return done(session, med.patientId, 'Medication', 'Farmaco segnato come sospeso.');
}

export async function addSurgeryAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { session, patientId } = await ctx(f);
  const name = String(f.get('name') ?? '').trim();
  if (!name) return { error: 'Indica l’intervento.' };
  await db.surgery.create({
    data: { patientId, name, date: f.get('date') ? new Date(String(f.get('date'))) : null, hospital: String(f.get('hospital') ?? '').trim() || null },
  });
  return done(session, patientId, 'Surgery', 'Intervento registrato.');
}

export async function addVaccinationAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { session, patientId } = await ctx(f);
  const name = String(f.get('name') ?? '').trim();
  if (!name) return { error: 'Indica il vaccino.' };
  await db.vaccination.create({ data: { patientId, name, date: f.get('date') ? new Date(String(f.get('date'))) : null } });
  return done(session, patientId, 'Vaccination', 'Vaccinazione registrata.');
}

export async function addFamilyHistoryAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { session, patientId } = await ctx(f);
  const relation = String(f.get('relation') ?? '').trim();
  const condition = String(f.get('condition') ?? '').trim();
  if (!relation || !condition) return { error: 'Indica parente e condizione.' };
  await db.familyHistory.create({ data: { patientId, relation, condition } });
  return done(session, patientId, 'FamilyHistory', 'Familiarità registrata.');
}

export async function saveLifestyleAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { session, patientId } = await ctx(f);
  const data = {
    smoking: String(f.get('smoking') ?? '') || null,
    alcohol: String(f.get('alcohol') ?? '') || null,
    physicalActivity: String(f.get('physicalActivity') ?? '') || null,
    diet: String(f.get('diet') ?? '').trim() || null,
  };
  await db.lifestyle.upsert({ where: { patientId }, update: data, create: { patientId, ...data } });
  return done(session, patientId, 'Lifestyle', 'Stile di vita aggiornato.');
}

export async function addVitalAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { session, patientId } = await ctx(f);
  const type = String(f.get('type') ?? '');
  const value = parseFloat(String(f.get('value') ?? '').replace(',', '.'));
  const value2raw = String(f.get('value2') ?? '');
  if (!type || isNaN(value)) return { error: 'Indica tipo e valore della misurazione.' };
  const units: Record<string, string> = { PESO: 'kg', PRESSIONE: 'mmHg', GLICEMIA: 'mg/dL', SPO2: '%', FC: 'bpm', TEMPERATURA: '°C', ALTEZZA: 'cm' };
  await db.vitalMeasurement.create({
    data: {
      patientId, type, value,
      value2: value2raw ? parseFloat(value2raw.replace(',', '.')) : null,
      unit: units[type] ?? '',
      measuredAt: f.get('measuredAt') ? new Date(String(f.get('measuredAt'))) : new Date(),
    },
  });
  await db.timelineEvent.create({
    data: {
      patientId, type: 'MISURAZIONE', date: new Date(),
      title: `Misurazione: ${type.toLowerCase()}`, summary: `${value}${value2raw ? '/' + value2raw : ''} ${units[type] ?? ''}`,
    },
  });
  return done(session, patientId, 'VitalMeasurement', 'Misurazione registrata.');
}

export async function savePregnancyAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { session, patientId } = await ctx(f);
  const isPregnant = f.get('isPregnant') === 'on';
  const isBreastfeeding = f.get('isBreastfeeding') === 'on';
  const dueDate = f.get('dueDate') ? new Date(String(f.get('dueDate'))) : null;
  await db.pregnancyStatus.upsert({
    where: { patientId },
    update: { isPregnant, isBreastfeeding, dueDate, confirmedAt: new Date(), needsUpdate: false },
    create: { patientId, isPregnant, isBreastfeeding, dueDate, confirmedAt: new Date() },
  });
  return done(session, patientId, 'PregnancyStatus', 'Stato aggiornato. Ti chiederemo di riconfermarlo periodicamente: è un dato critico per la sicurezza delle terapie.');
}

export async function deleteDiaryItemAction(kind: string, id: string): Promise<ActionState> {
  const session = await requireSession(['PATIENT', 'CAREGIVER']);
  const tables: Record<string, any> = {
    condition: db.condition, allergy: db.allergy, medication: db.medication,
    surgery: db.surgery, vaccination: db.vaccination, familyHistory: db.familyHistory, vital: db.vitalMeasurement,
  };
  const table = tables[kind];
  if (!table) return { error: 'Elemento non valido.' };
  const item = await table.findUnique({ where: { id } });
  if (!item) return { error: 'Elemento non trovato.' };
  await assertDoctorPatientAccess(session, item.patientId);
  await table.delete({ where: { id } });
  await recomputeCompleteness(item.patientId);
  revalidatePath('/paziente/diario');
  return { success: 'Elemento eliminato.' };
}

export async function updateProfileAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const session = await requireSession(['PATIENT']);
  const patientId = session.patientId!;
  const { encryptField } = await import('@/lib/crypto');
  await db.patientProfile.update({
    where: { id: patientId },
    data: {
      addressStreet: String(f.get('addressStreet') ?? '').trim() || null,
      addressCity: String(f.get('addressCity') ?? '').trim() || null,
      addressProvince: String(f.get('addressProvince') ?? '').trim() || null,
      addressZip: String(f.get('addressZip') ?? '').trim() || null,
      gpName: String(f.get('gpName') ?? '').trim() || null,
      asl: String(f.get('asl') ?? '').trim() || null,
      insurance: String(f.get('insurance') ?? '').trim() || null,
      ...(String(f.get('emergencyName') ?? '').trim() ? { emergencyNameEnc: encryptField(String(f.get('emergencyName')).trim()) } : {}),
      ...(String(f.get('emergencyPhone') ?? '').trim() ? { emergencyPhoneEnc: encryptField(String(f.get('emergencyPhone')).trim()) } : {}),
      onboardingStep: Math.max(parseInt(String(f.get('onboardingStep') ?? '0'), 10) || 0, 0),
    },
  });
  await recomputeCompleteness(patientId);
  revalidatePath('/paziente');
  return { success: 'Profilo aggiornato.' };
}
