# NOTES — stato del progetto

> File di stato per le sessioni di lavoro (letto a inizio sessione, aggiornato a fine sessione).

## Stato corrente (2026-09-15)

**HABITUS APP** — piattaforma fisio e benessere, Next.js 14 + Prisma + **PostgreSQL su Supabase**.

- **Database reale**: progetto Supabase `wkboqgliehjklradokmq` (eu-west-1), 56 tabelle,
  migration versionate in `prisma/migrations/`. Il vecchio `prisma/dev.db` SQLite è stato
  rimosso dal repo insieme all'escamotage `/tmp` in `src/lib/db.ts`.
- **Branding HABITUS**: nome, loghi (`public/logo-habitus*.png`), icone PWA generate dal
  logo piccolo, palette ricostruita sui colori del marchio (navy `#1e104a` → azzurro,
  accento teal `#529091`) con sfumature che riprendono le cornici del logo.
- **Calendario stile Google Calendar**: viste giorno/settimana/mese, griglia oraria
  posizionale, drag&drop (pointer event: funziona anche da tablet), creazione da slot
  vuoto, colorazione per prestazione / paziente / stato. Stesso componente per medico,
  paziente (sola lettura) e segreteria.
- **Abbonamento Premium** 8,99 €/anno: gate centralizzato in `callAi()`, pagina paziente,
  pannello admin. Attivazione manuale — nessun provider di pagamento collegato.
- **Professioni senza albo**: `Specialization.requiresOrdine`; i campi Ordine compaiono
  in registrazione solo se la professione li richiede, con validazione anche lato server.
- **Notifiche**: preferenze per utente (`NotificationPreference`) nelle impostazioni di
  medico e paziente, e job periodico `/api/cron` che fa finalmente scattare il promemoria
  appuntamento (prima era dichiarato ma non lo emetteva nessuno).

## Ultima cosa chiusa

`npm run build` verde (50 pagine), `tsc --noEmit` pulito. Verificati in browser: agenda
medico con drag&drop (conferma sul DB), calendario paziente, registrazione con campi
Ordine condizionali nelle due direzioni, paywall IA, preferenze notifica, `/api/cron`
(401 senza segreto, promemoria inviato con segreto). Dati di prova rimossi dal database:
restano solo i tre account demo.

## Prossima cosa aperta

1. **Chiave IA**: non è mai stata configurata. `callAi()` cade sul fallback e non esce
   nulla verso Anthropic — l'abbonamento premium vende una funzione oggi spenta.
   Serve una chiave da console.anthropic.com in Admin → Provider oppure in `AI_API_KEY`.
2. **Deploy su Vercel**: env da impostare — `DATABASE_URL`, `DIRECT_URL`,
   `APP_ENCRYPTION_KEY`, `AUTH_SECRET`, `CRON_SECRET`. **Mai** `DEV_LOGIN` né `DISABLE_2FA`.
3. **Storage documenti**: `src/lib/storage.ts` scrive sul filesystem → su Vercel va in
   `EROFS`. Va sostituito con object storage prima di considerare l'upload funzionante.
4. **Supabase free**: il progetto va in pausa dopo 7 giorni di inattività. Per un uso
   reale serve il piano Pro.
5. Decisioni ancora aperte dal punto F dell'analisi originale: perimetro MVP senza moduli
   CDS, esclusione recensioni pubbliche, modello di titolarità GDPR.

## Modalità sviluppo attiva

- `DEV_LOGIN="true"` in `.env`: accesso rapido dalla pagina di login + selettore vista in
  sidebar + anteprima `/demo/whatsapp`. In produzione la variabile NON va impostata.
- `SEED_DEMO="true"` popola il calendario con pazienti e appuntamenti dimostrativi
  (`npx tsx prisma/seed.ts`). Senza la variabile il seed crea solo anagrafiche e i tre
  account demo.
- Il service worker è registrato **solo in produzione**: in sviluppo la sua cache
  `cache-first` su `/_next/static` serviva JavaScript vecchio a ogni modifica.
- Convenzione: niente emoji decorative, icone SVG da `src/components/icons.tsx`.
  Ammessi solo ⚠ (avvisi), ⚕ (disclaimer medico), ✓/✗ (stati).

## Debiti tecnici dichiarati

- **WhatsApp con agente IA**: esiste solo l'anteprima a dati finti (`/demo/whatsapp`).
  La sezione ufficiale `/medico/whatsapp` è dichiarata in costruzione. Per attivarla
  servono account WhatsApp Business API, numero dedicato, template approvati da Meta,
  webhook pubblico e una valutazione privacy.
- **Pagamenti**: nessun provider. L'abbonamento si attiva a mano da Admin → Abbonamenti.
  La logica di attivazione è già isolata in `src/lib/subscription.ts`, pronta per un webhook.
- **Dispatcher notifiche**: EMAIL/SMS/PUSH restano `PENDING`, nessun invio reale.
- **OCR**: adapter non collegato; i PDF scansionati restano senza testo estratto.
- `extractedText` in chiaro nel DB per la ricerca; `APP_ENCRYPTION_KEY` nel `.env` → KMS.
- Testi delle informative nel seed = segnaposto da sostituire con quelli del DPO.
- La password del database Supabase è passata dalla chat di sviluppo: va ruotata
  (Settings → Database → Reset password) prima di considerare l'ambiente sicuro.
