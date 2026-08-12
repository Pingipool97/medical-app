import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { BackLink, Card, EmergencyBanner, EmptyState, PageTitle } from '@/components/ui';
import { NewRequestForm } from './form';

export const dynamic = 'force-dynamic';

export default async function NuovaRichiestaPage() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');
  const patientId = session.patientId;

  const [links, types, documents] = await Promise.all([
    db.doctorPatientLink.findMany({
      where: { patientId, status: 'ACTIVE' },
      include: { doctor: true },
    }),
    db.requestTypeDef.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    db.document.findMany({
      where: { patientId, deletedAt: null },
      orderBy: [{ docDate: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-5 max-w-2xl">
      <BackLink href="/paziente/richieste" label="Torna alle richieste" />
      <PageTitle
        title="Nuova richiesta al medico"
        subtitle="Ricette, certificati, informazioni: descrivi cosa ti serve e il medico ti risponderà."
      />

      <EmergencyBanner />

      {links.length === 0 ? (
        <Card>
          <EmptyState
            title="Non hai medici collegati"
            hint="Per inviare una richiesta devi prima collegarti a un medico."
            action={<Link href="/paziente/medici" className="btn-primary">Trova un medico</Link>}
          />
        </Card>
      ) : (
        <Card>
          <NewRequestForm
            doctors={links.map((l) => ({
              id: l.doctorId,
              label: `Dr. ${l.doctor.firstName} ${l.doctor.lastName} — risponde entro ${l.doctor.responseTimeHours} ore`,
            }))}
            types={types.map((t) => ({ value: t.code, label: t.name }))}
            documents={documents.map((d) => ({
              id: d.id,
              label: `${d.title}${d.docDate ? ` (${fmtDate(d.docDate)})` : ''}`,
            }))}
          />
        </Card>
      )}
    </div>
  );
}
