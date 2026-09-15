// Perimetro degli account dimostrativi, in un punto solo: lo leggono la rotta di
// accesso rapido, la pagina di login e la shell applicativa.
//
//  DEMO_MODE=true  → ammesso anche online: apre SOLO paziente e medico, account
//                    seminati con dati di esempio.
//  DEV_LOGIN=true  → solo in locale: aggiunge l'ADMIN.
//
// L'admin non passa mai da DEMO_MODE: da lì si vedono utenti, audit log, chiavi dei
// provider e dati clinici di tutti. Un indirizzo che regala quel ruolo a chi lo conosce
// non è una demo, è una porta aperta.

export function allowedDemoRoles(): string[] {
  if (process.env.DEV_LOGIN === 'true') return ['PATIENT', 'DOCTOR', 'ADMIN'];
  if (process.env.DEMO_MODE === 'true') return ['PATIENT', 'DOCTOR'];
  return [];
}

export function demoEnabled(): boolean {
  return allowedDemoRoles().length > 0;
}

// Gli unici account su cui ha senso il passaggio rapido da un ruolo all'altro.
export const DEMO_EMAILS = ['paziente@demo.it', 'medico@demo.it', 'admin@demo.it'];
const DEMO_EMAIL_SET = new Set(DEMO_EMAILS);

/**
 * Chi sta usando l'app è dentro un account dimostrativo?
 *
 * Serve perché il selettore di vista non deve comparire a un utente vero: un paziente
 * appena registrato vedeva "Vista medico" e cliccandolo finiva dentro l'account del
 * medico demo. Non è un cambio di vista, è entrare in un altro account.
 */
export function isDemoAccount(email?: string | null): boolean {
  return Boolean(email && DEMO_EMAIL_SET.has(email.toLowerCase()));
}
