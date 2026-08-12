'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  buildSessionPayload, clientInfo, createSession, destroySession, encryptTotpSecret,
  generateTotpSecret, getSession, hashPassword, needsTwoFactor, totpUri, verifyCredentials, verifyTotp,
} from '@/lib/auth';
import { encryptField, lookupHash } from '@/lib/crypto';
import { cfMatchesBirth, validateCodiceFiscale } from '@/lib/cf';
import { audit } from '@/lib/audit';
import { flagEnabled } from '@/lib/settings';
import { FEATURE_FLAGS } from '@/lib/constants';

export type ActionState = { error?: string; success?: string } | null;

function dest(role: string) {
  return { PATIENT: '/paziente', CAREGIVER: '/paziente', DOCTOR: '/medico', ADMIN: '/admin', STAFF: '/segreteria' }[role] ?? '/';
}

// ── Login ──

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Inserisci email e password.' };

  const res = await verifyCredentials(email, password);
  if (!res.ok) return { error: res.error };
  const user = res.user;

  if (await flagEnabled(FEATURE_FLAGS.MANUTENZIONE) && user.role !== 'ADMIN') {
    return { error: 'La piattaforma è in manutenzione. Riprova più tardi.' };
  }

  const { ip, userAgent } = clientInfo();
  const twoFa = needsTwoFactor(user.role);
  await createSession(buildSessionPayload(user, twoFa));
  await audit({ actorUserId: user.id, actorRole: user.role, action: 'LOGIN', ip, userAgent });

  if (twoFa) redirect('/verifica-2fa');
  redirect(dest(user.role));
}

export async function logoutAction() {
  const s = await getSession();
  if (s) await audit({ actorUserId: s.userId, actorRole: s.role, action: 'LOGOUT' });
  destroySession();
  redirect('/login');
}

// ── 2FA (obbligatoria per medici e admin) ──

export async function verify2faAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await getSession();
  if (!s) redirect('/login');
  const code = String(formData.get('code') ?? '');
  const user = await db.user.findUnique({ where: { id: s.userId }, include: { patientProfile: true, doctorProfile: true, staffProfile: true } });
  if (!user) redirect('/login');

  if (!user.twoFactorEnabled) {
    // Primo accesso: setup — il segreto proposto è in sessione? No: lo rigeneriamo dal form
    const secret = String(formData.get('secret') ?? '');
    if (!secret || !code) return { error: 'Inserisci il codice generato dall’app di autenticazione.' };
    const { authenticator } = await import('otplib');
    if (!authenticator.verify({ token: code.replace(/\s/g, ''), secret })) {
      return { error: 'Codice non valido. Controlla l’app e riprova.' };
    }
    await db.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: encryptTotpSecret(secret), twoFactorEnabled: true },
    });
  } else {
    if (!user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, code)) {
      await audit({ actorUserId: user.id, action: 'LOGIN_2FA_FAIL' });
      return { error: 'Codice non valido. Riprova.' };
    }
  }
  await createSession(buildSessionPayload(user, false));
  await audit({ actorUserId: user.id, actorRole: user.role, action: 'LOGIN_2FA_OK' });
  redirect(dest(user.role));
}

export async function get2faSetup(): Promise<{ enabled: boolean; secret?: string; uri?: string; email?: string }> {
  const s = await getSession();
  if (!s) redirect('/login');
  const user = await db.user.findUnique({ where: { id: s.userId } });
  if (!user) redirect('/login');
  if (user.twoFactorEnabled) return { enabled: true };
  const secret = generateTotpSecret();
  return { enabled: false, secret, uri: totpUri(user.email, secret), email: user.email };
}

// ── Registrazione paziente ──

const patientSchema = z.object({
  firstName: z.string().min(2, 'Nome troppo corto'),
  lastName: z.string().min(2, 'Cognome troppo corto'),
  email: z.string().email('Email non valida'),
  password: z.string().min(10, 'La password deve avere almeno 10 caratteri').regex(/[A-Z]/, 'Serve almeno una maiuscola').regex(/[0-9]/, 'Serve almeno un numero'),
  birthDate: z.string().min(10, 'Data di nascita obbligatoria'),
  biologicalSex: z.enum(['M', 'F'], { errorMap: () => ({ message: 'Indica il sesso biologico' }) }),
  codiceFiscale: z.string().length(16, 'Il codice fiscale ha 16 caratteri'),
  phone: z.string().min(9, 'Numero di cellulare obbligatorio'),
});

export async function registerPatientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await flagEnabled(FEATURE_FLAGS.REGISTRAZIONI_APERTE))) {
    return { error: 'Le registrazioni sono momentaneamente chiuse.' };
  }
  const parsed = patientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;

  const cfCheck = validateCodiceFiscale(d.codiceFiscale);
  if (!cfCheck.valid) return { error: cfCheck.error };
  const birth = new Date(d.birthDate);
  const coherence = cfMatchesBirth(d.codiceFiscale, birth, d.biologicalSex);
  if (!coherence.ok) return { error: coherence.error };

  const email = d.email.toLowerCase().trim();
  if (await db.user.findUnique({ where: { email } })) return { error: 'Esiste già un account con questa email.' };
  const cfHash = lookupHash(d.codiceFiscale);
  if (await db.patientProfile.findUnique({ where: { codiceFiscaleHash: cfHash } })) {
    return { error: 'Esiste già un profilo con questo codice fiscale. Se è il tuo, usa il recupero password.' };
  }

  // Consensi obbligatori (art. 9 GDPR): senza spunta esplicita non si procede
  if (formData.get('consenso_privacy') !== 'on' || formData.get('consenso_salute') !== 'on') {
    return { error: 'Per registrarti devi accettare l’informativa privacy e il consenso al trattamento dei dati sanitari.' };
  }

  const { ip } = clientInfo();
  const user = await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(d.password),
      role: 'PATIENT',
      phoneEnc: encryptField(d.phone),
      // OTP telefono ed email di verifica: richiedono provider SMS/email configurati.
      // Senza provider (sviluppo) l'account parte attivo ma marcato non verificato.
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      patientProfile: {
        create: {
          firstName: d.firstName.trim(),
          lastName: d.lastName.trim(),
          birthDate: birth,
          biologicalSex: d.biologicalSex,
          codiceFiscaleEnc: encryptField(d.codiceFiscale.toUpperCase()),
          codiceFiscaleHash: cfHash,
        },
      },
    },
    include: { patientProfile: true },
  });

  // Registrazione consensi accettati
  for (const kind of ['PRIVACY', 'ART9_SALUTE', 'TERMINI'] as const) {
    const v = await db.consentVersion.findFirst({ where: { kind, active: true }, orderBy: { version: 'desc' } });
    if (v) await db.consentRecord.create({ data: { userId: user.id, consentVersionId: v.id, ip } });
  }
  if (formData.get('consenso_ia') === 'on') {
    const v = await db.consentVersion.findFirst({ where: { kind: 'IA_TRATTAMENTO', active: true }, orderBy: { version: 'desc' } });
    if (v) await db.consentRecord.create({ data: { userId: user.id, consentVersionId: v.id, ip } });
  }

  await audit({ actorUserId: user.id, actorRole: 'PATIENT', action: 'REGISTER', ip });
  await createSession(buildSessionPayload(user, false));
  redirect('/paziente/onboarding');
}

// ── Registrazione medico ──

const doctorSchema = z.object({
  firstName: z.string().min(2, 'Nome troppo corto'),
  lastName: z.string().min(2, 'Cognome troppo corto'),
  email: z.string().email('Email non valida'),
  password: z.string().min(10, 'La password deve avere almeno 10 caratteri').regex(/[A-Z]/, 'Serve almeno una maiuscola').regex(/[0-9]/, 'Serve almeno un numero'),
  ordineNumber: z.string().min(3, 'Numero di iscrizione all’Ordine obbligatorio'),
  ordineProvince: z.string().min(2, 'Provincia dell’Ordine obbligatoria'),
  specialization: z.string().min(1, 'Indica almeno una specializzazione'),
  vatNumber: z.string().optional(),
  structureName: z.string().optional(),
});

export async function registerDoctorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await flagEnabled(FEATURE_FLAGS.REGISTRAZIONI_APERTE))) {
    return { error: 'Le registrazioni sono momentaneamente chiuse.' };
  }
  const parsed = doctorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;
  if (formData.get('consenso_privacy') !== 'on') {
    return { error: 'Per registrarti devi accettare l’informativa privacy.' };
  }

  const email = d.email.toLowerCase().trim();
  if (await db.user.findUnique({ where: { email } })) return { error: 'Esiste già un account con questa email.' };

  const spec = await db.specialization.findUnique({ where: { code: d.specialization } });
  const { ip } = clientInfo();
  const user = await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(d.password),
      role: 'DOCTOR',
      status: 'PENDING_VERIFICATION',
      doctorProfile: {
        create: {
          firstName: d.firstName.trim(),
          lastName: d.lastName.trim(),
          ordineNumber: d.ordineNumber.trim(),
          ordineProvince: d.ordineProvince.trim().toUpperCase(),
          vatNumber: d.vatNumber?.trim() || null,
          structureName: d.structureName?.trim() || null,
          verificationStatus: 'PENDING', // nessuna emissione finché l'admin non verifica l'identità professionale
          ...(spec ? { specializations: { create: { specializationId: spec.id } } } : {}),
        },
      },
    },
    include: { doctorProfile: true },
  });
  const v = await db.consentVersion.findFirst({ where: { kind: 'PRIVACY', active: true }, orderBy: { version: 'desc' } });
  if (v) await db.consentRecord.create({ data: { userId: user.id, consentVersionId: v.id, ip } });

  await audit({ actorUserId: user.id, actorRole: 'DOCTOR', action: 'REGISTER', ip });
  await createSession(buildSessionPayload(user, true)); // 2FA obbligatoria da subito
  redirect('/verifica-2fa');
}
