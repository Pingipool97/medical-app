# Note di conformità — GDPR, dispositivo medico, AI Act, responsabilità

> Questo documento traduce l'analisi critica in scelte implementate e in adempimenti
> che restano da fare **prima della messa in produzione**. Non sostituisce il parere
> di un DPO e di un consulente regolatorio.

## 1. GDPR — dati di categoria particolare (art. 9)

**Implementato nel prodotto:**
- Consenso esplicito e separato per: privacy, trattamento dati sanitari (art. 9), elaborazione IA (facoltativo e revocabile — senza, la piattaforma funziona senza IA). Versionamento delle informative (`ConsentVersion`) e registro di chi ha accettato cosa e quando (`ConsentRecord`, con IP).
- Cifratura in transito (HTTPS in produzione) e a riposo: campo-per-campo AES-256-GCM per CF, telefoni, contatti d'emergenza, segreti 2FA, chiavi API; file documento cifrati sul filesystem. Il testo estratto è in chiaro nel DB per la ricerca full-text: in produzione il DB va cifrato a livello di storage (TDE/dischi cifrati) e la chiave applicativa in un KMS.
- Audit di ogni accesso al dato clinico (chi, cosa, quando, da dove), consultabile dal paziente.
- Portabilità: export completo in JSON dal profilo paziente; timeline stampabile.
- Minimizzazione verso il provider IA: pseudonimizzazione dei dati identificativi diretti (nome, CF, email, telefoni) con mapping di reidentificazione solo lato piattaforma. Dichiarata per ciò che è: **minimizzazione, non anonimizzazione**.

**Doppia titolarità (decisione di prodotto):** per lo spazio personale del paziente la piattaforma è titolare; per la cartella del medico il medico è titolare e la piattaforma responsabile ex art. 28 (serve DPA con ogni medico/studio cliente). Il modello dati riflette la distinzione: `DocumentShare.doctorCopyRetained` marca la copia giuridica del medico che sopravvive a revoche e cancellazioni.

**Da fare prima della produzione:** DPIA; nomina DPO; registro dei trattamenti; testi definitivi delle informative (quelli nel seed sono segnaposto dichiarati); DPA con i provider (hosting, IA, email/SMS) con residenza UE e clausola no-training; procedura di data breach.

## 2. Dispositivo medico (MDR 2017/745) — il perimetro configurabile

La Regola 11 MDR porta il software che fornisce informazioni usate per decisioni
diagnostiche/terapeutiche in classe IIa o superiore. La piattaforma implementa un
**confine netto e consapevole**:

| Perimetro sicuro (documentale/organizzativo) | Perimetro CDS (potenziale dispositivo medico) |
|---|---|
| Gestione documentale, OCR, estrazione valori, timeline | Suggerimenti clinici ("condizioni da valutare", urgenza) |
| Riassunti descrittivi dei referti (nessuna inferenza) | Controllo interazioni farmacologiche e allergie |
| Spiegazione termini, briefing documentale pre-visita | |
| Comunicazione, richieste, agenda, emissione documenti | |

- Le funzioni CDS hanno `isCds=true`, partono **disattivate**, e stanno dietro feature
  flag (`cds_suggerimenti_clinici`, `cds_interazioni_farmaci`) la cui attivazione
  richiede una dichiarazione esplicita dell'admin, registrata nell'audit log.
- Attivarle sul mercato richiede marcatura CE (o contesto di sperimentazione dichiarato).
  L'MVP va in produzione con il solo perimetro sicuro.
- Il controllo interazioni, quando attivo, è **deterministico** su banca dati con licenza
  (l'LLM al più normalizza i nomi dei farmaci) e dichiara la propria copertura.

## 3. AI Act

Se il modulo CDS diventa dispositivo medico, il sistema IA ricade nell'alto rischio.
I requisiti sono già architettura, non retrofit:
- **Supervisione umana**: nessun output con contenuto clinico interpretativo raggiunge il paziente senza validazione del medico (stato bozza → revisionata → pubblicata; mai auto-pubblicazione; bozze a scadenza).
- **Trasparenza**: disclaimer non rimovibile su ogni output; citazione delle fonti per affermazione; dichiarazione di insufficienza ("non ho elementi sufficienti") invece di risposte generiche.
- **Tracciabilità**: ogni chiamata registra funzione, modello, versione del prompt, token, costo, richiedente, esito (`AiJob`); i blocchi guardrail e budget sono auditati.
- **Robustezza**: fallback deterministico su errore/indisponibilità; tetti di spesa con blocco automatico.

## 4. Responsabilità professionale

Chi risponde di un suggerimento IA seguito dal medico? Il medico, e il prodotto è
costruito perché questo sia sostenibile:
- validazione obbligatoria e modificabile (il medico può correggere la bozza prima di approvare);
- conservazione delle prove: bozza originale, versione finale, chi ha revisionato e quando, fonti citate, versione del prompt e modello usati;
- disclaimer permanente che qualifica l'output come supporto;
- il paziente non vede mai output non validati, quindi non esiste un "consiglio della piattaforma" autonomo.

## 5. Ricette, certificati, FSE, firma

- **Ricetta dematerializzata SSN**: l'NRE è emesso solo dal Sistema TS. La piattaforma gestisce ricette bianche e promemoria NRE, e lo dichiara nella UI di emissione. Integrazione Sistema TS = adapter futuro (`ProviderConfig kind=SSN`).
- **Certificati di malattia INPS**: solo canale SAC; qui si emettono certificati "liberi" (idoneità non agonistica, riammissione…).
- **FSE**: export FHIR predisposto; l'alimentazione del FSE richiede accreditamento regionale — dichiarata come futura, mai simulata.
- **Firma digitale**: valore legale solo con provider FEQ/FEA (eIDAS). Senza provider i documenti emessi sono esplicitamente marcati "non firmati" con hash di integrità.

## 6. Conservazione e cancellazione

- Documentazione clinica del medico: obbligo di conservazione pluriennale → la copia del medico sopravvive alla revoca del collegamento e alla cancellazione dell'account paziente, con base giuridica "obbligo legale".
- Cancellazione account paziente: elimina lo spazio personale (profilo, diario, documenti non condivisi); l'informativa lo spiega prima, non dopo.
- Backup: da configurare in produzione (cifrati, residenza UE, test di ripristino periodico documentato).

## 7. Sicurezza applicativa

- 2FA TOTP obbligatoria per medici e admin; lockout dopo 5 tentativi; sessioni JWT httpOnly 12h.
- File caricati: whitelist per magic bytes, dimensione massima, storage cifrato, download solo autenticato e auditato. In produzione: scansione antivirus e parsing in sandbox dedicata (adapter previsto).
- Import email: da attivare solo con indirizzo univoco per paziente e quarantena (il modello lo prevede; l'adapter email è configurabile).
- Le email/SMS in uscita non contengono mai contenuto clinico: solo avviso + link all'area autenticata.
- Offline PWA: cache del browser del dispositivo dell'utente, svuotata al logout; i contenuti offline sono solo quelli già legittimamente visualizzati.
