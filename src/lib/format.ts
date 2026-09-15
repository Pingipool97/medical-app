// Utility di formattazione (usabili anche lato client)
//
// Il fuso è sempre esplicito: senza `timeZone` il server (Vercel = UTC) e il browser
// dell'utente formatterebbero lo stesso istante in modo diverso, e le date serali
// slitterebbero al giorno prima nell'HTML generato lato server.

import { APP_TIMEZONE } from './datetime';

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('it-IT', { timeZone: APP_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('it-IT', { timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit' });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return fmtDate(date) + ' ' + fmtTime(date);
}

/** Estremi di iscrizione all'albo, o null per le professioni che non ne hanno uno. */
export function fmtOrdine(number?: string | null, province?: string | null): string | null {
  if (!number && !province) return null;
  if (number && province) return `Ordine di ${province} — n. ${number}`;
  return number ? `Iscrizione n. ${number}` : `Ordine di ${province}`;
}

export function fmtEuro(cents: number): string {
  return (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function ageFrom(birth: Date | string): number {
  const b = typeof birth === 'string' ? new Date(birth) : birth;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}
