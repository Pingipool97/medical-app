import { NextResponse } from 'next/server';
import { getSession, destroySession } from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function POST(req: Request) {
  const s = await getSession();
  if (s) await audit({ actorUserId: s.userId, actorRole: s.role, action: 'LOGOUT' });
  destroySession();
  return NextResponse.redirect(new URL('/login', req.url), 303);
}
