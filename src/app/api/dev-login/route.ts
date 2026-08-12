import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildSessionPayload, createSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

// Accesso rapido di SVILUPPO: crea la sessione di un account demo senza credenziali né 2FA.
// Attivo SOLO con DEV_LOGIN=true in .env — in produzione la variabile non va impostata
// e questa route risponde 404. Il login vero resta intatto ("a dormire", non rimosso).

const DEMO_BY_ROLE: Record<string, string> = {
  PATIENT: 'paziente@demo.it',
  DOCTOR: 'medico@demo.it',
  ADMIN: 'admin@demo.it',
};

const DEST: Record<string, string> = { PATIENT: '/paziente', DOCTOR: '/medico', ADMIN: '/admin' };

export async function GET(req: NextRequest) {
  if (process.env.DEV_LOGIN !== 'true') {
    return NextResponse.json({ error: 'Non disponibile' }, { status: 404 });
  }
  const role = req.nextUrl.searchParams.get('role') ?? 'PATIENT';
  const email = DEMO_BY_ROLE[role];
  if (!email) return NextResponse.json({ error: 'Ruolo non valido' }, { status: 400 });

  const user = await db.user.findUnique({
    where: { email },
    include: { patientProfile: true, doctorProfile: true, staffProfile: true },
  });
  if (!user) return NextResponse.json({ error: 'Utente demo non trovato: esegui npm run db:seed' }, { status: 404 });

  await createSession(buildSessionPayload(user, false));
  await audit({ actorUserId: user.id, actorRole: user.role, action: 'LOGIN', metadata: { devLogin: true } });
  return NextResponse.redirect(new URL(DEST[role], req.url), 303);
}
