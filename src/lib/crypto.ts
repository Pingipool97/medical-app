// Cifratura a campo AES-256-GCM per i dati più sensibili (CF, telefoni, chiavi API, segreti 2FA)
// e cifratura dei file documento a riposo. La chiave sta in APP_ENCRYPTION_KEY (.env),
// in produzione va in un KMS/secret manager.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function key(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error('APP_ENCRYPTION_KEY mancante o non valida (64 hex chars)');
  return Buffer.from(hex, 'hex');
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptField(stored: string | null | undefined): string {
  if (!stored) return '';
  try {
    const [v, ivB, tagB, dataB] = stored.split(':');
    if (v !== 'v1') return '';
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function encryptBuffer(buf: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([Buffer.from('EF1'), iv, cipher.getAuthTag(), enc]);
}

export function decryptBuffer(stored: Buffer): Buffer {
  const magic = stored.subarray(0, 3).toString();
  if (magic !== 'EF1') return stored; // file legacy non cifrato
  const iv = stored.subarray(3, 15);
  const tag = stored.subarray(15, 31);
  const data = stored.subarray(31);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

// Hash deterministico per lookup di campi cifrati (es. codice fiscale)
export function lookupHash(value: string): string {
  return createHash('sha256').update(process.env.APP_ENCRYPTION_KEY + '|' + value.toUpperCase().trim()).digest('hex');
}

// Maschera per la UI admin: mai mostrare la chiave intera
export function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 8) return '••••••';
  return secret.slice(0, 4) + '••••••••' + secret.slice(-4);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
