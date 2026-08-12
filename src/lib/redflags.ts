// Screening deterministico dei sintomi d'allarme nei messaggi/richieste del paziente.
// Su trigger: interstitial bloccante con rimando a 112/118, invio solo dopo conferma esplicita,
// messaggio marcato redFlag e medico notificato con priorità.
// Deliberatamente deterministico (keyword), non IA: deve funzionare sempre, anche senza provider.

const PATTERNS: { re: RegExp; label: string }[] = [
  { re: /dolore\s+(al\s+)?(petto|torac\w+)|oppression\w+\s+(al\s+)?petto/i, label: 'dolore toracico' },
  { re: /(fatica|difficolt\w+|non\s+riesco)\s+a?\s*respirare|fiato\s+corto\s+improvviso|dispnea/i, label: 'difficoltà respiratoria' },
  { re: /braccio\s+sinistro\s+(addormentato|formicol\w+|dolore)/i, label: 'possibile sintomo cardiaco' },
  { re: /(faccia|bocca|viso)\s+stort\w+|non\s+riesco\s+a\s+parlare|parola\s+impastata/i, label: 'possibile ictus' },
  { re: /(perdita|perso)\s+(di\s+)?(conoscenza|coscienza)|svenut\w+/i, label: 'perdita di coscienza' },
  { re: /emorragia|sangue\s+(abbondante|che\s+non\s+si\s+ferma)|vomito\s+(di\s+)?sangue/i, label: 'emorragia' },
  { re: /(gonfiore|edema)\s+(di\s+)?(gola|lingua|labbra)|shock\s+anafilattico|non\s+riesco\s+a\s+deglutire/i, label: 'possibile reazione allergica grave' },
  { re: /farla\s+finita|suicid\w+|togliermi\s+la\s+vita|non\s+voglio\s+più\s+vivere/i, label: 'ideazione suicidaria' },
  { re: /convulsion\w+|crisi\s+epilettica\s+in\s+corso/i, label: 'convulsioni' },
  { re: /febbre\s+(a|di|oltre)\s*(40|41)/i, label: 'febbre molto alta' },
];

export function detectRedFlags(text: string): string[] {
  const found: string[] = [];
  for (const p of PATTERNS) {
    if (p.re.test(text)) found.push(p.label);
  }
  return found;
}
