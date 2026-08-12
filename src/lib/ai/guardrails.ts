import 'server-only';

// Guardrail a doppio livello per l'assistente paziente: oltre al prompt ristretto,
// un filtro deterministico sull'OUTPUT che blocca diagnosi/terapie/prognosi.
// Ogni blocco viene loggato (segnale utile anche per il medico).

const FORBIDDEN_OUTPUT: { re: RegExp; reason: string }[] = [
  { re: /\b(hai|soffri di|si tratta di|è probabile che tu abbia|potresti avere|la diagnosi è)\b/i, reason: 'formulazione diagnostica diretta' },
  { re: /\b(ti consiglio di (prendere|assumere)|dovresti (prendere|assumere)|aumenta la dose|riduci la dose|sospendi il farmaco|inizia (a prendere|la terapia))\b/i, reason: 'indicazione terapeutica' },
  { re: /\b(prognosi|aspettativa di vita|ti restano|guarirai (entro|in))\b/i, reason: 'contenuto prognostico' },
  { re: /\bnon (serve|c'è bisogno di|è necessario) (andare dal|consultare il|sentire il) medico\b/i, reason: 'scoraggia il ricorso al medico' },
];

const FORBIDDEN_INPUT: { re: RegExp; reason: string }[] = [
  { re: /\b(cosa ho|che malattia ho|è grave|sto morendo|che cos'ho|ho un tumore|è un tumore|è cancro)\b/i, reason: 'richiesta di diagnosi' },
  { re: /\b(che (farmaco|medicina) (devo|posso) prendere|quanto (farmaco|ne) devo prendere|posso smettere di prendere)\b/i, reason: 'richiesta di indicazione terapeutica' },
];

export function checkPatientAssistantInput(text: string): { allowed: boolean; reason?: string } {
  for (const f of FORBIDDEN_INPUT) {
    if (f.re.test(text)) return { allowed: false, reason: f.reason };
  }
  return { allowed: true };
}

export function checkPatientAssistantOutput(text: string): { allowed: boolean; reason?: string } {
  for (const f of FORBIDDEN_OUTPUT) {
    if (f.re.test(text)) return { allowed: false, reason: f.reason };
  }
  return { allowed: true };
}

export const PATIENT_REDIRECT_MESSAGE =
  'Non posso rispondere a questa domanda: riguarda una valutazione che spetta al tuo medico. ' +
  'Posso aiutarti a capire i termini presenti nei tuoi referti o a usare la piattaforma. ' +
  'Se hai un dubbio sulla tua salute, invia una richiesta al tuo medico dalla sezione “Richieste”.';
