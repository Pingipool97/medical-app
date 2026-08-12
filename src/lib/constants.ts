// Costanti applicative (SQLite non supporta gli enum Prisma)

export const ROLES = {
  PATIENT: 'PATIENT',
  DOCTOR: 'DOCTOR',
  STAFF: 'STAFF',
  ADMIN: 'ADMIN',
  CAREGIVER: 'CAREGIVER',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const REQUEST_STATUS = ['NUOVA', 'PRESA_IN_CARICO', 'ATTESA_INFO', 'EVASA', 'RIFIUTATA', 'ANNULLATA'] as const;
export const REQUEST_STATUS_LABEL: Record<string, string> = {
  NUOVA: 'Nuova',
  PRESA_IN_CARICO: 'Presa in carico',
  ATTESA_INFO: 'In attesa di informazioni',
  EVASA: 'Evasa',
  RIFIUTATA: 'Rifiutata',
  ANNULLATA: 'Annullata',
};

export const DOC_STATUS_LABEL: Record<string, string> = {
  UPLOADED: 'Caricato, in coda',
  PROCESSING: 'In elaborazione',
  PROCESSED: 'Elaborato',
  FAILED: 'Elaborazione fallita',
  QUARANTINED: 'In quarantena — verifica richiesta',
  NEEDS_REVIEW: 'Da verificare',
};

export const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  PRENOTATO: 'Prenotato',
  CONFERMATO: 'Confermato',
  ANNULLATO: 'Annullato',
  COMPLETATO: 'Completato',
  NO_SHOW: 'Non presentato',
};

export const AI_OUTPUT_STATE_LABEL: Record<string, string> = {
  DRAFT: 'Bozza IA — da revisionare',
  REVIEWED: 'Revisionata dal medico',
  PUBLISHED: 'Pubblicata al paziente',
  REJECTED: 'Scartata',
  EXPIRED: 'Scaduta senza revisione',
};

// Funzioni IA. isCds = perimetro "supporto decisionale clinico" (potenziale dispositivo medico MDR):
// disattivate di default, dietro feature flag con conferma regolatoria esplicita.
export const AI_FUNCTIONS: { key: string; label: string; isCds: boolean; audience: 'DOCTOR' | 'PATIENT' }[] = [
  { key: 'riassunto_referto_medico', label: 'Riassunto referto (versione tecnica per il medico)', isCds: false, audience: 'DOCTOR' },
  { key: 'riassunto_referto_paziente', label: 'Riassunto referto (versione divulgativa per il paziente)', isCds: false, audience: 'PATIENT' },
  { key: 'sintesi_paziente', label: 'Sintesi complessiva del paziente', isCds: false, audience: 'DOCTOR' },
  { key: 'suggerimenti_clinici', label: 'Suggerimenti clinici per il medico (CDS)', isCds: true, audience: 'DOCTOR' },
  { key: 'chat_clinica', label: 'Chat clinica per il medico', isCds: false, audience: 'DOCTOR' },
  { key: 'interazioni_farmaci', label: 'Controllo interazioni farmacologiche e allergie (CDS)', isCds: true, audience: 'DOCTOR' },
  { key: 'prep_visita_medico', label: 'Briefing pre-visita per il medico', isCds: false, audience: 'DOCTOR' },
  { key: 'prep_visita_paziente', label: 'Domande utili pre-visita per il paziente', isCds: false, audience: 'PATIENT' },
  { key: 'assistente_paziente', label: 'Assistente paziente (glossario e orientamento)', isCds: false, audience: 'PATIENT' },
  { key: 'ocr_cleanup', label: 'Pulizia e strutturazione testo OCR', isCds: false, audience: 'DOCTOR' },
];

export const MEDICAL_DISCLAIMER =
  'Contenuto generato da un sistema di intelligenza artificiale a supporto del medico. Non costituisce diagnosi né prescrizione. Ogni decisione clinica spetta esclusivamente al medico.';

export const PATIENT_DISCLAIMER =
  'Questa spiegazione ha solo scopo informativo e non sostituisce il parere del tuo medico. Per qualsiasi dubbio sulla tua salute rivolgiti al tuo medico.';

export const NO_EMERGENCY_NOTICE =
  'Questa piattaforma NON è un canale di emergenza. In caso di sintomi gravi o improvvisi chiama subito il 112 / 118.';

export const FEATURE_FLAGS = {
  CDS_SUGGERIMENTI: 'cds_suggerimenti_clinici',
  CDS_INTERAZIONI: 'cds_interazioni_farmaci',
  RECENSIONI: 'recensioni_pubbliche',
  PAGAMENTI: 'pagamenti_online',
  VIDEOCONSULTO: 'videoconsulto',
  MANUTENZIONE: 'modalita_manutenzione',
  REGISTRAZIONI_APERTE: 'registrazioni_aperte',
} as const;

export const NOTIFICATION_EVENTS: { key: string; label: string }[] = [
  { key: 'documento_condiviso', label: 'Documento condiviso con il medico' },
  { key: 'documento_emesso', label: 'Nuovo documento dal medico' },
  { key: 'documento_elaborato', label: 'Documento elaborato' },
  { key: 'richiesta_nuova', label: 'Nuova richiesta dal paziente' },
  { key: 'richiesta_aggiornata', label: 'Aggiornamento stato richiesta' },
  { key: 'messaggio_nuovo', label: 'Nuovo messaggio' },
  { key: 'appuntamento_prenotato', label: 'Appuntamento prenotato' },
  { key: 'appuntamento_promemoria', label: 'Promemoria appuntamento' },
  { key: 'appuntamento_annullato', label: 'Appuntamento annullato' },
  { key: 'collegamento_richiesto', label: 'Richiesta di collegamento medico-paziente' },
  { key: 'collegamento_attivo', label: 'Collegamento attivato' },
  { key: 'bozza_ia_in_attesa', label: 'Bozza IA in attesa di revisione' },
  { key: 'slot_liberato', label: 'Slot liberato (lista d’attesa)' },
  { key: 'red_flag', label: 'Messaggio con sintomi d’allarme' },
];

// Tipi di documento emettibili dal medico (validati da issueDocumentAction).
// Qui e non in actions/issued.ts: un modulo 'use server' può esportare solo funzioni async.
export const ISSUED_KINDS: { value: string; label: string }[] = [
  { value: 'RICETTA_BIANCA', label: 'Ricetta bianca (privata)' },
  { value: 'PROMEMORIA_NRE', label: 'Promemoria ricetta dematerializzata (NRE emesso via Sistema TS)' },
  { value: 'RICHIESTA_ESAMI', label: 'Richiesta di esami / visita' },
  { value: 'CERTIFICATO', label: 'Certificato (non INPS)' },
  { value: 'PIANO_TERAPEUTICO', label: 'Piano terapeutico' },
  { value: 'REFERTO_VISITA', label: 'Referto di visita' },
  { value: 'ISTRUZIONI', label: 'Istruzioni / materiale informativo' },
  { value: 'COMUNICAZIONE', label: 'Comunicazione di studio' },
];

// Costi indicativi per stima spesa (per 1M token, in centesimi di euro) — configurabili da admin
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-fable-5': { input: 500, output: 2500 },
  'claude-opus-5': { input: 1500, output: 7500 },
  'claude-sonnet-5': { input: 300, output: 1500 },
  'claude-haiku-4-5-20251001': { input: 100, output: 500 },
};
