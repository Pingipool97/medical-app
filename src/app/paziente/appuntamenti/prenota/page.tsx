import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtEuro } from '@/lib/format';
import { BackLink, Card, EmptyState, PageTitle } from '@/components/ui';
import { BookingFlow } from './booking';

export const dynamic = 'force-dynamic';

export default async function PrenotaPage() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');

  const links = await db.doctorPatientLink.findMany({
    where: { patientId: session.patientId, status: 'ACTIVE' },
    include: { doctor: { include: { services: { where: { active: true }, orderBy: { name: 'asc' } } } } },
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <BackLink href="/paziente/appuntamenti" label="Torna agli appuntamenti" />
      <PageTitle
        title="Prenota una visita"
        subtitle="Scegli il medico, la prestazione e l'orario che preferisci."
      />

      {links.length === 0 ? (
        <Card>
          <EmptyState
            title="Non hai medici collegati"
            hint="Per prenotare online devi prima collegarti a un medico."
            action={<Link href="/paziente/medici" className="btn-primary">Trova un medico</Link>}
          />
        </Card>
      ) : (
        <Card>
          <BookingFlow
            doctors={links.map((l) => ({
              id: l.doctorId,
              label: `Dr. ${l.doctor.firstName} ${l.doctor.lastName}`,
              services: l.doctor.services.map((s) => ({
                id: s.id,
                name: s.name,
                durationMin: s.durationMin,
                priceLabel: s.priceCents > 0 ? fmtEuro(s.priceCents) : 'prezzo da concordare',
                mode: s.mode,
              })),
            }))}
          />
        </Card>
      )}
    </div>
  );
}
