import 'server-only';

// Minimizzazione dei dati verso il provider IA: rimozione dei identificatori diretti
// (nome, CF, contatti) prima dell'invio, con mapping di reidentificazione SOLO lato piattaforma.
// Dichiarato per ciò che è: minimizzazione, non anonimizzazione — il testo clinico resta
// potenzialmente identificante; la mitigazione completa è contrattuale (DPA, no-training, residency UE).

export type PseudoMap = Map<string, string>;

const CF_RE = /\b[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]\b/gi;
const PHONE_RE = /\b(\+39\s?)?3\d{2}[\s.]?\d{6,7}\b|\b0\d{1,3}[\s.]?\d{6,8}\b/g;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g;

export function pseudonymize(
  text: string,
  identities: { firstName?: string | null; lastName?: string | null }[]
): { text: string; map: PseudoMap } {
  const map: PseudoMap = new Map();
  let out = text;
  let counter = 1;

  const replaceAll = (re: RegExp, prefix: string) => {
    out = out.replace(re, (m) => {
      const token = `[${prefix}_${counter++}]`;
      map.set(token, m);
      return token;
    });
  };

  replaceAll(CF_RE, 'CF');
  replaceAll(EMAIL_RE, 'EMAIL');
  replaceAll(PHONE_RE, 'TEL');

  for (const id of identities) {
    for (const name of [id.firstName, id.lastName].filter(Boolean) as string[]) {
      if (name.length < 3) continue;
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      out = out.replace(re, (m) => {
        const token = `[NOME_${counter++}]`;
        map.set(token, m);
        return token;
      });
    }
  }
  return { text: out, map };
}

export function reidentify(text: string, map: PseudoMap): string {
  let out = text;
  for (const [token, original] of map) {
    out = out.split(token).join(original);
  }
  return out;
}
