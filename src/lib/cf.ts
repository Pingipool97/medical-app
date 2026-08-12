// Validazione codice fiscale italiano: checksum + coerenza con data di nascita e sesso.

const MONTH_CODES = 'ABCDEHLMPRST';
const ODD: Record<string, number> = {};
const EVEN: Record<string, number> = {};
{
  const oddVals = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < chars.length; i++) {
    ODD[chars[i]] = oddVals[i];
    EVEN[chars[i]] = i < 10 ? i : i - 10;
  }
}

export function validateCodiceFiscale(cf: string): { valid: boolean; error?: string } {
  const c = cf.toUpperCase().trim();
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(c)) {
    return { valid: false, error: 'Formato del codice fiscale non valido' };
  }
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    sum += i % 2 === 0 ? ODD[c[i]] : EVEN[c[i]];
  }
  const check = String.fromCharCode(65 + (sum % 26));
  if (check !== c[15]) return { valid: false, error: 'Carattere di controllo del codice fiscale errato' };
  return { valid: true };
}

// I caratteri numerici possono essere sostituiti da lettere (omocodia)
function deOmocodia(ch: string): string {
  const map: Record<string, string> = { L: '0', M: '1', N: '2', P: '3', Q: '4', R: '5', S: '6', T: '7', U: '8', V: '9' };
  return map[ch] ?? ch;
}

export function cfMatchesBirth(cf: string, birthDate: Date, sex: 'M' | 'F'): { ok: boolean; error?: string } {
  const c = cf.toUpperCase().trim();
  const yy = parseInt(deOmocodia(c[6]) + deOmocodia(c[7]), 10);
  const month = MONTH_CODES.indexOf(c[8]);
  let day = parseInt(deOmocodia(c[9]) + deOmocodia(c[10]), 10);
  const isFemale = day > 40;
  if (isFemale) day -= 40;
  if (month < 0) return { ok: false, error: 'Mese nel codice fiscale non valido' };
  const bYY = birthDate.getFullYear() % 100;
  if (yy !== bYY || month !== birthDate.getMonth() || day !== birthDate.getDate()) {
    return { ok: false, error: 'Il codice fiscale non è coerente con la data di nascita indicata' };
  }
  if ((sex === 'F') !== isFemale) {
    return { ok: false, error: 'Il codice fiscale non è coerente con il sesso indicato' };
  }
  return { ok: true };
}
