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
