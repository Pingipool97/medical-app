import { copyFileSync, existsSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Demo su Vercel: il filesystem è in sola lettura tranne /tmp, ma l'app scrive sul DB
// anche solo per fare login (lastLoginAt, tentativi falliti). Il file `prisma/dev.db`
// viaggia nel repo e viene copiato in /tmp alla prima query dell'istanza serverless.
// Conseguenza voluta: i dati inseriti online vivono quanto l'istanza, poi si torna al seed.
// In locale non cambia nulla: si continua a usare DATABASE_URL dal .env.
const TMP_DB = '/tmp/dev.db';

function resolveDatabaseUrl(): string | undefined {
  if (!process.env.VERCEL) return undefined; // locale: decide DATABASE_URL
  if (!existsSync(TMP_DB)) {
    copyFileSync(path.join(process.cwd(), 'prisma', 'dev.db'), TMP_DB);
  }
  return `file:${TMP_DB}`;
}

const datasourceUrl = resolveDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
