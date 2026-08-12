import 'server-only';
import { db } from './db';

// Completezza del profilo: non gamification ma parametro di affidabilità.
// Viene mostrato accanto a ogni analisi IA ("basato su profilo completo al X%").
export async function recomputeCompleteness(patientId: string): Promise<number> {
  const p = await db.patientProfile.findUnique({
    where: { id: patientId },
    include: {
      conditions: true, allergies: true, medications: true, surgeries: true,
      vaccinations: true, familyHistory: true, lifestyle: true, vitals: true, pregnancy: true,
    },
  });
  if (!p) return 0;
  let score = 0;
  const add = (cond: boolean, pts: number) => { if (cond) score += pts; };
  add(!!p.addressCity, 8);
  add(!!p.gpName, 6);
  add(!!p.emergencyPhoneEnc, 8);
  add(!!p.asl || !!p.healthCardEnc, 4);
  // Sezioni cliniche: contano anche le dichiarazioni esplicite di "niente da segnalare"
  // (gestite come record con nome NESSUNA), perché assenza di dato ≠ dato negativo.
  add(p.conditions.length > 0, 12);
  add(p.allergies.length > 0, 14);
  add(p.medications.length > 0, 14);
  add(p.surgeries.length > 0, 6);
  add(p.vaccinations.length > 0, 6);
  add(p.familyHistory.length > 0, 6);
  add(!!p.lifestyle, 8);
  add(p.vitals.length > 0, 6);
  add(p.biologicalSex === 'M' || !!p.pregnancy, 2);
  const final = Math.min(100, score);
  await db.patientProfile.update({ where: { id: patientId }, data: { profileCompleteness: final } });
  return final;
}
