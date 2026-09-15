import 'server-only';
import { db } from './db';
import { PATIENT_COLORS, autoPatientColor } from './constants';

// Helper d'agenda usati dai server component.
// Stanno qui e non in app/actions/agenda.ts perché quello è un modulo 'use server':
// ogni suo export diventa un endpoint raggiungibile dal client, e una funzione che
// accetta un doctorId e scrive sul DB non deve essere chiamabile da fuori.

type Colorable = { id: string; color: string | null };

const PALETTE = PATIENT_COLORS.filter((c) => c.key !== 'slate').map((c) => c.key);

/**
 * Assegna un colore a ciò che non ne ha ancora uno, preferendo tinte non ancora usate.
 *
 * Prende in ingresso le righe **già caricate** dalla pagina invece di rileggerle: con il
 * database a ~200 ms di distanza, due `count` fatti solo per chiedere "manca qualcosa?"
 * costavano quasi mezzo secondo a ogni apertura dell'agenda, quasi sempre per sentirsi
 * rispondere di no. Se sono tutti colorati non parte nessuna query.
 */
async function assignColors(rows: Colorable[], write: (id: string, color: string) => Promise<unknown>): Promise<void> {
  const missing = rows.filter((r) => !r.color);
  if (missing.length === 0) return;

  const used = new Set(rows.map((r) => r.color).filter(Boolean) as string[]);
  const updates: Promise<unknown>[] = [];
  for (const row of missing) {
    // Prima un colore ancora libero; esauriti quelli, uno derivato dall'id — stabile,
    // così la stessa riga non cambia tinta a ogni ricarica.
    const next = PALETTE.find((c) => !used.has(c)) ?? autoPatientColor(row.id);
    used.add(next);
    row.color = next; // la pagina usa l'oggetto subito, senza rileggere
    updates.push(write(row.id, next));
  }
  await Promise.all(updates);
}

/** Colori delle prestazioni: è la modalità di colorazione predefinita del calendario. */
export function ensureServiceColors(services: Colorable[]): Promise<void> {
  return assignColors(services, (id, color) =>
    db.serviceCatalog.update({ where: { id }, data: { color } }),
  );
}

/** Colori con cui il professionista distingue i pazienti in agenda. */
export function ensurePatientColors(links: Colorable[]): Promise<void> {
  return assignColors(links, (id, color) =>
    db.doctorPatientLink.update({ where: { id }, data: { color } }),
  );
}
