import 'server-only';
import { db } from './db';
import { PATIENT_COLORS, autoPatientColor } from './constants';

// Helper d'agenda usati dai server component.
// Stanno qui e non in app/actions/agenda.ts perché quello è un modulo 'use server':
// ogni suo export diventa un endpoint raggiungibile dal client, e una funzione che
// accetta un doctorId e scrive sul DB non deve essere chiamabile da fuori.

/**
 * Assegna un colore alle prestazioni che non ne hanno ancora uno. È la modalità di
 * colorazione predefinita dell'agenda, quindi va popolata prima di disegnare.
 */
export async function ensureServiceColors(doctorId: string): Promise<void> {
  const missing = await db.serviceCatalog.count({ where: { doctorId, color: null } });
  if (missing === 0) return;

  const services = await db.serviceCatalog.findMany({
    where: { doctorId },
    select: { id: true, name: true, color: true },
    orderBy: { name: 'asc' },
  });
  const used = new Set(services.map((s) => s.color).filter(Boolean) as string[]);
  for (const svc of services) {
    if (svc.color) continue;
    const next = PATIENT_COLORS.filter((c) => c.key !== 'slate').find((c) => !used.has(c.key))?.key ?? autoPatientColor(svc.id);
    used.add(next);
    await db.serviceCatalog.update({ where: { id: svc.id }, data: { color: next } });
  }
}

/**
 * Assegna un colore ai collegamenti medico-paziente che non ne hanno ancora uno,
 * preferendo tinte non ancora usate da quel professionista. Idempotente: se sono già
 * tutti colorati non tocca il database.
 */
export async function ensurePatientColors(doctorId: string): Promise<void> {
  const missing = await db.doctorPatientLink.count({ where: { doctorId, status: 'ACTIVE', color: null } });
  if (missing === 0) return;

  const links = await db.doctorPatientLink.findMany({
    where: { doctorId, status: 'ACTIVE' },
    select: { id: true, patientId: true, color: true },
    orderBy: { createdAt: 'asc' },
  });
  const used = new Set(links.map((l) => l.color).filter(Boolean) as string[]);
  for (const l of links) {
    if (l.color) continue;
    // Prima un colore ancora libero; esauriti quelli, uno derivato dall'id — stabile,
    // così lo stesso paziente non cambia tinta a ogni ricarica.
    const next = PATIENT_COLORS.filter((c) => c.key !== 'slate').find((c) => !used.has(c.key))?.key ?? autoPatientColor(l.patientId);
    used.add(next);
    await db.doctorPatientLink.update({ where: { id: l.id }, data: { color: next } });
  }
}
