// Prestazioni suggerite, per professione.
//
// Non sono un vincolo: sono il punto di partenza per non far scrivere tutto a mano a
// chi si iscrive. Il professionista spunta quelle che offre e aggiunge le sue con il
// campo libero. Durata e prezzo si regolano dopo, in Agenda: qui si decide solo
// COSA si offre, non a che condizioni.
//
// Chi tocca questo file: sono nomi visti dal paziente in fase di prenotazione, quindi
// devono essere quelli che userebbe lui, non sigle da cartella clinica.

export const PRESTAZIONI_SUGGERITE: Record<string, string[]> = {
  // ── Area fisio e benessere ──
  fisiatria: ['Prima visita fisiatrica', 'Visita di controllo', 'Infiltrazione', 'Valutazione posturale'],
  fisioterapia: ['Prima valutazione fisioterapica', 'Seduta di fisioterapia', 'Terapia manuale', 'Rieducazione funzionale', 'Rieducazione post-operatoria', 'Tecar / terapia strumentale', 'Linfodrenaggio'],
  chinesiologo_clinico: ['Valutazione funzionale', 'Ginnastica posturale', 'Rieducazione motoria', 'Allenamento personalizzato'],
  massofisioterapista: ['Seduta di massofisioterapia', 'Terapia manuale', 'Rieducazione post-operatoria', 'Linfodrenaggio'],
  massofisioterapista_mcb: ['Seduta di massofisioterapia', 'Terapia manuale', 'Rieducazione post-operatoria', 'Linfodrenaggio'],
  massaggiatore: ['Massaggio decontratturante', 'Massaggio sportivo', 'Massaggio rilassante', 'Linfodrenaggio'],
  medicina_sport: ['Visita per idoneità sportiva agonistica', 'Visita per idoneità non agonistica', 'Elettrocardiogramma', 'Visita di controllo'],
  ortopedia: ['Prima visita ortopedica', 'Visita di controllo', 'Infiltrazione articolare', 'Lettura referti'],
  reumatologia: ['Prima visita reumatologica', 'Visita di controllo', 'Infiltrazione'],

  // ── Area medica ──
  medicina_generale: ['Visita medica generale', 'Certificato medico', 'Rinnovo ricetta', 'Consulto telefonico'],
  cardiologia: ['Prima visita cardiologica', 'Visita di controllo', 'Elettrocardiogramma', 'Ecocardiogramma', 'Holter pressorio'],
  dermatologia: ['Prima visita dermatologica', 'Mappatura dei nei', 'Visita di controllo', 'Crioterapia'],
  nutrizione: ['Prima visita nutrizionale', 'Controllo del peso', 'Piano alimentare', 'Analisi della composizione corporea'],
  ginecologia: ['Prima visita ginecologica', 'Pap test', 'Ecografia ginecologica', 'Visita in gravidanza'],
  pediatria: ['Prima visita pediatrica', 'Bilancio di salute', 'Certificato per lo sport', 'Visita di controllo'],
  oculistica: ['Visita oculistica completa', 'Controllo della vista', 'Misurazione della pressione oculare'],
  odontoiatria: ['Prima visita odontoiatrica', 'Igiene dentale', 'Otturazione', 'Controllo annuale'],
  psichiatria: ['Primo colloquio', 'Colloquio di controllo', 'Consulto online'],
  neurologia: ['Prima visita neurologica', 'Visita di controllo', 'Elettromiografia'],
  endocrinologia: ['Prima visita endocrinologica', 'Visita di controllo', 'Ecografia tiroidea'],
  gastroenterologia: ['Prima visita gastroenterologica', 'Visita di controllo', 'Ecografia addominale'],
  pneumologia: ['Prima visita pneumologica', 'Spirometria', 'Visita di controllo'],
  allergologia: ['Prima visita allergologica', 'Test allergometrici', 'Visita di controllo'],
  urologia: ['Prima visita urologica', 'Visita di controllo', 'Ecografia'],
  otorinolaringoiatria: ['Prima visita otorinolaringoiatrica', 'Esame audiometrico', 'Lavaggio auricolare'],
  geriatria: ['Prima visita geriatrica', 'Valutazione multidimensionale', 'Visita di controllo'],
  angiologia: ['Prima visita angiologica', 'Ecocolordoppler', 'Visita di controllo'],
  nefrologia: ['Prima visita nefrologica', 'Visita di controllo'],
  ematologia: ['Prima visita ematologica', 'Visita di controllo'],
  oncologia: ['Prima visita oncologica', 'Visita di controllo', 'Consulto sui referti'],
  chirurgia_generale: ['Prima visita chirurgica', 'Visita di controllo', 'Medicazione', 'Rimozione punti'],
  radiologia: ['Ecografia', 'Consulto sui referti'],
};

// Offerte a chiunque: valgono per qualsiasi professione e non hanno senso ripeterle
// in ogni voce della tabella qui sopra.
const TRASVERSALI = ['Prima visita', 'Visita di controllo', 'Consulto online', 'Consulto telefonico'];

/**
 * Le prestazioni da proporre a un professionista, in base alle sue professioni.
 * Senza duplicati e in ordine alfabetico: due professioni vicine propongono spesso
 * la stessa cosa (un massaggiatore e un massofisioterapista fanno entrambi
 * linfodrenaggio) e non deve comparire due volte.
 */
export function prestazioniSuggerite(codiciProfessione: string[]): string[] {
  const dalleProfessioni = codiciProfessione.flatMap((c) => PRESTAZIONI_SUGGERITE[c] ?? []);
  const tutte = new Set([...dalleProfessioni, ...TRASVERSALI]);
  return [...tutte].sort((a, b) => a.localeCompare(b, 'it'));
}
