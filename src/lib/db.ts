import { PrismaClient } from '@prisma/client';

// Client Prisma verso PostgreSQL (Supabase).
//
// Il singleton è attivo anche in produzione, non solo in sviluppo: su serverless ogni
// modulo che importasse questo file aprirebbe altrimenti una connessione nuova, e il
// pooler di Supabase (15 connessioni sul piano Nano) si esaurirebbe in fretta.
// L'URL runtime punta al pooler in transaction mode; le migration usano DIRECT_URL,
// letto direttamente da Prisma CLI tramite `directUrl` nello schema.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

globalForPrisma.prisma = db;
