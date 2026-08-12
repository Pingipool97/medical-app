import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { patientsOfDoctor } from '@/lib/access';
import { ageFrom, fmtDate } from '@/lib/format';
import { Alert, Badge, Card, EmptyState, PageTitle } from '@/components/ui';
import { LinkResponseButtons } from './link-client';

export const dynamic = 'force-dynamic';

export default async function PazientiPage() {
  const session = await getSession();
  if (!session?.doctorId) redirect('/login');
  const doctorId = session.doctorId;

  const [doctor, patients, pendingLinks] = await Promise.all([
    db.doctorProfile.findUnique({ where: { id: doctorId } }),
    patientsOfDoctor(doctorId),
    db.doctorPatientLink.findMany({
      where: { doctorId, status: 'PENDING' },
      include: { patient: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const verificationPending = doctor?.verificationStatus !== 'VERIFIED';

  // Ultimo evento della timeline per ciascun paziente
  const lastEvents = await Promise.all(
    patients.map((p) =>
      db.timelineEvent.findFirst({ where: { patientId: p.id }, orderBy: { date: 'desc' } })
    )
  );

  return (
    <div className="space-y-5">
      <PageTitle title="I miei pazienti" subtitle="Vedi solo i pazienti che hanno attivato un collegamento con te." />

      {pendingLinks.length > 0 && (
        <Card title={`Richieste di collegamento in attesa (${pendingLinks.length})`}>
          {verificationPending && (
            <div className="mb-3">
              <Alert kind="warn">Account in verifica: potrai accettare pazienti solo a verifica conclusa.</Alert>
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {pendingLinks.map((l) => (
              <li key={l.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-slate-800">{l.patient.firstName} {l.patient.lastName}</p>
                  <p className="text-xs text-slate-500">
                    {ageFrom(l.patient.birthDate)} anni · richiesta del {fmtDate(l.createdAt)} · inviata da {l.requestedBy === 'PATIENT' ? 'paziente' : 'medico'}
                  </p>
                </div>
                <LinkResponseButtons linkId={l.id} disabled={verificationPending} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={`Pazienti attivi (${patients.length})`}>
        {patients.length === 0 ? (
          <EmptyState
            title="Nessun paziente collegato"
            hint="Un paziente diventa visibile qui solo dopo che entrambi avete confermato il collegamento."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {patients.map((p, i) => {
              const ev = lastEvents[i];
              return (
                <li key={p.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-[240px]">
                    <Link href={`/medico/pazienti/${p.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                      {p.firstName} {p.lastName}
                    </Link>
                    <span className="text-xs text-slate-500 ml-2">{ageFrom(p.birthDate)} anni</span>
                    {p.allergies.length > 0 && (
                      <span className="ml-2 text-xs font-bold text-red-700" title={p.allergies.map((a) => a.allergen).join(', ')}>
                        ⚠️ {p.allergies.length} allergi{p.allergies.length === 1 ? 'a' : 'e'}
                      </span>
                    )}
                    {p.pregnancy?.isPregnant && <Badge color="amber">Gravidanza</Badge>}
                    {p.pregnancy?.isBreastfeeding && <Badge color="amber">Allattamento</Badge>}
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ultimo evento: {ev ? `${ev.title} (${fmtDate(ev.date)})` : 'nessuno registrato'}
                    </p>
                  </div>
                  <Link href={`/medico/pazienti/${p.id}`} className="btn-secondary !py-1.5 text-xs">Apri cartella</Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
