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

// ─────────────────────────── Abbonamenti ───────────────────────────

export const PLANS = { FREE: 'FREE', PREMIUM: 'PREMIUM' } as const;
export type Plan = (typeof PLANS)[keyof typeof PLANS];

export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Attivo',
  EXPIRED: 'Scaduto',
  CANCELLED: 'Disdetto',
  PENDING_PAYMENT: 'In attesa di pagamento',
};

export const SUBSCRIPTION_EVENT_LABEL: Record<string, string> = {
  CREATED: 'Creato',
  ACTIVATED: 'Attivato',
  RENEWED: 'Rinnovato',
  EXPIRED: 'Scaduto',
  CANCELLED: 'Disdetto',
  REACTIVATED: 'Riattivato',
};

// Prezzo del piano premium paziente: 8,99 € / anno.
export const PREMIUM_PRICE_CENTS = 899;
export const PREMIUM_PERIOD_DAYS = 365;

// Funzioni IA riservate al piano premium del paziente. Il professionista non è
// soggetto a questo elenco: per lui vale DoctorProfile.aiIncluded.
export const PREMIUM_AI_FUNCTIONS: string[] = [
  'assistente_paziente',
  'prep_visita_paziente',
  'riassunto_referto_paziente',
];

export const PREMIUM_BENEFITS: { title: string; desc: string }[] = [
  { title: 'Assistente IA illimitato', desc: 'Chiedi cosa significano i termini dei tuoi referti, in linguaggio semplice, quando vuoi.' },
  { title: 'Spiegazioni dei referti', desc: 'Ogni referto caricato ti viene spiegato in parole comprensibili, con i valori fuori range evidenziati.' },
  { title: 'Preparazione alla visita', desc: 'Prima di ogni appuntamento ricevi le domande utili da portare al tuo professionista.' },
  { title: 'Tutto il resto resta gratis', desc: 'Documenti, timeline, diario, agenda, messaggi e richieste non cambiano: nessuna funzione ti viene tolta.' },
];

// ─────────────────────────── Agenda / calendario ───────────────────────────

export const CALENDAR_VIEWS = ['day', 'week', 'month'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const CALENDAR_VIEW_LABEL: Record<CalendarView, string> = {
  day: 'Giorno',
  week: 'Settimana',
  month: 'Mese',
};

export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
export const WEEKDAY_LONG = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
export const MONTH_LONG = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

// Colori con cui il professionista distingue i pazienti in agenda.
// Classi Tailwind esplicite (non stringhe costruite a runtime): il compilatore di
// Tailwind analizza il sorgente staticamente e `bg-${x}-500` non verrebbe generato.
export const PATIENT_COLORS: {
  key: string;
  label: string;
  dot: string;
  chip: string;
  bar: string;
  ring: string;
}[] = [
  { key: 'indigo', label: 'Indaco', dot: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-900 border-indigo-200', bar: 'bg-indigo-500', ring: 'ring-indigo-400' },
  { key: 'teal', label: 'Verde acqua', dot: 'bg-teal-500', chip: 'bg-teal-50 text-teal-900 border-teal-200', bar: 'bg-teal-500', ring: 'ring-teal-400' },
  { key: 'amber', label: 'Ambra', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-900 border-amber-200', bar: 'bg-amber-500', ring: 'ring-amber-400' },
  { key: 'rose', label: 'Rosa', dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-900 border-rose-200', bar: 'bg-rose-500', ring: 'ring-rose-400' },
  { key: 'sky', label: 'Azzurro', dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-900 border-sky-200', bar: 'bg-sky-500', ring: 'ring-sky-400' },
  { key: 'violet', label: 'Viola', dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-900 border-violet-200', bar: 'bg-violet-500', ring: 'ring-violet-400' },
  { key: 'lime', label: 'Lime', dot: 'bg-lime-600', chip: 'bg-lime-50 text-lime-900 border-lime-200', bar: 'bg-lime-600', ring: 'ring-lime-400' },
  { key: 'orange', label: 'Arancio', dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-900 border-orange-200', bar: 'bg-orange-500', ring: 'ring-orange-400' },
  { key: 'cyan', label: 'Ciano', dot: 'bg-cyan-500', chip: 'bg-cyan-50 text-cyan-900 border-cyan-200', bar: 'bg-cyan-500', ring: 'ring-cyan-400' },
  { key: 'fuchsia', label: 'Fucsia', dot: 'bg-fuchsia-500', chip: 'bg-fuchsia-50 text-fuchsia-900 border-fuchsia-200', bar: 'bg-fuchsia-500', ring: 'ring-fuchsia-400' },
  { key: 'slate', label: 'Grigio', dot: 'bg-slate-400', chip: 'bg-slate-50 text-slate-700 border-slate-200', bar: 'bg-slate-400', ring: 'ring-slate-400' },
];

export const DEFAULT_PATIENT_COLOR = 'indigo';

export function patientColor(key?: string | null) {
  return PATIENT_COLORS.find((c) => c.key === key) ?? PATIENT_COLORS[0];
}

/** Colore stabile derivato dall'id, per i collegamenti che non ne hanno ancora uno scelto. */
export function autoPatientColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PATIENT_COLORS[h % PATIENT_COLORS.length].key;
}

// Quante ore prima far scattare il promemoria appuntamento (scelta dell'utente).
export const REMINDER_HOURS_OPTIONS = [1, 2, 3, 6, 12, 24, 48] as const;
export const DEFAULT_REMINDER_HOURS = 24;

// Come colorare gli appuntamenti in agenda. Il default è per prestazione: con molti
// pazienti il colore per persona si ripete e smette di dire qualcosa, il tipo di
// prestazione invece resta leggibile a colpo d'occhio.
export const COLOR_MODES = ['service', 'patient', 'status'] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export const COLOR_MODE_LABEL: Record<ColorMode, string> = {
  service: 'Prestazione',
  patient: 'Paziente',
  status: 'Stato',
};

// Colore per stato: verde = confermato, ambra = da confermare, grigio = chiuso, rosso = problema.
export const STATUS_COLOR: Record<string, string> = {
  PRENOTATO: 'amber',
  CONFERMATO: 'teal',
  COMPLETATO: 'sky',
  ANNULLATO: 'slate',
  NO_SHOW: 'rose',
};
