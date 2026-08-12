// Rendering dei template comunicazioni con variabili {{nome}}, {{link}}, …
// Modulo condiviso tra server action (invio test) e anteprima client: nessuna dipendenza server-only.

export const SAMPLE_VARS: Record<string, string> = {
  nome: 'Mario Rossi',
  link: 'https://cartella-intelligente.example/accedi',
  titolo: 'Referto visita cardiologica',
  data: '15/09/2026',
  ora: '10:30',
  medico: 'Dr.ssa Anna Bianchi',
  modalita: 'In presenza',
  studio: 'Studio Medico Bianchi',
  ordine: 'OMCeO Milano n. 12345',
  indirizzo: 'Via Roma 10, 20121 Milano',
};

export function renderTemplate(text: string, vars: Record<string, string> = SAMPLE_VARS): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);
}
