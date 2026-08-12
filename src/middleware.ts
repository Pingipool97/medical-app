import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Protezione delle aree per ruolo. La verifica fine (collegamenti, deleghe) è nelle
// server action e nelle pagine; qui si garantisce che nessuna area sia raggiungibile
// senza sessione valida e ruolo corretto.

const AREA_ROLES: [string, string[]][] = [
  ['/paziente', ['PATIENT', 'CAREGIVER']],
  ['/medico', ['DOCTOR']],
  ['/admin', ['ADMIN']],
  ['/segreteria', ['STAFF']],
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const area = AREA_ROLES.find(([prefix]) => pathname.startsWith(prefix));
  if (!area) return NextResponse.next();

  const token = req.cookies.get('sanita_session')?.value;
  const loginUrl = new URL('/login', req.url);
  if (!token) return NextResponse.redirect(loginUrl);

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    if (payload.twoFactorPending) return NextResponse.redirect(new URL('/verifica-2fa', req.url));
    if (!area[1].includes(payload.role as string)) {
      return NextResponse.redirect(new URL('/login?errore=area', req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/paziente/:path*', '/medico/:path*', '/admin/:path*', '/segreteria/:path*'],
};
