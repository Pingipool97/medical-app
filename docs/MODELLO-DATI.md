# Modello dati — panoramica

Fonte di verità: `prisma/schema.prisma` (47 modelli). SQLite in sviluppo, PostgreSQL in
produzione (stesso schema). Gli stati sono `String` con costanti in `src/lib/constants.ts`
(SQLite non supporta gli enum Prisma). Campi con suffisso `Enc` = cifrati AES-256-GCM.

## Identità e ruoli
- **User** — credenziali, ruolo (PATIENT/DOCTOR/STAFF/ADMIN/CAREGIVER), stato, 2FA (segreto cifrato), lockout, telefono cifrato.
- **PatientProfile** — anagrafica completa; CF cifrato + hash deterministico per lookup/deduplica; contatto d'emergenza cifrato; `profileCompleteness` (parametro di affidabilità per l'IA); `onboardingStep`.
- **DoctorProfile** — Ordine+provincia, specializzazioni (M2M via DoctorSpecialization), sedi, `verificationStatus` (PENDING/VERIFIED/REJECTED: un medico non verificato non emette nulla), `responseTimeHours` dichiarato.
- **StaffProfile / StaffDelegation** — segreteria legata a un medico; accesso clinico SOLO con delega esplicita (scope, scadenza, revoca).
- **CaregiverDelegation** — delega a un altro utente su un paziente (relazione, ambito, scadenza, revoca).
- **DoctorPatientLink** — collegamento a doppio consenso (PENDING/ACTIVE/REVOKED/ENDED); nessun accesso senza ACTIVE.

## Diario sanitario
**Condition, Allergy, Medication** (attivo/sospeso con motivo), **Surgery, Vaccination,
FamilyHistory, Lifestyle, VitalMeasurement** (tipo/valore/unità/data, `value2` per la
pressione), **PregnancyStatus** (stato a scadenza con `needsUpdate`, non flag perenne).

## Documentale
- **Document** — proprietà del paziente; tipo/specializzazione da anagrafiche; file cifrato su disco (`filePath`), `sha256` per deduplica; `status` (UPLOADED→PROCESSING→PROCESSED / FAILED / NEEDS_REVIEW), `extractionQuality`, testo estratto, `extractedData` JSON, quarantena intestatario (`thirdPartyFound`), `duplicateOfId`, `dateConfirmed`.
- **DocumentShare** — visibilità per-medico (regola "default privato"); `doctorCopyRetained` = copia giuridica del medico che sopravvive a revoca/cancellazione (obbligo di conservazione).
- **ProcessingJob** — coda con tentativi, `stepsLog` JSON visibile all'utente, retry.
- **LabAnalyte** (anagrafica admin: unità, range, alias per il matching) / **LabResult** — valore, range, `outOfRange`, `implausible` (quarantena), `confidence`, `humanConfirmed` (i grafici distinguono i punti non confermati).
- **ClinicalProblem / TimelineEvent** — vista per problema e cronologia unica (indice per paziente+data).

## IA
- **AiFunctionConfig** — per funzione: on/off, modello, temperatura, maxTokens, `isCds` (perimetro dispositivo medico).
- **PromptTemplate** — prompt di sistema versionati, una sola versione attiva per funzione.
- **AiJob** — tracciabilità completa: funzione, modello, versione prompt, token, costo, richiedente, esito (DONE/ERROR/BLOCKED_GUARDRAIL/BLOCKED_BUDGET/FALLBACK).
- **AiOutput** — flusso bozza: DRAFT→REVIEWED→PUBLISHED / REJECTED / EXPIRED; `sources` JSON (citazioni per affermazione), `coverageNote`, `insufficientData`, revisore e date; `expiresAt` (le bozze scadono).
- **AiChatMessage** — chat clinica del medico con fonti.
- **DrugInteractionRule / DrugContraindication** — banca dati del motore deterministico interazioni (anagrafiche admin).

## Comunicazione
- **ServiceRequest** — richiesta con stato (NUOVA→PRESA_IN_CARICO→ATTESA_INFO→EVASA/RIFIUTATA/ANNULLATA), tipo da anagrafica con SLA, `redFlag`, motivo rifiuto obbligatorio, `history` JSON delle transizioni.
- **Conversation / Message** — chat medico-paziente, allegati (id documento), `redFlag`, ricevute di lettura.
- **IssuedDocument** — documenti emessi dal medico (ricetta bianca, promemoria NRE, richiesta esami, certificato non-INPS, piano, referto, istruzioni, comunicazione) con stato firma onesto (NON_FIRMATO/FIRMATO_FEA/FEQ), hash di integrità, letto/non letto, link alla richiesta evasa.
- **Notification / NotificationRule / MessageTemplate** — notifiche multi-canale con matrice eventi→canali configurata dall'admin e template versionati; i canali esterni senza provider accodano (PENDING).

## Agenda
**ServiceCatalog** (prestazioni con durata/prezzo/modalità), **Availability** (fasce
settimanali) + **AvailabilityException** (chiusure/ferie), **Appointment** (stato,
questionario pre-visita JSON, note del medico → referto, `videoRoomId` solo con provider),
**WaitlistEntry** (lista d'attesa con notifica).

## Amministrazione e conformità
- **ProviderConfig** — chiavi cifrate, mai esposte; esito ultimo test di connessione.
- **SystemSetting / FeatureFlag** — configurazione runtime; `isCdsGate` marca i flag regolatori.
- **Specialization / DocumentTypeDef / RequestTypeDef** — anagrafiche di sistema.
- **ConsentVersion / ConsentRecord** — informative versionate e accettazioni (con revoca e IP).
- **AuditLog** — chi/cosa/quando/da dove per ogni evento rilevante; `patientId` popola il log "chi ha visto i miei dati" del paziente; indici per paziente e attore.
