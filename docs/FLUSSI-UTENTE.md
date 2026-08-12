# Mappa dei flussi utente — con eccezioni e casi limite

## Paziente

### Registrazione e onboarding
1. Registrazione essenziale: nome, cognome, data di nascita, sesso biologico, CF (validato: checksum + coerenza con data/sesso), cellulare, email, password, consensi (privacy + art. 9 obbligatori, IA facoltativo).
2. Onboarding progressivo a step (residenza/medico di base/emergenza → patologie/allergie → farmaci → stile di vita/misurazioni), ogni step saltabile, barra di completezza.
3. **Eccezioni**: CF già presente → invito al recupero password (no doppioni); CF incoerente con data di nascita → errore spiegato; consensi obbligatori non spuntati → blocco con spiegazione.
4. La completezza del profilo (0–100) è un **parametro di affidabilità**: mostrata accanto a ogni analisi IA.

### Collegamento con un medico
1. Il paziente cerca un medico **verificato** e invia richiesta di collegamento.
2. Il medico accetta o rifiuta. Prima dell'accettazione **non vede nulla** del paziente.
3. Revoca in ogni momento dal paziente: chiude l'accesso prospettico e revoca le condivisioni; il medico **conserva copia** di quanto già ricevuto (obbligo di conservazione) — la UI lo spiega prima della conferma.
4. **Casi limite**: medico non verificato → non collegabile; richiesta duplicata → bloccata; medico che cessa → collegamenti chiusi e pazienti notificati (procedura admin).

### Caricamento documento
1. Sorgente (PDF/foto, mobile con fotocamera) → tipologia → specializzazione → data (opzionale) → emittente/note → upload.
2. Pipeline asincrona con stato visibile per passo e **retry**: deduplica (hash) → estrazione testo (PDF nativo; foto/scansioni richiedono provider OCR, altrimenti stato onesto "da inserire manualmente") → coerenza intestatario (CF nel documento vs profilo → quarantena se incoerente) → estrazione data (da confermare) → valori di laboratorio (matching su anagrafica analiti, con confidence).
3. Ogni valore estratto è "da confermare": la conferma umana cambia lo stato e i grafici distinguono i punti non confermati. Valori implausibili (>20× range) → quarantena, mai nei grafici.
4. **Casi limite**: duplicato → proposta di merge/eliminazione, non scarto silenzioso; file corrotto/formato falso → magic bytes verificati, errore spiegato; documento di terzi → quarantena con verifica richiesta.

### Richieste al medico
1. Tipi configurabili (ricetta, certificato, impegnativa, appuntamento, domanda clinica, sintomi…) con SLA dichiarato del medico visibile **prima** dell'invio.
2. Ogni richiesta è un oggetto con stato: nuova → presa in carico → in attesa di informazioni → evasa / rifiutata con motivo / annullata dal paziente. Storico transizioni visibile.
3. **Screening sintomi d'allarme** (deterministico) in composizione: su trigger (dolore toracico, dispnea, segni di ictus, emorragia, ideazione suicidaria…) interstitial bloccante con rimando al 112; invio solo dopo conferma esplicita "non è un'emergenza"; il messaggio arriva al medico marcato e con notifica prioritaria.

### Timeline e offline
- Cronologia unica (documenti, misurazioni, documenti emessi dal medico, appuntamenti) con filtri (periodo, tipo, specializzazione, parole chiave), evidenza fuori-range, versione stampabile da portare in visita, export dati completo (JSON, portabilità).
- Offline (PWA): le pagine già visitate restano consultabili senza rete; al logout la cache si svuota.

### Assistente IA (limitato)
- Spiega termini medici dei propri referti e l'uso della piattaforma. Guardrail a doppio livello (input e output); domande di diagnosi/terapia → reindirizzo al medico, con blocco loggato.
- Senza consenso IA la funzione è spenta e lo dice.

## Medico

### Registrazione e verifica
1. Dati professionali (Ordine+provincia, specializzazioni, P.IVA/struttura) + 2FA obbligatoria al primo accesso.
2. Account in stato PENDING finché l'admin non verifica l'identità professionale: **non può emettere documenti né accettare pazienti**.

### Cartella del paziente
- Header di sicurezza sempre visibile: allergie in rosso, gravidanza/allattamento.
- Vede solo i documenti **condivisi con lui** (regola multi-medico: condivisione per scope, default privato; le note e bozze IA di un medico non sono visibili agli altri).
- Andamento valori con banda del range di riferimento, punti non confermati distinti.
- Ogni apertura è auditata e il paziente può consultare il log ("chi ha visto i miei dati").

### IA per il medico
1. Riassunto tecnico/divulgativo di un referto, sintesi longitudinale, briefing pre-visita, chat clinica con citazione delle fonti [DOC:id] e memoria conversazione.
2. Ogni output nasce **bozza**: il medico revisiona (può modificare), approva, e solo per i contenuti destinati al paziente pubblica. Le bozze scadono (30 giorni) e non si auto-pubblicano mai.
3. Suggerimenti clinici e controllo interazioni = **modulo CDS**: attivo solo se l'admin ha abilitato il feature flag (scelta regolatoria); il controllo interazioni è deterministico su banca dati e dichiara la propria copertura ("basato su N farmaci registrati, profilo al X%").
4. Provider IA assente/errore/budget superato → fallback deterministico dichiarato, mai output inventato.

### Richieste, agenda, emissione
- Richieste in coda con stati, SLA ed evidenza red-flag; rifiuto solo con motivo.
- Agenda: disponibilità settimanali, eccezioni/ferie, prestazioni con durata/prezzo; questionario pre-visita visibile; completamento visita con note → referto generabile dalle note.
- Emissione documenti: ricetta bianca, promemoria NRE (la ricetta SSN dematerializzata si emette solo via Sistema TS — la piattaforma lo dichiara), richieste esami, certificati non-INPS, piani terapeutici, referti. Firma digitale reale solo con provider configurato: senza, il documento è esplicitamente "non firmato".

## Segreteria
- Agenda del medico senza contenuti clinici. Accesso clinico solo con **delega esplicita, temporizzata e tracciata** (visibile anche al paziente nel log accessi).

## Caregiver
- Delega con ambito, scadenza e revoca; per i minori la delega decade automaticamente ai 18 anni del paziente. Ogni accesso del delegato è loggato.

## Admin
- Verifica dei medici, provider e chiavi (cifrate, mascherate, test di connessione), configurazione IA per funzione con tetti di spesa e blocco, prompt versionati con rollback, template comunicazioni, matrice eventi→canali, anagrafiche (specializzazioni, tipi, analiti, interazioni), audit filtrabile ed esportabile, consensi versionati, feature flag con conferma regolatoria per i moduli CDS.

## Casi limite trasversali
- **Bozza IA mai revisionata** → scade, promemoria al medico, il paziente non ne conosce l'esistenza.
- **Paziente senza medico con valori critici nel referto** → avviso neutro standard ("valori fuori range: parlane con il tuo medico"), nessuna gradazione di gravità (sarebbe diagnosi).
- **Cancellazione account** → elimina lo spazio paziente; le copie condivise restano al medico per obbligo di legge (dichiarato nell'informativa).
- **Gravidanza** → stato con scadenza che chiede riconferma, non flag perenne.
- **Notifiche esterne senza provider** → accodate (PENDING) e visibili in admin, mai perse in silenzio.
