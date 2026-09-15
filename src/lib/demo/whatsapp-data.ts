// Dati dimostrativi per l'anteprima "WhatsApp con agente IA".
// NON è un'integrazione: non c'è nessuna connessione a Meta, nessun numero verificato,
// nessun messaggio reale. Serve a mostrare il flusso e il layout prima di investire
// nell'integrazione vera (WhatsApp Business API + webhook + template approvati).

export type WaAuthor = 'PAZIENTE' | 'AGENTE' | 'MEDICO';

export type WaMessage = {
  id: string;
  author: WaAuthor;
  text: string;
  /** Minuti trascorsi dall'apertura della demo: reso in orario al primo render. */
  minutesAgo: number;
  attachment?: { name: string; kind: 'image' | 'pdf' | 'audio'; size: string };
  /** Solo per i messaggi in uscita. */
  state?: 'inviato' | 'consegnato' | 'letto';
};

export type WaConversation = {
  id: string;
  name: string;
  phone: string;
  /** L'agente IA gestisce la conversazione, oppure l'ha presa in carico il professionista. */
  handledBy: 'AGENTE' | 'MEDICO';
  unread: number;
  /** Il paziente è collegato in piattaforma: consente di aprire la scheda. */
  patientLinked: boolean;
  /** Etichetta di sintesi prodotta dall'agente. */
  tag?: string;
  messages: WaMessage[];
};

export const DEMO_CONVERSATIONS: WaConversation[] = [
  {
    id: 'c1',
    name: 'Giulia Ferrari',
    phone: '+39 333 41 22 907',
    handledBy: 'AGENTE',
    unread: 2,
    patientLinked: true,
    tag: 'Richiesta appuntamento',
    messages: [
      { id: 'm1', author: 'PAZIENTE', text: 'Buongiorno, avrei bisogno di spostare la seduta di giovedì', minutesAgo: 184 },
      {
        id: 'm2',
        author: 'AGENTE',
        text: 'Buongiorno Giulia. Certo, controllo l’agenda. Ho disponibilità giovedì alle 16:20 oppure venerdì alle 09:40. Quale preferisce?',
        minutesAgo: 183,
        state: 'letto',
      },
      { id: 'm3', author: 'PAZIENTE', text: 'Venerdì alle 9:40 va benissimo, grazie', minutesAgo: 181 },
      {
        id: 'm4',
        author: 'AGENTE',
        text: 'Perfetto, ho spostato l’appuntamento a venerdì 09:40. Le arriverà il promemoria il giorno prima. Le serve altro?',
        minutesAgo: 180,
        state: 'letto',
      },
      { id: 'm5', author: 'PAZIENTE', text: 'Sì, una cosa: da due giorni ho un fastidio al ginocchio destro quando salgo le scale', minutesAgo: 22 },
      {
        id: 'm6',
        author: 'AGENTE',
        text: 'Questa è una valutazione clinica e non posso darla io. Ho segnalato il messaggio al professionista, che le risponderà appena possibile. Se il dolore diventa forte o il ginocchio si gonfia, si rivolga subito a un medico.',
        minutesAgo: 22,
        state: 'letto',
      },
      { id: 'm7', author: 'PAZIENTE', text: 'Va bene, aspetto. Grazie', minutesAgo: 20 },
    ],
  },
  {
    id: 'c2',
    name: 'Luca Moretti',
    phone: '+39 347 88 01 233',
    handledBy: 'MEDICO',
    unread: 0,
    patientLinked: true,
    tag: 'Presa in carico',
    messages: [
      { id: 'm1', author: 'PAZIENTE', text: 'Le mando la risonanza che mi ha chiesto', minutesAgo: 320 },
      { id: 'm2', author: 'PAZIENTE', text: '', minutesAgo: 319, attachment: { name: 'RMN_ginocchio_dx.pdf', kind: 'pdf', size: '2,4 MB' } },
      {
        id: 'm3',
        author: 'AGENTE',
        text: 'Grazie, ho ricevuto il documento e l’ho caricato nella sua cartella. Lo segnalo al professionista per la lettura.',
        minutesAgo: 318,
        state: 'letto',
      },
      {
        id: 'm4',
        author: 'MEDICO',
        text: 'Buonasera Luca, ho visto la risonanza. Ne parliamo con calma alla seduta di mercoledì, intanto continui con gli esercizi che le ho dato e non forzi sulla flessione.',
        minutesAgo: 95,
        state: 'letto',
      },
      { id: 'm5', author: 'PAZIENTE', text: 'Perfetto, grazie mille', minutesAgo: 90 },
    ],
  },
  {
    id: 'c3',
    name: 'Anna Conti',
    phone: '+39 320 55 71 480',
    handledBy: 'AGENTE',
    unread: 1,
    patientLinked: true,
    tag: 'Promemoria confermato',
    messages: [
      {
        id: 'm1',
        author: 'AGENTE',
        text: 'Buongiorno Anna, le ricordo l’appuntamento di domani alle 15:30 in studio. Risponda CONFERMO per confermare o DISDICI per annullare.',
        minutesAgo: 1450,
        state: 'letto',
      },
      { id: 'm2', author: 'PAZIENTE', text: 'CONFERMO', minutesAgo: 1440 },
      { id: 'm3', author: 'AGENTE', text: 'Grazie, appuntamento confermato. A domani!', minutesAgo: 1439, state: 'letto' },
      { id: 'm4', author: 'PAZIENTE', text: 'Scusi, devo portare qualcosa in particolare?', minutesAgo: 35 },
      {
        id: 'm5',
        author: 'AGENTE',
        text: 'Porti un abbigliamento comodo e, se li ha, gli ultimi referti. Per il resto non serve altro.',
        minutesAgo: 34,
        state: 'letto',
      },
      { id: 'm6', author: 'PAZIENTE', text: 'Grazie!', minutesAgo: 30 },
    ],
  },
  {
    id: 'c4',
    name: 'Mario Rossi',
    phone: '+39 339 12 04 556',
    handledBy: 'AGENTE',
    unread: 0,
    patientLinked: true,
    tag: 'Informazioni',
    messages: [
      { id: 'm1', author: 'PAZIENTE', text: 'Buonasera, quanto costa una seduta di massoterapia?', minutesAgo: 2880 },
      {
        id: 'm2',
        author: 'AGENTE',
        text: 'Buonasera. La seduta di massoterapia dura 50 minuti e costa 60 €. Vuole che le proponga le prime disponibilità?',
        minutesAgo: 2879,
        state: 'letto',
      },
      { id: 'm3', author: 'PAZIENTE', text: 'Per ora no grazie, ci penso', minutesAgo: 2875 },
    ],
  },
  {
    id: 'c5',
    name: 'Numero non registrato',
    phone: '+39 351 77 90 112',
    handledBy: 'AGENTE',
    unread: 1,
    patientLinked: false,
    tag: 'Nuovo contatto',
    messages: [
      { id: 'm1', author: 'PAZIENTE', text: 'Salve, avete disponibilità per una prima visita questa settimana?', minutesAgo: 8 },
      {
        id: 'm2',
        author: 'AGENTE',
        text: 'Salve. Questa settimana la prima disponibilità è venerdì alle 11:15. Per fissarla mi servono nome, cognome e un recapito email. Vuole procedere?',
        minutesAgo: 8,
        state: 'consegnato',
      },
    ],
  },
];

/** Comportamenti dell'agente, mostrati nel pannello impostazioni della demo. */
export const AGENT_RULES: { key: string; label: string; desc: string; on: boolean }[] = [
  { key: 'promemoria', label: 'Promemoria appuntamenti', desc: 'Invia il promemoria e registra CONFERMO / DISDICI.', on: true },
  { key: 'agenda', label: 'Spostamento appuntamenti', desc: 'Propone gli slot liberi e sposta la prenotazione.', on: true },
  { key: 'listino', label: 'Prezzi e informazioni di studio', desc: 'Risponde su costi, durata, sede e orari.', on: true },
  { key: 'documenti', label: 'Ricezione documenti', desc: 'Salva gli allegati nella cartella del paziente.', on: true },
  { key: 'clinico', label: 'Domande cliniche', desc: 'Non risponde mai: passa la conversazione al professionista.', on: false },
];
