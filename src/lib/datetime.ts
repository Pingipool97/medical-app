// Fuso orario applicativo: l'app è italiana, gli orari che utenti e medici vedono e
// inseriscono sono sempre ora locale italiana. Il server invece può girare ovunque
// (Vercel = UTC): senza conversione esplicita un appuntamento "alle 15:00" verrebbe
// salvato alle 15:00 UTC, cioè le 17:00 italiane d'estate.
// Nel DB si continua a salvare l'istante assoluto (UTC, come fa Prisma): qui ci sono
// solo le conversioni da/verso l'orario "da muro" italiano. Nessuna dipendenza esterna:
// l'offset — DST incluso — lo calcola Intl dal database IANA del runtime.

export const APP_TIMEZONE = 'Europe/Rome';

const PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function zonedParts(date: Date): Parts {
  const raw: Record<string, string> = {};
  for (const p of PARTS_FORMATTER.formatToParts(date)) {
    if (p.type !== 'literal') raw[p.type] = p.value;
  }
  return {
    year: Number(raw.year),
    month: Number(raw.month),
    day: Number(raw.day),
    // hourCycle h23 può restituire "24" a mezzanotte su alcuni runtime
    hour: Number(raw.hour) % 24,
    minute: Number(raw.minute),
    second: Number(raw.second),
  };
}

/** Scarto in minuti fra il fuso applicativo e UTC nell'istante dato (positivo = avanti su UTC). */
function offsetMinutes(date: Date): number {
  const p = zonedParts(date);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return (asIfUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}

/**
 * Da orario "da muro" italiano a istante assoluto.
 * `fromZoned('2026-09-15', '15:00')` → le 15:00 italiane, qualunque sia il fuso del server.
 */
export function fromZoned(dateISO: string, time = '00:00'): Date {
  const [y, m, d] = dateISO.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const naive = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  // Prima stima con l'offset dell'istante "ingenuo", poi una correzione: a cavallo
  // del cambio d'ora l'offset dell'istante reale può differire da quello stimato.
  const first = offsetMinutes(new Date(naive));
  let ts = naive - first * 60000;
  const second = offsetMinutes(new Date(ts));
  if (second !== first) ts = naive - second * 60000;
  return new Date(ts);
}

/** Chiave giorno "YYYY-MM-DD" nel fuso applicativo (NON usare toISOString: è UTC). */
export function dateKey(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Orario "HH:MM" nel fuso applicativo. */
export function timeKey(date: Date): string {
  const p = zonedParts(date);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Minuti trascorsi dalla mezzanotte italiana: è la coordinata Y della griglia calendario. */
export function minutesOfDay(date: Date): number {
  const p = zonedParts(date);
  return p.hour * 60 + p.minute;
}

/** Giorno della settimana italiano, 0 = domenica (stessa convenzione di Availability.weekday). */
export function weekdayOf(date: Date): number {
  const p = zonedParts(date);
  // Date.UTC su una data "da muro" dà il giorno giusto senza slittamenti di fuso
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

/** Mezzanotte italiana del giorno in cui cade l'istante dato. */
export function startOfDay(date: Date): Date {
  return fromZoned(dateKey(date), '00:00');
}

/** Mezzanotte italiana di N giorni dopo (N negativo = prima). Attraversa il DST correttamente. */
export function addDays(date: Date, days: number): Date {
  const p = zonedParts(date);
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  const key = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
  return fromZoned(key, timeKey(date));
}

/** Chiave giorno spostata di N giorni, senza passare per gli istanti. */
export function shiftDateKey(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/** Lunedì (italiano) della settimana che contiene la data. */
export function startOfWeek(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domenica
  return shiftDateKey(dateISO, dow === 0 ? -6 : 1 - dow);
}

/** Primo giorno del mese della data. */
export function startOfMonth(dateISO: string): string {
  return `${dateISO.slice(0, 7)}-01`;
}

/** Aggiunge N mesi a una chiave giorno, troncando il giorno se il mese è più corto. */
export function shiftMonthKey(dateISO: string, months: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Chiave giorno di "oggi" in Italia. */
export function todayKey(): string {
  return dateKey(new Date());
}

/** Somma minuti a "HH:MM" restituendo "HH:MM" (nessun wrap oltre le 24h). */
export function addMinutesToTime(time: string, minutes: number): string {
  const [hh, mm] = time.split(':').map(Number);
  const total = hh * 60 + mm + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** "HH:MM" → minuti dalla mezzanotte. */
export function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + mm;
}
