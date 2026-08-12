// Utility di formattazione (usabili anche lato client)

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
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
