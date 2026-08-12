# Manuale del pannello di amministrazione

Accesso: account con ruolo ADMIN (demo: `admin@demo.it` / `Demo2026!`). La 2FA è
obbligatoria: al primo accesso viene chiesta la configurazione con un'app di
autenticazione (chiave manuale). Tutte le modifiche di configurazione finiscono
nell'audit log con l'utente che le ha fatte.

## Provider e chiavi (`/admin/provider`)

Ogni servizio esterno è un provider con tipo (AI, OCR, EMAIL, SMS, PUSH, STORAGE,
VIDEO, PAGAMENTI, FIRMA, SSN), URL base opzionale e chiave API.

- Le chiavi sono **cifrate a riposo** (AES-256-GCM), mostrate solo mascherate, mai
  loggate, mai inviate al browser. Per cambiarle si inserisce il nuovo valore; per
  mantenerle si lascia il campo vuoto (rotazione = inserire la nuova chiave).
- **Testa connessione**: per il provider AI esegue una chiamata reale minima; per gli
  altri tipi valida la configurazione (il test reale arriva con l'adapter specifico).
  Esito e data restano visibili.
- Un provider disabilitato o assente non fa mai fallire l'app: le funzioni che lo usano
  degradano in modo dichiarato (notifiche accodate, IA in fallback, OCR "inserimento
  manuale", firma "documento non firmato").

## Configurazione IA (`/admin/ia`)

- Per ogni funzione: on/off, modello, temperatura, token massimi. Le funzioni marcate
  **CDS** (suggerimenti clinici, interazioni farmacologiche) si possono accendere solo
  se il relativo feature flag è attivo — è il cancello regolatorio.
- **Tetti di spesa** giornaliero e mensile: al superamento le chiamate vengono bloccate
  automaticamente (fallback dichiarato) e il blocco è auditato.
- Dashboard consumi: chiamate, token e costo per funzione e per richiedente.

## Prompt di sistema (`/admin/prompt`)

Ogni funzione IA ha un prompt versionato: si salva una **nuova versione** (mai
sovrascrittura), si attiva quella desiderata, si torna indietro riattivando una versione
precedente. Confronto affiancato tra due versioni. Regole da non rimuovere mai dai
prompt: citazione delle fonti, gestione dell'incertezza, disclaimer.

## Template (`/admin/template`) ed eventi (`/admin/notifiche`)

- Template di email/SMS/push/PDF con variabili (`{{nome}}`, `{{link}}`, …), anteprima e
  invio di test. Politica fissa: **le comunicazioni esterne non contengono mai contenuto
  clinico**, solo avviso + link all'area autenticata.
- Matrice eventi→canali: per ogni evento di piattaforma si scelgono i canali. Senza
  provider configurato i canali esterni accodano (stato PENDING, visibile in dashboard).

## Anagrafiche (`/admin/anagrafiche`)

Specializzazioni, tipi di documento, tipi di richiesta (con SLA di default), analiti di
laboratorio (con unità, range di riferimento e alias per l'estrazione automatica),
banca dati interazioni farmacologiche e controindicazioni (usata dal motore
deterministico del modulo CDS). Tutto modificabile senza toccare il codice.

## Utenti (`/admin/utenti`)

- **Verifica dei medici**: i medici registrati restano PENDING (niente pazienti, niente
  emissioni) finché non ne confermi l'identità professionale (numero d'Ordine e
  provincia). Verifica o rifiuta con nota; tutto auditato.
- Sospensione/riattivazione account.

## Audit (`/admin/audit`)

Filtri per azione, attore, tipo di oggetto, periodo, paziente; export CSV (l'export
stesso viene auditato). Gli accessi ai dati clinici di un paziente sono la stessa fonte
che il paziente vede in "Chi ha visto i miei dati".

## Consensi (`/admin/consensi`)

Versioni delle informative: pubblicare una nuova versione non cancella le precedenti né
le accettazioni raccolte. Statistiche di accettazione/revoca per versione.

## Feature flag (`/admin/flags`)

- `cds_*`: moduli di supporto decisionale — l'attivazione richiede la dichiarazione di
  consapevolezza regolatoria (registrata in audit). Vedi `docs/CONFORMITA.md`.
- `modalita_manutenzione`: blocca l'accesso a tutti tranne gli admin.
- `registrazioni_aperte`: chiude le registrazioni pubbliche.
- `videoconsulto`, `pagamenti_online`, `recensioni_pubbliche`: moduli opzionali, da
  attivare solo con i relativi provider configurati.
