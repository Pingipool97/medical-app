// Crea (o riallinea) l'admin del proprietario sul database puntato da DATABASE_URL.
//
// La password NON sta qui dentro e non deve mai starci: questo file finisce su git,
// e una password in chiaro in un repository e' una password bruciata. Si passa da
// variabile d'ambiente, che resta nel .env (ignorato da git) o solo nel terminale.
//
//   OWNER_ADMIN_EMAIL=tua@email.it OWNER_ADMIN_PASSWORD='...' npx tsx scripts/create-owner-admin.ts
//
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const db = new PrismaClient();
const EMAIL = process.env.OWNER_ADMIN_EMAIL?.toLowerCase().trim();
const PASSWORD = process.env.OWNER_ADMIN_PASSWORD;

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('Servono OWNER_ADMIN_EMAIL e OWNER_ADMIN_PASSWORD. Esempio:');
    console.error("  OWNER_ADMIN_EMAIL=tua@email.it OWNER_ADMIN_PASSWORD='...' npx tsx scripts/create-owner-admin.ts");
    process.exitCode = 1;
    return;
  }
  if (PASSWORD.length < 10) {
    console.error('Password troppo corta: almeno 10 caratteri.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const u = await db.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, role: 'ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date(), twoFactorEnabled: false, twoFactorSecret: null },
    create: { email: EMAIL, passwordHash, role: 'ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date() },
  });
  console.log(`OK  ${u.email}  ruolo=${u.role}  stato=${u.status}`);
}

main().finally(() => db.$disconnect());
