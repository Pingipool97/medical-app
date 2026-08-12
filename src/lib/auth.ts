import 'server-only';
import { cookies, headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { db } from './db';
import { decryptField, encryptField } from './crypto';
import { audit } from './audit';
import { ROLES, type Role } from './constants';

const COOKIE = 'sanita_session';
const SESSION_HOURS = 12;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET mancante');
  return new TextEncoder().encode(s);
}

export type Session = {
  userId: string;
  role: Role;
  email: string;
  displayName: string;
  patientId?: string; // se PATIENT
  doctorId?: string; // se DOCTOR
  staffId?: string;
  twoFactorPending?: boolean;
};

export async function createSession(payload: Session) {
  const token = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function requireSession(role?: Role | Role[]): Promise<Session> {
  const s = await getSession();
  if (!s || s.twoFactorPending) throw new Error('UNAUTHORIZED');
  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(s.role)) throw new Error('FORBIDDEN');
  }
  return s;
}

export function destroySession() {
  cookies().set(COOKIE, '', { path: '/', maxAge: 0 });
}

export function clientInfo() {
  const h = headers();
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'locale',
    userAgent: (h.get('user-agent') || '').slice(0, 250),
  };
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function verifyCredentials(email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { patientProfile: true, doctorProfile: true, staffProfile: true },
  });
  const { ip, userAgent } = clientInfo();
  if (!user || user.status === 'DELETED') {
    await audit({ action: 'LOGIN_FAIL', metadata: { email: email.slice(0, 60) }, ip, userAgent });
    return { ok: false as const, error: 'Email o password non corretti.' };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false as const, error: 'Account temporaneamente bloccato per troppi tentativi. Riprova più tardi.' };
  }
  if (user.status === 'SUSPENDED') {
    return { ok: false as const, error: 'Account sospeso. Contatta l’assistenza.' };
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    await audit({ actorUserId: user.id, action: 'LOGIN_FAIL', ip, userAgent });
    return { ok: false as const, error: 'Email o password non corretti.' };
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  return { ok: true as const, user };
}

export function buildSessionPayload(user: any, twoFactorPending = false): Session {
  const displayName =
    user.patientProfile?.firstName
      ? `${user.patientProfile.firstName} ${user.patientProfile.lastName}`
      : user.doctorProfile
        ? `Dr. ${user.doctorProfile.firstName} ${user.doctorProfile.lastName}`
        : user.staffProfile
          ? `${user.staffProfile.firstName} ${user.staffProfile.lastName}`
          : user.email;
  return {
    userId: user.id,
    role: user.role as Role,
    email: user.email,
    displayName,
    patientId: user.patientProfile?.id,
    doctorId: user.doctorProfile?.id,
    staffId: user.staffProfile?.id,
    twoFactorPending,
  };
}

// ── 2FA TOTP (obbligatoria per medici e admin) ──

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpUri(email: string, secretPlain: string): string {
  return authenticator.keyuri(email, 'Cartella Intelligente', secretPlain);
}

export function verifyTotp(secretEnc: string, code: string): boolean {
  const plain = decryptField(secretEnc);
  if (!plain) return false;
  try {
    return authenticator.verify({ token: code.replace(/\s/g, ''), secret: plain });
  } catch {
    return false;
  }
}

export function encryptTotpSecret(plain: string): string {
  return encryptField(plain);
}

export function needsTwoFactor(role: string): boolean {
  // Bypass di SVILUPPO: con DISABLE_2FA=true in .env si entra con sola password.
  // In produzione questa variabile NON va impostata: la 2FA resta obbligatoria per medici e admin.
  if (process.env.DISABLE_2FA === 'true') return false;
  return role === ROLES.DOCTOR || role === ROLES.ADMIN;
}
