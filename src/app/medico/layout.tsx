import AppShell from '@/components/AppShell';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function MedicoLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.doctorId) redirect('/login');
  const doctor = await db.doctorProfile.findUnique({ where: { id: session.doctorId } });

  return (
    <AppShell role="DOCTOR">
      {doctor?.verificationStatus === 'PENDING' && (
        <div className="alert-critical mb-5" role="alert">
          <strong>Account in verifica:</strong> non puoi emettere documenti né accettare pazienti finché
          l’amministrazione non conferma la tua iscrizione all’Ordine. Riceverai una notifica a verifica conclusa.
        </div>
      )}
      {doctor?.verificationStatus === 'REJECTED' && (
        <div className="alert-critical mb-5" role="alert">
          <strong>Verifica non superata:</strong> {doctor.verificationNote || 'contatta l’amministrazione per maggiori informazioni.'}
        </div>
      )}
      {children}
    </AppShell>
  );
}
