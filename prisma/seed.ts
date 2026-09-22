// Seed: anagrafiche di sistema, configurazione IA con prompt versionati, flag, consensi, utenti demo.
// Eseguire con: npm run db:seed
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import 'dotenv/config';
import { fromZoned, shiftDateKey, todayKey } from '../src/lib/datetime';

const db = new PrismaClient();

function encryptField(plain: string): string {
  const key = Buffer.from(process.env.APP_ENCRYPTION_KEY!, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}
function lookupHash(value: string): string {
  return createHash('sha256').update(process.env.APP_ENCRYPTION_KEY + '|' + value.toUpperCase().trim()).digest('hex');
}

async function main() {
  console.log('Seed in corso…');

  // ── Specializzazioni (gestite da DB, modificabili da admin) ──
  // Terzo elemento = richiede iscrizione all'Ordine. Le professioni sanitarie senza albo
  // (chinesiologo clinico, massofisioterapista, massaggiatore) hanno false: in registrazione
  // i campi Ordine non compaiono e non sono richiesti dalla validazione.
  const specs: [string, string, boolean][] = [
    ['cardiologia', 'Cardiologia', true], ['ortopedia', 'Ortopedia', true], ['dermatologia', 'Dermatologia', true],
    ['ginecologia', 'Ginecologia', true], ['oculistica', 'Oculistica', true], ['neurologia', 'Neurologia', true],
    ['endocrinologia', 'Endocrinologia', true], ['gastroenterologia', 'Gastroenterologia', true], ['urologia', 'Urologia', true],
    ['otorinolaringoiatria', 'Otorinolaringoiatria', true], ['pneumologia', 'Pneumologia', true], ['reumatologia', 'Reumatologia', true],
    ['oncologia', 'Oncologia', true], ['psichiatria', 'Psichiatria', true], ['odontoiatria', 'Odontoiatria', true],
    ['allergologia', 'Allergologia', true], ['nefrologia', 'Nefrologia', true], ['ematologia', 'Ematologia', true],
    ['medicina_sport', 'Medicina dello sport', true], ['nutrizione', 'Nutrizione', true], ['fisiatria', 'Fisiatria', true],
    ['fisioterapia', 'Fisioterapia', true],
    ['medicina_generale', 'Medicina generale', true], ['pediatria', 'Pediatria', true], ['chirurgia_generale', 'Chirurgia generale', true],
    ['radiologia', 'Radiologia', true], ['angiologia', 'Angiologia', true], ['geriatria', 'Geriatria', true],
    // Professioni senza obbligo di iscrizione a un Ordine
    ['chinesiologo_clinico', 'Chinesiologo clinico', false],
    ['massofisioterapista', 'Massofisioterapista', false],
    ['massofisioterapista_mcb', 'Massofisioterapista (MCB)', false],
    ['massaggiatore', 'Massaggiatore', false],
  ];
  for (const [code, name, requiresOrdine] of specs) {
    await db.specialization.upsert({
      where: { code },
      update: { name, requiresOrdine },
      create: { code, name, requiresOrdine },
    });
  }

  // ── Tipi documento ──
  const docTypes = [
    ['referto_specialistico', 'Referto di visita specialistica'],
    ['esami_laboratorio', 'Esami di laboratorio'],
    ['imaging', 'Imaging (RX / TAC / RMN / Ecografia)'],
    ['lettera_dimissione', 'Lettera di dimissione'],
    ['ricetta', 'Ricetta'],
    ['certificato', 'Certificato'],
    ['verbale_ps', 'Verbale di pronto soccorso'],
    ['piano_terapeutico', 'Piano terapeutico'],
    ['vaccinazione', 'Attestato di vaccinazione'],
    ['altro', 'Altro documento'],
  ];
  for (const [code, name] of docTypes) {
    await db.documentTypeDef.upsert({ where: { code }, update: {}, create: { code, name } });
  }

  // ── Tipi richiesta ──
  const reqTypes: [string, string, number][] = [
    ['prescrizione_farmaco', 'Richiesta / ripetizione di prescrizione farmaco', 48],
    ['certificato', 'Richiesta di certificato', 72],
    ['impegnativa', 'Richiesta di impegnativa / esami', 72],
    ['appuntamento', 'Richiesta di appuntamento', 48],
    ['videoconsulto', 'Richiesta di videoconsulto', 48],
    ['domanda_clinica', 'Domanda clinica non urgente', 72],
    ['sintomi', 'Comunicazione di sintomi / effetti collaterali', 48],
    ['altro', 'Altra richiesta', 72],
  ];
  for (const [code, name, sla] of reqTypes) {
    await db.requestTypeDef.upsert({ where: { code }, update: {}, create: { code, name, defaultSlaHours: sla } });
  }

  // ── Analiti di laboratorio con range e alias ──
  const analytes: [string, string, string, number | null, number | null, string, string[]][] = [
    ['HGB', 'Emoglobina', 'g/dL', 12, 17.5, 'Emocromo', ['Hb', 'emoglobina']],
    ['WBC', 'Leucociti', '10^3/µL', 4, 11, 'Emocromo', ['globuli bianchi', 'leucociti']],
    ['PLT', 'Piastrine', '10^3/µL', 150, 400, 'Emocromo', ['piastrine']],
    ['GLU', 'Glicemia', 'mg/dL', 70, 100, 'Metabolico', ['glucosio', 'glicemia']],
    ['HBA1C', 'Emoglobina glicata', '%', 4, 5.7, 'Metabolico', ['HbA1c', 'emoglobina glicata']],
    ['CHOL', 'Colesterolo totale', 'mg/dL', null, 200, 'Lipidico', ['colesterolo totale', 'colesterolo']],
    ['LDL', 'Colesterolo LDL', 'mg/dL', null, 116, 'Lipidico', ['LDL']],
    ['HDL', 'Colesterolo HDL', 'mg/dL', 40, null, 'Lipidico', ['HDL']],
    ['TRIG', 'Trigliceridi', 'mg/dL', null, 150, 'Lipidico', ['trigliceridi']],
    ['TSH', 'TSH', 'µUI/mL', 0.4, 4.0, 'Tiroide', ['tireotropina']],
    ['FT4', 'FT4', 'ng/dL', 0.8, 1.8, 'Tiroide', ['tiroxina libera']],
    ['CREA', 'Creatinina', 'mg/dL', 0.6, 1.3, 'Renale', ['creatinina']],
    ['AZOT', 'Azotemia', 'mg/dL', 15, 50, 'Renale', ['urea', 'azotemia']],
    ['GOT', 'AST (GOT)', 'U/L', null, 40, 'Epatico', ['AST', 'transaminasi GOT']],
    ['GPT', 'ALT (GPT)', 'U/L', null, 41, 'Epatico', ['ALT', 'transaminasi GPT']],
    ['GGT', 'Gamma-GT', 'U/L', null, 60, 'Epatico', ['gamma gt', 'γ-GT']],
    ['FERR', 'Ferritina', 'ng/mL', 30, 400, 'Marziale', ['ferritina']],
    ['SID', 'Sideremia', 'µg/dL', 60, 170, 'Marziale', ['ferro', 'sideremia']],
    ['VITD', 'Vitamina D (25-OH)', 'ng/mL', 30, 100, 'Vitamine', ['25-OH-D', 'vitamina d']],
    ['B12', 'Vitamina B12', 'pg/mL', 200, 900, 'Vitamine', ['vitamina b12']],
    ['PCR', 'Proteina C reattiva', 'mg/L', null, 5, 'Infiammazione', ['PCR', 'proteina c reattiva']],
    ['VES', 'VES', 'mm/h', null, 20, 'Infiammazione', ['velocità di eritrosedimentazione']],
    ['URIC', 'Acido urico', 'mg/dL', 3.5, 7.2, 'Metabolico', ['uricemia', 'acido urico']],
    ['PSA', 'PSA totale', 'ng/mL', null, 4, 'Marker', ['antigene prostatico']],
    ['NA', 'Sodio', 'mmol/L', 136, 145, 'Elettroliti', ['sodio', 'natriemia']],
    ['K', 'Potassio', 'mmol/L', 3.5, 5.1, 'Elettroliti', ['potassio', 'kaliemia']],
  ];
  for (const [code, name, unit, refLow, refHigh, category, aliases] of analytes) {
    await db.labAnalyte.upsert({
      where: { code },
      update: {},
      create: { code, name, unit, refLow, refHigh, category, aliases: JSON.stringify(aliases) },
    });
  }

  // ── Banca dati interazioni (set dimostrativo — in produzione va caricato un dataset con licenza) ──
  const interactions: [string, string, string, string][] = [
    ['warfarin', 'aspirina', 'GRAVE', 'Aumento significativo del rischio emorragico per sommazione dell’effetto antiaggregante/anticoagulante.'],
    ['warfarin', 'ibuprofene', 'GRAVE', 'FANS + anticoagulante orale: rischio emorragico gastrointestinale elevato.'],
    ['ace-inibitore', 'potassio', 'MODERATA', 'Rischio di iperkaliemia; monitorare la potassiemia.'],
    ['ramipril', 'ibuprofene', 'MODERATA', 'I FANS riducono l’effetto antipertensivo e aumentano il rischio di danno renale.'],
    ['metformina', 'mezzo di contrasto iodato', 'GRAVE', 'Rischio di acidosi lattica: sospendere la metformina prima dell’esame con contrasto.'],
    ['simvastatina', 'claritromicina', 'GRAVE', 'Inibizione CYP3A4: rischio di miopatia/rabdomiolisi. Sospendere la statina durante il macrolide.'],
    ['ssri', 'tramadolo', 'MODERATA', 'Rischio di sindrome serotoninergica.'],
    ['levotiroxina', 'ferro', 'LIEVE', 'Il ferro riduce l’assorbimento della levotiroxina: distanziare di almeno 4 ore.'],
  ];
  if ((await db.drugInteractionRule.count()) === 0) {
    for (const [a, b, severity, note] of interactions) {
      await db.drugInteractionRule.create({ data: { substanceA: a, substanceB: b, severity, note } });
    }
  }
  const contraindications: [string, string, string, string][] = [
    ['ibuprofene', 'GRAVIDANZA', 'GRAVE', 'FANS controindicati nel terzo trimestre (chiusura prematura del dotto di Botallo).'],
    ['warfarin', 'GRAVIDANZA', 'GRAVE', 'Teratogeno: controindicato in gravidanza.'],
    ['ace-inibitore', 'GRAVIDANZA', 'GRAVE', 'Controindicati in gravidanza (tossicità fetale).'],
    ['amoxicillina', 'ALLERGIA:penicillina', 'GRAVE', 'Allergia crociata con le penicilline.'],
    ['ketoprofene', 'ALLERGIA:aspirina', 'MODERATA', 'Possibile cross-reattività tra FANS.'],
  ];
  if ((await db.drugContraindication.count()) === 0) {
    for (const [substance, condition, severity, note] of contraindications) {
      await db.drugContraindication.create({ data: { substance, condition, severity, note } });
    }
  }

  // ── Configurazione funzioni IA + prompt v1 ──
  const disclaimerLine = 'Chiudi SEMPRE con la riga: "⚕️ Contenuto generato da IA a supporto del medico. Non costituisce diagnosi né prescrizione."';
  const commonRules =
    'Regole non negoziabili: 1) Cita la fonte di ogni affermazione con il riferimento [DOC:id] presente nel contesto; se un\'affermazione non ha fonte nei documenti, dichiaralo esplicitamente. ' +
    '2) Se gli elementi non bastano, scrivi NON_HO_ELEMENTI_SUFFICIENTI seguito da cosa manca. Vietato riempire i vuoti con contenuto generico. ' +
    '3) Non inventare valori, date o esiti. 4) Rispondi in italiano. ' + disclaimerLine;

  const prompts: Record<string, { label: string; isCds: boolean; content: string; maxTokens?: number }> = {
    riassunto_referto_medico: {
      label: 'Riassunto referto (tecnico per il medico)', isCds: false,
      content: `Sei un assistente clinico che riassume un singolo referto per un medico. Produci: 1) sintesi tecnica in 5-8 righe con terminologia medica; 2) elenco dei dati oggettivi rilevati (valori, misure, esiti); 3) eventuali indicazioni di follow-up presenti NEL TESTO. Non aggiungere interpretazioni non presenti nel documento. ${commonRules}`,
    },
    riassunto_referto_paziente: {
      label: 'Riassunto referto (divulgativo per il paziente)', isCds: false,
      content: `Riscrivi il contenuto del referto in linguaggio semplice e rassicurante ma onesto, comprensibile a una persona anziana senza formazione medica. Spiega i termini tecnici tra parentesi. NON esprimere giudizi di gravità, NON fare previsioni, NON suggerire terapie. Ricorda che sarà il medico a commentare i risultati. ${commonRules}`,
    },
    sintesi_paziente: {
      label: 'Sintesi complessiva del paziente', isCds: false, maxTokens: 2500,
      content: `Sei un assistente clinico che prepara una sintesi longitudinale di un paziente per il suo medico. Struttura: 1) Quadro generale (3-5 righe); 2) COSA È CAMBIATO NEL TEMPO — confronta i valori e gli eventi tra le date disponibili, evidenzia trend e variazioni, non limitarti a elencare; 3) Elementi in evidenza (valori fuori range, terapie in corso, allergie); 4) Lacune informative rilevanti. ${commonRules}`,
    },
    suggerimenti_clinici: {
      label: 'Suggerimenti clinici (CDS)', isCds: true, maxTokens: 2500,
      content: `Sei un sistema di supporto decisionale per un MEDICO. Output strutturato in sezioni: 1) CONDIZIONI DA VALUTARE — formulate sempre come "da valutare/da escludere", MAI come diagnosi; per ciascuna: razionale ancorato ai documenti citati; 2) ESAMI DI APPROFONDIMENTO da considerare; 3) LIVELLO DI URGENZA SUGGERITO: routine / a breve / urgente, con motivazione; 4) SEGNALI DI ALLARME da monitorare; 5) LIMITI DI QUESTA ANALISI. Il destinatario è il medico: la decisione è sua. ${commonRules}`,
    },
    chat_clinica: {
      label: 'Chat clinica', isCds: false, maxTokens: 2000,
      content: `Sei un assistente clinico conversazionale per un MEDICO, con il contesto del paziente caricato. Rispondi alle domande del medico basandoti ESCLUSIVAMENTE sul contesto fornito, citando [DOC:id] per ogni affermazione. Se la domanda richiede informazioni non presenti, dillo. ${commonRules}`,
    },
    interazioni_farmaci: {
      label: 'Normalizzazione nomi farmaci (supporto al motore deterministico)', isCds: true, maxTokens: 500,
      content: `Il tuo unico compito: dato un nome commerciale di farmaco, restituisci il principio attivo in minuscolo (es. "Tachipirina" → "paracetamolo"). Se non sei certo, rispondi SCONOSCIUTO. Nessun altro testo.`,
    },
    prep_visita_medico: {
      label: 'Briefing pre-visita (medico)', isCds: false,
      content: `Prepara un briefing di MEZZA PAGINA per il medico prima della visita: chi è il paziente (1 riga), motivo della visita se noto, eventi clinici recenti rilevanti, valori fuori range da discutere, terapie in corso, punti aperti dall'ultima visita. Solo fatti dai documenti, citati con [DOC:id]. ${commonRules}`,
    },
    prep_visita_paziente: {
      label: 'Domande utili pre-visita (paziente)', isCds: false,
      content: `Prepara per il PAZIENTE una lista di 5-8 domande utili da porre al medico durante la prossima visita, basate sui suoi documenti recenti. Linguaggio semplice. NON anticipare risposte, NON esprimere giudizi clinici, NON suggerire diagnosi o terapie. ${commonRules}`,
    },
    assistente_paziente: {
      label: 'Assistente paziente (limitato)', isCds: false, maxTokens: 800,
      content: `Sei un assistente per PAZIENTI con due soli compiti: A) spiegare in linguaggio semplice i termini medici presenti nei referti del paziente; B) aiutare a usare la piattaforma. DIVIETI ASSOLUTI: non dire mai al paziente che cosa ha, non valutare gravità, non suggerire/commentare farmaci o terapie, non fare previsioni, non interpretare i suoi sintomi. Se la domanda esce dai due compiti, rispondi che la valutazione spetta al suo medico e suggerisci di inviare una richiesta dalla sezione "Richieste". Chiudi SEMPRE con: "ℹ️ Spiegazione informativa: per qualsiasi valutazione rivolgiti al tuo medico."`,
    },
    ocr_cleanup: {
      label: 'Pulizia testo OCR', isCds: false, maxTokens: 3000,
      content: `Correggi gli errori evidenti di OCR nel testo fornito (caratteri confusi, righe spezzate) SENZA cambiare i contenuti: non correggere valori numerici se non palesemente malformati, non aggiungere né togliere informazioni. Output: solo il testo pulito.`,
    },
  };
  for (const [functionKey, p] of Object.entries(prompts)) {
    await db.aiFunctionConfig.upsert({
      where: { functionKey },
      update: {},
      create: {
        functionKey,
        label: p.label,
        isCds: p.isCds,
        enabled: !p.isCds, // le funzioni CDS partono disattivate: scelta regolatoria consapevole
        model: 'claude-haiku-4-5-20251001',
        temperature: 0.2,
        maxTokens: p.maxTokens ?? 1500,
      },
    });
    await db.promptTemplate.upsert({
      where: { functionKey_version: { functionKey, version: 1 } },
      update: {},
      create: { functionKey, version: 1, content: p.content, active: true, createdBy: 'seed' },
    });
  }

  // ── Feature flag ──
  const flags: [string, string, string, boolean, boolean][] = [
    ['cds_suggerimenti_clinici', 'Modulo CDS: suggerimenti clinici', 'ATTENZIONE: l’attivazione porta la piattaforma nel perimetro del software come dispositivo medico (MDR 2017/745). Attivare solo con marcatura CE o in sperimentazione dichiarata.', false, true],
    ['cds_interazioni_farmaci', 'Modulo CDS: controllo interazioni farmacologiche', 'ATTENZIONE: come sopra — perimetro dispositivo medico. Richiede banca dati interazioni con licenza.', false, true],
    ['recensioni_pubbliche', 'Recensioni pubbliche dei medici', 'Escluse dall’MVP per conflitto con il rapporto di cura continuativo. Il feedback privato resta attivo.', false, false],
    ['pagamenti_online', 'Pagamenti online', 'Richiede provider pagamenti configurato.', false, false],
    ['videoconsulto', 'Videoconsulto', 'Richiede provider video configurato. Senza provider gli appuntamenti video mostrano istruzioni alternative.', false, false],
    ['modalita_manutenzione', 'Modalità manutenzione', 'Blocca l’accesso a tutti tranne gli admin.', false, false],
    ['registrazioni_aperte', 'Registrazioni aperte', 'Se disattivo, nuovi utenti solo su invito.', true, false],
  ];
  for (const [key, label, description, enabled, isCdsGate] of flags) {
    await db.featureFlag.upsert({ where: { key }, update: {}, create: { key, label, description, enabled, isCdsGate } });
  }

  // ── Regole di notifica (evento → canali) ──
  const events: [string, string][] = [
    ['documento_condiviso', 'Documento condiviso con il medico'], ['documento_emesso', 'Nuovo documento dal medico'],
    ['documento_elaborato', 'Documento elaborato'], ['richiesta_nuova', 'Nuova richiesta dal paziente'],
    ['richiesta_aggiornata', 'Aggiornamento stato richiesta'], ['messaggio_nuovo', 'Nuovo messaggio'],
    ['appuntamento_prenotato', 'Appuntamento prenotato'], ['appuntamento_promemoria', 'Promemoria appuntamento'],
    ['appuntamento_annullato', 'Appuntamento annullato'], ['collegamento_richiesto', 'Richiesta di collegamento'],
    ['collegamento_attivo', 'Collegamento attivato'], ['bozza_ia_in_attesa', 'Bozza IA in attesa di revisione'],
    ['slot_liberato', 'Slot liberato (lista d’attesa)'], ['red_flag', 'Messaggio con sintomi d’allarme'],
  ];
  for (const [eventKey, label] of events) {
    await db.notificationRule.upsert({
      where: { eventKey },
      update: {},
      create: { eventKey, label, channels: JSON.stringify(['INAPP', 'EMAIL']) },
    });
  }

  // ── Template comunicazioni (l'email non contiene MAI contenuto clinico) ──
  const templates: [string, string, string | null, string][] = [
    ['notifica_generica', 'EMAIL', 'Hai una nuova notifica su HABITUS APP', 'Gentile {{nome}},\n\nhai una nuova notifica sulla piattaforma: {{titolo}}.\n\nPer leggerla accedi alla tua area riservata: {{link}}\n\nQuesta email non contiene contenuti clinici per proteggere la tua riservatezza.\nHABITUS APP'],
    ['notifica_generica', 'SMS', null, 'HABITUS APP: {{titolo}}. Accedi per i dettagli: {{link}}'],
    ['promemoria_appuntamento', 'EMAIL', 'Promemoria appuntamento del {{data}}', 'Gentile {{nome}},\n\nti ricordiamo l’appuntamento con {{medico}} il {{data}} alle {{ora}} ({{modalita}}).\n\nPer disdire o modificare: {{link}}\n\nHABITUS APP'],
    ['documento_pdf_intestazione', 'PDF', null, '{{studio}}\n{{medico}} — Iscrizione Ordine {{ordine}}\n{{indirizzo}}'],
  ];
  for (const [key, channel, subject, body] of templates) {
    await db.messageTemplate.upsert({
      where: { key_channel_version: { key, channel, version: 1 } },
      // Aggiorna anche i record esistenti: con `update: {}` un cambio di testo (il nome
      // dell'app, per dire) non arriverebbe mai ai DB già seminati.
      update: { subject, body },
      create: { key, channel, version: 1, subject, body },
    });
  }

  // ── Consensi versionati ──
  const consents: [string, string, string][] = [
    ['PRIVACY', 'Informativa privacy (art. 13 GDPR)', 'Informativa sul trattamento dei dati personali. Titolare per l’area personale del paziente: la piattaforma. Per la cartella del medico: il medico curante (la piattaforma agisce come responsabile ex art. 28). I dati sono cifrati a riposo e in transito. [Testo completo da predisporre con il DPO prima della messa in produzione.]'],
    ['ART9_SALUTE', 'Consenso al trattamento di dati relativi alla salute (art. 9 GDPR)', 'Consenso esplicito al trattamento delle categorie particolari di dati (dati sanitari) per le finalità di gestione della documentazione clinica e comunicazione con i medici collegati. Il consenso è revocabile in ogni momento; la revoca non pregiudica gli obblighi di conservazione del medico previsti dalla legge.'],
    ['IA_TRATTAMENTO', 'Consenso all’elaborazione con sistemi di IA', 'Consenso all’analisi automatica dei documenti caricati tramite sistemi di intelligenza artificiale, con pseudonimizzazione dei dati identificativi diretti prima dell’invio al fornitore del servizio. Gli esiti con contenuto clinico interpretativo sono sempre validati dal medico prima di esserti mostrati. Consenso revocabile: senza consenso la piattaforma resta utilizzabile senza funzioni IA.'],
    ['TERMINI', 'Termini di servizio', 'La piattaforma è uno strumento di supporto documentale e organizzativo. NON è un canale di emergenza: in caso di sintomi gravi chiama il 112/118. Non sostituisce il rapporto medico-paziente.'],
  ];
  for (const [kind, title, text] of consents) {
    await db.consentVersion.upsert({
      where: { kind_version: { kind, version: 1 } },
      update: {},
      create: { kind, version: 1, title, text },
    });
  }

  // ── Impostazioni di sistema ──
  await db.systemSetting.upsert({
    where: { key: 'ai_spending_caps' },
    update: {},
    create: { key: 'ai_spending_caps', value: JSON.stringify({ dailyCents: 500, monthlyCents: 5000 }) },
  });
  await db.systemSetting.upsert({
    where: { key: 'disdetta_ore_limite' },
    update: {},
    create: { key: 'disdetta_ore_limite', value: '24' },
  });

  // ── Utenti demo ──
  const pwd = await bcrypt.hash('Demo2026!', 12);

  const admin = await db.user.upsert({
    where: { email: 'admin@demo.it' },
    update: {},
    create: { email: 'admin@demo.it', passwordHash: pwd, role: 'ADMIN', emailVerifiedAt: new Date() },
  });

  // Admin reale del proprietario. Email e password arrivano dall'ambiente e non stanno
  // scritte qui: questo file e' su git, e una password in chiaro in un repository e'
  // una password gia' persa. Senza le due variabili il seed salta questo blocco, e
  // l'admin si crea a parte con scripts/create-owner-admin.ts.
  const ownerEmail = process.env.OWNER_ADMIN_EMAIL?.toLowerCase().trim();
  const ownerPassword = process.env.OWNER_ADMIN_PASSWORD;
  if (ownerEmail && ownerPassword) {
    const ownerHash = await bcrypt.hash(ownerPassword, 12);
    await db.user.upsert({
      where: { email: ownerEmail },
      update: {
        passwordHash: ownerHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
      create: {
        email: ownerEmail,
        passwordHash: ownerHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Admin proprietario allineato: ${ownerEmail}`);
  } else {
    console.log('OWNER_ADMIN_EMAIL/OWNER_ADMIN_PASSWORD non impostate: admin proprietario saltato.');
  }

  const docUser = await db.user.upsert({
    where: { email: 'medico@demo.it' },
    update: {},
    create: { email: 'medico@demo.it', passwordHash: pwd, role: 'DOCTOR', emailVerifiedAt: new Date() },
  });
  const doctor = await db.doctorProfile.upsert({
    where: { userId: docUser.id },
    update: {},
    create: {
      userId: docUser.id,
      firstName: 'Laura', lastName: 'Bianchi',
      ordineNumber: 'MI-12345', ordineProvince: 'MI',
      structureName: 'Studio Medico Bianchi',
      offices: JSON.stringify([{ name: 'Studio Milano', address: 'Via Roma 1', city: 'Milano' }]),
      verificationStatus: 'VERIFIED', verifiedAt: new Date(), verifiedByUserId: admin.id,
      responseTimeHours: 48,
    },
  });
  const cardio = await db.specialization.findUnique({ where: { code: 'cardiologia' } });
  if (cardio) {
    await db.doctorSpecialization.upsert({
      where: { doctorId_specializationId: { doctorId: doctor.id, specializationId: cardio.id } },
      update: {},
      create: { doctorId: doctor.id, specializationId: cardio.id },
    });
  }

  const patUser = await db.user.upsert({
    where: { email: 'paziente@demo.it' },
    update: {},
    create: { email: 'paziente@demo.it', passwordHash: pwd, role: 'PATIENT', emailVerifiedAt: new Date(), phoneVerifiedAt: new Date(), phoneEnc: encryptField('3331234567') },
  });
  const demoCf = 'RSSMRA80A01F205X';
  const patient = await db.patientProfile.upsert({
    where: { userId: patUser.id },
    update: {},
    create: {
      userId: patUser.id,
      firstName: 'Mario', lastName: 'Rossi',
      birthDate: new Date(1980, 0, 1), biologicalSex: 'M',
      codiceFiscaleEnc: encryptField(demoCf), codiceFiscaleHash: lookupHash(demoCf),
      addressCity: 'Milano', addressProvince: 'MI',
      gpName: 'Dott. Verdi', asl: 'ATS Milano',
      emergencyNameEnc: encryptField('Anna Rossi'), emergencyPhoneEnc: encryptField('3339876543'),
      onboardingStep: 3, profileCompleteness: 55,
    },
  });
  await db.doctorPatientLink.upsert({
    where: { doctorId_patientId: { doctorId: doctor.id, patientId: patient.id } },
    update: {},
    create: { doctorId: doctor.id, patientId: patient.id, status: 'ACTIVE', requestedBy: 'PATIENT', acceptedAt: new Date() },
  });

  // Diario demo
  if ((await db.allergy.count({ where: { patientId: patient.id } })) === 0) {
    await db.allergy.create({ data: { patientId: patient.id, allergen: 'Penicillina', kind: 'FARMACO', severity: 'GRAVE', reaction: 'Orticaria diffusa' } });
    await db.medication.create({ data: { patientId: patient.id, name: 'Ramipril', dosage: '5 mg', frequency: '1 volta al giorno', startedAt: new Date(2024, 2, 1), active: true } });
    await db.condition.create({ data: { patientId: patient.id, name: 'Ipertensione arteriosa', status: 'ACTIVE', onsetDate: new Date(2024, 1, 1) } });
    await db.lifestyle.create({ data: { patientId: patient.id, smoking: 'EX', alcohol: 'OCCASIONALE', physicalActivity: 'MODERATA' } });
    await db.vitalMeasurement.create({ data: { patientId: patient.id, type: 'PRESSIONE', value: 135, value2: 85, unit: 'mmHg', measuredAt: new Date(2026, 6, 20) } });
    await db.vitalMeasurement.create({ data: { patientId: patient.id, type: 'PESO', value: 82, unit: 'kg', measuredAt: new Date(2026, 6, 20) } });
  }

  // Prestazioni e disponibilità del medico demo
  if ((await db.serviceCatalog.count({ where: { doctorId: doctor.id } })) === 0) {
    await db.serviceCatalog.create({ data: { doctorId: doctor.id, name: 'Visita cardiologica', durationMin: 30, priceCents: 12000, mode: 'PRESENZA' } });
    await db.serviceCatalog.create({ data: { doctorId: doctor.id, name: 'Controllo cardiologico', durationMin: 20, priceCents: 8000, mode: 'ENTRAMBI' } });
    await db.serviceCatalog.create({ data: { doctorId: doctor.id, name: 'Videoconsulto', durationMin: 20, priceCents: 7000, mode: 'VIDEO' } });
    for (const weekday of [1, 2, 3, 4, 5]) {
      await db.availability.create({ data: { doctorId: doctor.id, weekday, startTime: '09:00', endTime: '13:00' } });
      await db.availability.create({ data: { doctorId: doctor.id, weekday, startTime: '14:30', endTime: '18:00' } });
    }
  }


  // Appuntamenti e pazienti dimostrativi, per far vedere il calendario popolato.
  // Non fanno parte del seed di base: si creano solo con SEED_DEMO=true, così un
  // ambiente vero non si ritrova dentro persone che non esistono.
  if (process.env.SEED_DEMO === 'true' && (await db.appointment.count({ where: { doctorId: doctor.id } })) === 0) {
    const services = await db.serviceCatalog.findMany({ where: { doctorId: doctor.id }, orderBy: { durationMin: 'desc' } });

    const extra = [
      { first: 'Giulia', last: 'Ferrari', sex: 'F', cf: 'FRRGLI85M41F205Z', birth: '1985-08-01' },
      { first: 'Luca', last: 'Moretti', sex: 'M', cf: 'MRTLCU78E15F205K', birth: '1978-05-15' },
      { first: 'Anna', last: 'Conti', sex: 'F', cf: 'CNTNNA92T55F205R', birth: '1992-12-15' },
    ];

    const patientIds: string[] = [patient.id];
    for (const p of extra) {
      const email = `${p.first.toLowerCase()}.${p.last.toLowerCase()}@demo.it`;
      const u = await db.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          passwordHash: pwd,
          role: 'PATIENT',
          emailVerifiedAt: new Date(),
          patientProfile: {
            create: {
              firstName: p.first,
              lastName: p.last,
              birthDate: new Date(p.birth + 'T00:00:00Z'),
              biologicalSex: p.sex,
              codiceFiscaleEnc: encryptField(p.cf),
              codiceFiscaleHash: lookupHash(p.cf),
              addressCity: 'Milano',
            },
          },
        },
        include: { patientProfile: true },
      });
      if (!u.patientProfile) continue;
      patientIds.push(u.patientProfile.id);
      await db.doctorPatientLink.upsert({
        where: { doctorId_patientId: { doctorId: doctor.id, patientId: u.patientProfile.id } },
        update: {},
        create: {
          doctorId: doctor.id,
          patientId: u.patientProfile.id,
          status: 'ACTIVE',
          requestedBy: 'DOCTOR',
          acceptedAt: new Date(),
        },
      });
    }

    const HOURS = ['09:00', '09:40', '10:30', '11:15', '14:30', '15:30', '16:20', '17:00'];
    let created = 0;
    for (let d = 0; d < 14 && created < 26; d++) {
      const dayISO = shiftDateKey(todayKey(), d);
      const [yy, mm, dd] = dayISO.split('-').map(Number);
      const dow = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
      if (dow === 0 || dow === 6) continue; // niente weekend

      const howMany = 2 + (d % 3);
      for (let i = 0; i < howMany && created < 26; i++) {
        const time = HOURS[(d + i * 3) % HOURS.length];
        const svc = services[(d + i) % Math.max(services.length, 1)];
        const pid = patientIds[(d + i) % patientIds.length];
        // fromZoned: l'orario è "da muro" italiano a prescindere dal fuso della macchina
        const startsAt = fromZoned(dayISO, time);
        await db.appointment.create({
          data: {
            doctorId: doctor.id,
            patientId: pid,
            serviceId: svc?.id ?? null,
            startsAt,
            endsAt: new Date(startsAt.getTime() + (svc?.durationMin ?? 30) * 60_000),
            mode: svc?.mode === 'VIDEO' ? 'VIDEO' : 'PRESENZA',
            status: d === 0 ? 'CONFERMATO' : 'PRENOTATO',
          },
        });
        created++;
      }
    }

    // ── Richieste, messaggi e documenti emessi ──
    // Servono a far vedere l'app viva: senza, ogni sezione della demo è una pagina vuota
    // e non si capisce a cosa serva.

    const giorniFa = (n: number) => new Date(Date.now() - n * 86400_000);

    const richieste: [string, string, string, string, string][] = [
      ['prescrizione_farmaco', 'EVASA', 'Ripetizione Ramipril 5 mg', 'Buongiorno, sto per finire la confezione di Ramipril. Potrebbe farmi la ricetta? Grazie.', patient.id],
      ['certificato', 'PRESA_IN_CARICO', 'Certificato per attività sportiva', 'Mi servirebbe il certificato per l’iscrizione in palestra. Quando posso passare?', patient.id],
      ['domanda_clinica', 'NUOVA', 'Dubbio sul dosaggio', 'Se salto una dose devo recuperarla o aspetto quella dopo?', patient.id],
    ];
    for (const [i, [typeCode, status, subject, body, pid]] of richieste.entries()) {
      await db.serviceRequest.create({
        data: {
          patientId: pid,
          doctorId: doctor.id,
          typeCode,
          status,
          subject,
          body,
          slaHours: 48,
          createdAt: giorniFa(i + 2),
        },
      });
    }

    // Una conversazione con qualche scambio: la sezione Messaggi altrimenti è vuota.
    const conv = await db.conversation.create({
      data: { patientId: patient.id, doctorId: doctor.id },
    });
    const scambio: [string, string, string, number][] = [
      [patUser.id, 'PATIENT', 'Buongiorno dottoressa, dopo la seduta di ieri sento meno rigidità al collo.', 3],
      [docUser.id, 'DOCTOR', 'Ottima notizia. Continui con gli esercizi due volte al giorno e non forzi la rotazione.', 3],
      [patUser.id, 'PATIENT', 'Perfetto. Posso riprendere a nuotare?', 2],
      [docUser.id, 'DOCTOR', 'Sì, ma per ora solo stile libero e senza spingere sui tempi. Ne riparliamo al controllo.', 2],
    ];
    for (const [senderUserId, senderRole, body, gg] of scambio) {
      await db.message.create({
        data: {
          conversationId: conv.id,
          senderUserId,
          senderRole,
          body,
          createdAt: giorniFa(gg),
          readAt: giorniFa(gg),
        },
      });
    }

    // Documenti emessi dal professionista, visibili al paziente in "Ricevuti".
    const emessi: [string, string, string, number][] = [
      ['RICETTA_BIANCA', 'Ricetta — Ramipril 5 mg', 'Ramipril 5 mg, 1 compressa al mattino. Confezione da 28 compresse.', 2],
      ['REFERTO_VISITA', 'Referto valutazione posturale', 'Valutazione posturale: lieve antiversione del bacino, ipomobilità del rachide cervicale. Indicata rieducazione posturale, 8 sedute.', 6],
      ['ISTRUZIONI', 'Esercizi per il tratto cervicale', 'Tre esercizi quotidiani, 10 ripetizioni ciascuno, mattina e sera. Interrompere in caso di dolore acuto.', 6],
    ];
    for (const [kind, title, content, gg] of emessi) {
      const doc = await db.issuedDocument.create({
        data: {
          doctorId: doctor.id,
          patientId: patient.id,
          kind,
          title,
          content: JSON.stringify({ testo: content }),
          sentAt: giorniFa(gg),
          createdAt: giorniFa(gg),
        },
      });
      await db.timelineEvent.create({
        data: {
          patientId: patient.id,
          type: 'DOCUMENTO_EMESSO',
          date: giorniFa(gg),
          title,
          summary: content.slice(0, 120),
          refType: 'IssuedDocument',
          refId: doc.id,
        },
      });
    }

    console.log(`  ${created} appuntamenti demo su ${patientIds.length} pazienti`);
  }

  console.log('Seed completato.');
  console.log('Account demo (password per tutti: Demo2026!):');
  console.log('  admin@demo.it (admin) — medico@demo.it (medico verificato) — paziente@demo.it (paziente)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
