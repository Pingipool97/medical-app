# NOTES — stato del progetto

> File di stato per le sessioni di lavoro (letto a inizio sessione, aggiornato a fine sessione).

## Stato corrente (2026-08-08)

App costruita da zero in questa sessione: Next.js 14 + Prisma/SQLite locale (nessuna
migration remota: schema solo in `prisma/schema.prisma`, applicato con `db push` sul
file locale `prisma/dev.db`). Seed con anagrafiche complete e utenti demo
(`admin@demo.it`, `medico@demo.it`, `paziente@demo.it` — password `Demo2026!`).

- Fondamenta: schema (47 modelli), crypto a campo, auth+2FA TOTP, audit, access control
  (collegamenti/condivisioni/deleghe), pipeline documentale con retry, red flags,
  modulo IA (provider configurabile, pseudonimizzazione, guardrail, budget, bozze→revisione),
  motore interazioni deterministico, notifiche multi-canale.
- Aree UI: paziente, medico (+segreteria minima), admin — costruite in parallelo.
- Documentazione in `docs/` + README.

## Ultima cosa chiusa

App completa e verificata: `next build` senza errori (40+ route), verifica in browser di
login paziente, dashboard, diario, interstitial 112 sulle richieste, login medico con
setup 2FA TOTP, cartella clinica con allergie in evidenza e cancello CDS funzionante;
pannello admin smoke-testato pagina per pagina (12 pagine, export CSV, guardrail CDS).
Corretti in integrazione: `ISSUED_KINDS` spostata da modulo 'use server' a constants.ts;
enforcement server della verifica medico in `respondLinkAction`. Dev server: porta 3005.

## Prossima cosa aperta

- Decisioni aperte per Michele (dal punto F dell'analisi critica):
  1. conferma perimetro MVP senza moduli CDS attivi (default attuale: spenti);
  2. conferma esclusione recensioni pubbliche dall'MVP (default attuale: escluse);
  3. conferma modello di titolarità GDPR (medico titolare / piattaforma responsabile + titolare spazio paziente).

## Modalità sviluppo attiva

- `DEV_LOGIN="true"` in `.env`: accesso rapido senza credenziali dalla pagina di login
  (Paziente/Medico/Admin) + selettore "Vista (solo sviluppo)" nella sidebar per cambiare
  ruolo al volo. Il login vero e la 2FA restano intatti: per riattivarli basta togliere
  la riga dal `.env`. In produzione la variabile NON va impostata.
- Emoji decorative sostituite con icone SVG professionali (`src/components/icons.tsx`);
  conservati solo ⚠ (avvisi clinici), ⚕ (disclaimer medico) e ✓/✗ (stati).
- Registrato un account medico reale (Michele) in attesa di verifica: approvarlo da
  Admin → Utenti → Verifica medici.

## Debiti tecnici dichiarati

- Adapter esterni stub (OCR reale, email/SMS/push, firma eIDAS, video, pagamenti, antivirus/sandbox): configurabili da admin ma senza integrazione reale — vedi `docs/ROADMAP.md` Fase 2.
- Verifica email/OTP telefono in registrazione: predisposta, attiva solo con provider.
- `extractedText` in chiaro nel DB per la ricerca (cifrare lo storage DB in produzione; chiave app → KMS).
- Testi delle informative nel seed = segnaposto da sostituire con testi del DPO.
- SQLite in dev: per produzione passare a PostgreSQL (cambio datasource, nessun cambio codice).
