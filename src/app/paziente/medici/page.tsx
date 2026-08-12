import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { Badge, Card, EmptyState, PageTitle } from '@/components/ui';
import { RevokeLinkButton, ConnectDoctorForm } from './client';

export const dynamic = 'force-dynamic';

export default async function MediciPage() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');
  const patientId = session.patientId;

  const links = await db.doctorPatientLink.findMany({
    where: { patientId },
    include: { doctor: { include: { specializations: { include: { specialization: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  const active = links.filter((l) => l.status === 'ACTIVE');
  const pending = links.filter((l) => l.status === 'PENDING');
  const knownDoctorIds = links.filter((l) => l.status === 'ACTIVE' || l.status === 'PENDING').map((l) => l.doctorId);

  const findable = await db.doctorProfile.findMany({
    where: { verificationStatus: 'VERIFIED', id: { notIn: knownDoctorIds } },
    include: { specializations: { include: { specialization: true } } },
    orderBy: { lastName: 'asc' },
  });

  const specList = (d: { specializations: { specialization: { name: string } }[] }) =>
    d.specializations.map((s) => s.specialization.name).join(', ') || 'Specializzazione non indicata';

  return (
    <div className="space-y-5">
      <PageTitle
        title="I miei medici"
        subtitle="Nessun medico vede i tuoi dati senza il tuo consenso: il collegamento va accettato da entrambi."
      />

      <Card title="Medici collegati">
        {active.length === 0 ? (
          <EmptyState title="Nessun medico collegato" hint="Cerca il tuo medico qui sotto e chiedi il collegamento." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {active.map((l) => (
              <li key={l.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Dr. {l.doctor.firstName} {l.doctor.lastName} <Badge color="green">Collegato</Badge>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{specList(l.doctor)}</p>
                  <p className="text-xs text-slate-500">
                    Risponde entro {l.doctor.responseTimeHours} ore
                    {l.acceptedAt ? ` · collegati dal ${fmtDate(l.acceptedAt)}` : ''}
                    {l.doctor.structureName ? ` · ${l.doctor.structureName}` : ''}
                  </p>
                </div>
                <RevokeLinkButton linkId={l.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pending.length > 0 && (
        <Card title="Richieste in attesa">
          <ul className="divide-y divide-slate-100">
            {pending.map((l) => (
              <li key={l.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Dr. {l.doctor.firstName} {l.doctor.lastName}</p>
                  <p className="text-xs text-slate-500">{specList(l.doctor)} · richiesta inviata il {fmtDate(l.createdAt)}</p>
                </div>
                <Badge color="amber">In attesa del medico</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Trova un medico">
        <p className="text-sm text-slate-600 mb-3">
          Qui compaiono solo medici la cui identità è stata verificata dalla piattaforma. Il medico dovrà accettare la tua richiesta prima di vedere i tuoi dati.
        </p>
        {findable.length === 0 ? (
          <EmptyState title="Nessun altro medico disponibile al momento" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {findable.map((d) => (
              <li key={d.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Dr. {d.firstName} {d.lastName} <Badge color="green">Verificato</Badge>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{specList(d)}</p>
                  {d.structureName && <p className="text-xs text-slate-500">{d.structureName}</p>}
                  {d.bio && <p className="text-xs text-slate-600 mt-1 max-w-xl">{d.bio}</p>}
                </div>
                <ConnectDoctorForm doctorId={d.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
