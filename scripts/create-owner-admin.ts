// Crea (o riallinea) l'admin del proprietario sul database puntato da DATABASE_URL.
// Eseguire con: npx tsx scripts/create-owner-admin.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const db = new PrismaClient();
const EMAIL = 'acumeartificialintelligence@gmail.com';
const PASSWORD = 'Acume.2026';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const u = await db.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, role: 'ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date(), twoFactorEnabled: false, twoFactorSecret: null },
    create: { email: EMAIL, passwordHash, role: 'ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date() },
  });
  console.log(`OK  ${u.email}  ruolo=${u.role}  stato=${u.status}  2fa=${u.twoFactorEnabled}`);
}

main().finally(() => db.$disconnect());
