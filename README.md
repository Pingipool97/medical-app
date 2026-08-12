# Cartella Intelligente — Piattaforma sanitaria medico ↔ paziente

Web app che mette in comunicazione medici e pazienti attorno alla documentazione clinica:
il paziente carica i referti, il sistema li legge e li struttura in una timeline sanitaria,
l'IA produce riassunti e spunti **sempre validati dal medico** prima di raggiungere il paziente.

> ⚠️ La piattaforma è progettata come **strumento di supporto documentale e organizzativo**.
> I moduli di supporto decisionale clinico (CDS) sono dietro feature flag disattivati di
> default: la loro attivazione è una scelta regolatoria consapevole (vedi `docs/CONFORMITA.md`).

## Stack e motivazione

| Scelta | Motivo |
|---|---|
| **Next.js 14 (App Router) full-stack, TypeScript** | Un solo deployable per frontend+backend; server components e server actions riducono la superficie API esposta; responsive nativo; predisposto al wrapping mobile (PWA già inclusa, Capacitor possibile senza riscritture). |
| **Prisma ORM + SQLite (dev) → PostgreSQL (prod)** | Il modello dati è definito in `prisma/schema.prisma` e migra a PostgreSQL cambiando il datasource, senza modifiche al codice applicativo. Nessuna migration verso DB remoti viene applicata da questo repo: gli schemi sono definiti e basta. |
| **Sessioni JWT httpOnly + TOTP (otplib)** | 2FA obbligatoria per medici e admin; blocco account dopo tentativi falliti; nessuna dipendenza da servizi di auth esterni. |
| **Cifratura a campo AES-256-GCM** (`src/lib/crypto.ts`) | CF, telefoni, contatti d'emergenza, segreti 2FA e chiavi API cifrati a riposo; i file documento sono cifrati sul filesystem. In produzione la chiave va in un KMS. |
| **PWA + service worker** | Consultazione offline della timeline e dei documenti già visitati lato paziente, con sync al ritorno della rete. |
| **Provider esterni come adapter configurabili** | IA, OCR, email, SMS, push, storage, video, pagamenti, firma: tutti configurati dal pannello admin (chiavi cifrate, test di connessione, fallback dichiarato). Nessuna chiave nel codice. |
| **Tailwind CSS** | UI professionale, accessibile (contrasto, focus visibile, testo regolabile), mobile-first. |
| **FHIR come riferimento del modello clinico** | Le entità core (Document≈DocumentReference, LabResult≈Observation, Condition, Medication, Appointment…) sono mappabili su FHIR R4 per l'export e il futuro dialogo con FSE/sistemi ospedalieri. Dettagli in `docs/ANALISI-COMPARATIVA.md`. |

## Avvio rapido

```bash
npm install
npm run setup     # prisma generate + db push (SQLite locale) + seed
npm run dev       # http://localhost:3000
```

Account demo (password per tutti: `Demo2026!`):

| Ruolo | Email | Note |
|---|---|---|
| Admin | `admin@demo.it` | al primo accesso configura la 2FA (obbligatoria) |
| Medico | `medico@demo.it` | verificato, cardiologia, con disponibilità e prestazioni |
| Paziente | `paziente@demo.it` | collegato al medico demo, diario parzialmente compilato |

Il file `.env` viene generato con chiavi casuali (`APP_ENCRYPTION_KEY`, `AUTH_SECRET`).
**Non committare `.env`; in produzione usare un secret manager.**

## Funzioni IA

Senza provider IA configurato tutte le funzioni IA rispondono con un **fallback
deterministico dichiarato** (mai output inventato). Per attivarle: Admin → Provider e
chiavi → aggiungi provider `AI` (formato API Anthropic Messages) → Testa connessione →
abilita. Modello, temperatura, token e prompt di sistema sono configurabili per singola
funzione (Admin → Configurazione IA / Prompt di sistema), con tetti di spesa e blocco
automatico.

## Struttura

```
prisma/schema.prisma      Modello dati completo (47 modelli) — fonte di verità
prisma/seed.ts            Anagrafiche, prompt v1, flag, consensi, utenti demo
src/lib/                  Dominio: auth, crypto, access control, audit, IA, pipeline OCR, red flags
src/app/actions/          Server actions condivise (documenti, comunicazione, agenda, diario, IA, emissione)
src/app/paziente/         Area paziente (timeline, diario, documenti, richieste, assistente…)
src/app/medico/           Area medico (cartella clinica, bozze IA, agenda, richieste…)
src/app/admin/            Pannello amministrazione (provider, IA, prompt, anagrafiche, audit…)
docs/                     Analisi comparativa, flussi, conformità, manuale admin, roadmap
```

## Documentazione

- `docs/ANALISI-COMPARATIVA.md` — OpenEMR, LibreHealth, Ottehr, GNU Health, HospitalRun, MioDottore, decisione FHIR
- `docs/FLUSSI-UTENTE.md` — mappa dei flussi per ruolo, eccezioni e casi limite
- `docs/CONFORMITA.md` — GDPR art. 9, MDR/dispositivo medico, AI Act, responsabilità, conservazione
- `docs/ADMIN.md` — manuale del pannello di amministrazione
- `docs/ROADMAP.md` — MVP e fasi successive
- `NOTES.md` — stato del progetto per le sessioni di lavoro
