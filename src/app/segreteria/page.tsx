import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { APPOINTMENT_STATUS_LABEL } from '@/lib/constants';
import { Alert, Badge, Card, EmptyState, PageTitle, statusBadgeColor } from '@/components/ui';
import { StaffCancelButton } from './cancel-button';

export const dynamic = 'force-dynamic';

const SCOPE_LABEL: Record<string, string> = {
  AGENDA: 'Agenda',
  ANAGRAFICA: 'Anagrafica',
  CLINICO: 'Accesso clinico',
};

export default async function SegreteriaPage() {
  const session = await getSession();
  if (!session || session.role !== 'STAFF' || !session.staffId) redirect('/login');

  const staff = await db.staffProfile.findUnique({
    where: { id: session.staffId },
    include: { doctor: true },
  });
  if (!staff) redirect('/login');

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 14 * 86400_000);

  // SOLO dati di agenda: nome paziente, prestazione, orario. Nessun dato clinico.
  const [appointments, delegations] = await Promise.all([
    db.appointment.findMany({
      where: { doctorId: staff.doctorId, startsAt: { gte: start, lt: end } },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        mode: true,
        status: true,
        patient: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
    }),
    db.staffDelegation.findMany({
      where: { staffId: staff.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
    }),
  ]);

  // Nomi dei pazienti per le deleghe cliniche (solo elenco: il resto è fuori perimetro)
  const delegatedPatientIds = delegations.map((d) => d.patientId).filter((id): id is string => !!id);
  const delegatedPatients = delegatedPatientIds.length
    ? await db.patientProfile.findMany({
        where: { id: { in: delegatedPatientIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const patientName = new Map(delegatedPatients.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));

  // Raggruppa per giorno
  const byDay = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const key = a.startsAt.toISOString().slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), a]);
  }
  const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-5">
      <PageTitle
        title={`Agenda — Dr. ${staff.doctor.firstName} ${staff.doctor.lastName}`}
        subtitle="Vista di segreteria: appuntamenti dei prossimi 14 giorni, in sola lettura con possibilità di annullo."
      />

      <Alert kind="info">
        Questa vista mostra solo nome del paziente, prestazione e orario.{' '}
        <strong>L’accesso ai contenuti clinici richiede delega esplicita del medico.</strong>
      </Alert>

      <Card title="Appuntamenti (prossimi 14 giorni)">
        {days.length === 0 ? (
          <EmptyState title="Nessun appuntamento in agenda" />
        ) : (
          <div className="space-y-5">
            {days.map(([day, appts]) => (
              <div key={day}>
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2 capitalize">
                  {new Date(day + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}
                </h3>
                <ul className="divide-y divide-slate-100">
                  {appts.map((a) => (
                    <li key={a.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {a.startsAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {a.endsAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}{a.patient.firstName} {a.patient.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {a.service?.name ?? 'Visita'} · {a.mode === 'VIDEO' ? 'Videoconsulto' : 'In presenza'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color={statusBadgeColor(a.status)}>{APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}</Badge>
                        {(a.status === 'PRENOTATO' || a.status === 'CONFERMATO') && <StaffCancelButton appointmentId={a.id} />}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Deleghe attive">
        {delegations.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nessuna delega attiva. Il medico può concederti deleghe esplicite e a scadenza (agenda, anagrafica o accesso clinico su singolo paziente).
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {delegations.map((d) => (
              <li key={d.id} className="py-2.5 text-sm flex items-center justify-between gap-2 flex-wrap">
                <span>
                  <Badge color={d.scope === 'CLINICO' ? 'violet' : 'blue'}>{SCOPE_LABEL[d.scope] ?? d.scope}</Badge>{' '}
                  {d.patientId
                    ? `Paziente: ${patientName.get(d.patientId) ?? 'n.d.'}`
                    : 'Delega generale (non clinica)'}
                </span>
                <span className="text-xs text-slate-500">valida fino al {fmtDate(d.expiresAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
