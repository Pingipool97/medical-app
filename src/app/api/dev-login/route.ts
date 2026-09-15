import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildSessionPayload, createSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { allowedDemoRoles } from '@/lib/demo-access';

// Accesso rapido agli account dimostrativi: crea la sessione senza credenziali né 2FA.
//
// Due interruttori distinti, perché servono a due cose diverse:
//
//  DEMO_MODE=true  → ammesso anche online. Apre SOLO paziente e medico, cioè i due ruoli
//                    che si vogliono far vedere. Sono account seminati con dati finti.
//  DEV_LOGIN=true  → solo in locale. Aggiunge l'ADMIN.
//
// L'admin non passa mai da DEMO_MODE: da lì si vedono utenti, audit log, chiavi dei
// provider e dati clinici di tutti. Un indirizzo che regala quel ruolo a chi lo conosce
// non è una demo, è una porta aperta.

const DEMO_BY_ROLE: Record<string, string> = {
  PATIENT: 'paziente@demo.it',
  DOCTOR: 'medico@demo.it',
  ADMIN: 'admin@demo.it',
};

const DEST: Record<string, string> = { PATIENT: '/paziente', DOCTOR: '/medico', ADMIN: '/admin' };

export async function GET(req: NextRequest) {
  const allowed = allowedDemoRoles();
  if (allowed.length === 0) {
    return NextResponse.json({ error: 'Non disponibile' }, { status: 404 });
  }

  const role = req.nextUrl.searchParams.get('role') ?? 'PATIENT';
  // Un ruolo non ammesso risponde 404 come se la rotta non esistesse: non si conferma
  // a chi prova che l'indirizzo è giusto e manca solo il permesso.
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: 'Non disponibile' }, { status: 404 });
  }

  const email = DEMO_BY_ROLE[role];
  const user = await db.user.findUnique({
    where: { email },
    include: { patientProfile: true, doctorProfile: true, staffProfile: true },
  });
  if (!user) return NextResponse.json({ error: 'Utente demo non trovato: esegui npm run db:seed' }, { status: 404 });

  await createSession(buildSessionPayload(user, false));
  await audit({ actorUserId: user.id, actorRole: user.role, action: 'LOGIN', metadata: { demoLogin: true, role } });

  // Destinazione facoltativa, per entrare direttamente su una sezione. Solo percorsi
  // interni: "//host" e gli URL assoluti verrebbero usati per rimbalzare altrove.
  const next = req.nextUrl.searchParams.get('next');
  const dest = next && /^\/[A-Za-z0-9/_-]*$/.test(next) ? next : DEST[role];
  return NextResponse.redirect(new URL(dest, req.url), 303);
}
