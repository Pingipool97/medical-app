# Roadmap a fasi

## MVP (implementato in questo repository)

**Perimetro: strumento documentale e organizzativo** (fuori dal perimetro dispositivo medico).

- Autenticazione con ruoli (paziente, medico, segreteria, caregiver, admin), 2FA per medici/admin, verifica identità professionale dei medici.
- Anagrafica paziente completa con validazione CF e onboarding progressivo; Diario Sanitario (patologie, allergie, farmaci, interventi, vaccinazioni, familiarità, stile di vita, misurazioni con grafici, gravidanza a scadenza).
- Documentale: upload PDF/foto, pipeline asincrona con stati visibili e retry, deduplica, quarantena intestatario, estrazione testo PDF nativi, estrazione valori di laboratorio su anagrafica analiti, conferma umana dei valori.
- Timeline con filtri, ricerca, evidenza fuori-range, versione stampabile, export dati.
- Collegamenti medico-paziente a doppio consenso con revoca; condivisione documenti per scope (default privato); log accessi consultabile dal paziente.
- Comunicazione: richieste con stato e SLA, messaggistica, screening sintomi d'allarme con rimando 112, emissione documenti dal medico (ricetta bianca, promemoria NRE, certificati non-INPS, piani, referti) con stato firma onesto.
- IA (con provider configurato): riassunti referto (tecnico/divulgativo), sintesi longitudinale, briefing pre-visita, chat clinica con fonti, assistente paziente con guardrail — tutto con flusso bozza → revisione medico → pubblicazione, pseudonimizzazione, tracciabilità completa, tetti di spesa, fallback deterministico.
- Agenda: disponibilità, eccezioni, prestazioni, prenotazione con slot, disdetta con limite, lista d'attesa, questionario pre-visita.
- Pannello admin completo (provider e chiavi cifrate, config IA, prompt versionati, template, eventi→canali, anagrafiche, utenti/verifiche, audit esportabile, consensi versionati, feature flag con conferma regolatoria CDS).
- PWA con consultazione offline lato paziente.

## Fase 2 — Operatività reale

- Adapter reali: email transazionale, SMS/OTP (verifica telefono in registrazione), push, OCR (deskew/contrasto/multi-pagina per foto e scansioni), storage S3-compatibile, antivirus + sandbox parsing.
- Firma digitale FEQ/FEA via provider eIDAS; verifica di integrità esposta al paziente.
- Import via email dedicata per paziente con quarantena.
- Videoconsulto (provider WebRTC): sala d'attesa, condivisione documenti in chiamata, referto dalle note.
- Pagamenti online e documentazione contabile; convenzioni/assicurazioni.
- Caregiver: flusso completo di invito e gestione deleghe da UI; deleghe segreteria da UI medico.
- Migrazione a PostgreSQL, KMS per le chiavi, backup cifrati con test di ripristino.
- Vista "per problema clinico" completa (raggruppamento percorsi di cura) e oscuramento assistito dei dati di terzi nei documenti.

## Fase 3 — Interoperabilità e certificazione

- Export FHIR R4 completo (Bundle paziente) e import da FSE quando disponibile il canale di accreditamento.
- Percorso di certificazione CE per il modulo CDS (suggerimenti clinici + interazioni con banca dati farmacologica licenziata); attivazione dei feature flag CDS solo a valle.
- Conformità AI Act formalizzata (documentazione tecnica, gestione rischio, registrazione).
- Multilingua (architettura già predisposta: tutte le stringhe di sistema sono centralizzabili).
- Wrapping mobile (Capacitor) riusando la PWA.

## Fase 4 — Scala

- Multi-studio con fatturazione per struttura; ruoli granulari per collaboratori.
- Modulo discovery/profilo pubblico degli specialisti (ed eventuale riconsiderazione delle recensioni, con moderazione).
- Analitiche aggregate e anonimizzate per i medici sui propri assistiti.
