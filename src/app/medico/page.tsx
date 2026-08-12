import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { REQUEST_STATUS_LABEL, APPOINTMENT_STATUS_LABEL } from '@/lib/constants';
import { Badge, Card, EmptyState, PageTitle, statusBadgeColor } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function MedicoDashboard() {
  const session = await getSession();
  if (!session?.doctorId) redirect('/login');
  const doctorId = session.doctorId;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 86400_000);

  const [newRequests, pendingDrafts, todayAppointments, pendingLinks, lastRequests] = await Promise.all([
    db.serviceRequest.count({ where: { doctorId, status: 'NUOVA' } }),
    db.aiOutput.count({ where: { state: 'DRAFT', job: { requestedById: session.userId } } }),
    db.appointment.findMany({
      where: { doctorId, startsAt: { gte: todayStart, lt: todayEnd }, status: { in: ['PRENOTATO', 'CONFERMATO'] } },
      orderBy: { startsAt: 'asc' },
      include: { patient: true, service: true },
    }),
    db.doctorPatientLink.count({ where: { doctorId, status: 'PENDING' } }),
    db.serviceRequest.findMany({
      where: { doctorId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { patient: true },
    }),
  ]);

  const counters = [
    { label: 'Richieste nuove', value: newRequests, href: '/medico/richieste?stato=NUOVA', accent: newRequests > 0 },
    { label: 'Bozze IA da revisionare', value: pendingDrafts, href: '/medico/bozze-ia', accent: pendingDrafts > 0 },
    { label: 'Appuntamenti oggi', value: todayAppointments.length, href: '/medico/agenda', accent: false },
    { label: 'Collegamenti in attesa', value: pendingLinks, href: '/medico/pazienti', accent: pendingLinks > 0 },
  ];

  return (
    <div className="space-y-5">
      <PageTitle title={`Buongiorno, ${session.displayName}`} subtitle="Il quadro della giornata: richieste, bozze da revisionare e appuntamenti." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {counters.map((c) => (
          <Link key={c.label} href={c.href} className="card p-4 hover:border-brand-400 transition-colors">
            <p className={`text-3xl font-bold ${c.accent ? 'text-brand-700' : 'text-slate-800'}`}>{c.value}</p>
            <p className="text-sm text-slate-600 mt-1">{c.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Appuntamenti di oggi" action={<Link href="/medico/agenda" className="text-sm text-brand-700 hover:underline">Vai all’agenda</Link>}>
          {todayAppointments.length === 0 ? (
            <EmptyState title="Nessun appuntamento per oggi" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {todayAppointments.map((a) => (
                <li key={a.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <Link href={`/medico/pazienti/${a.patientId}`} className="text-sm font-medium text-brand-700 hover:underline">
                      {a.patient.firstName} {a.patient.lastName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {a.startsAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · {a.service?.name ?? 'Visita'} · {a.mode === 'VIDEO' ? 'Videoconsulto' : 'In presenza'}
                    </p>
                  </div>
                  <Badge color={statusBadgeColor(a.status)}>{APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Ultime richieste" action={<Link href="/medico/richieste" className="text-sm text-brand-700 hover:underline">Vedi tutte</Link>}>
          {lastRequests.length === 0 ? (
            <EmptyState title="Nessuna richiesta ricevuta" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {lastRequests.map((r) => (
                <li key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {r.redFlag && <span className="text-red-700 font-bold" title="Sintomi d’allarme rilevati">⚠️ </span>}
                      {r.subject}
                    </p>
                    <p className="text-xs text-slate-500">{r.patient.firstName} {r.patient.lastName} · {fmtDate(r.createdAt)}</p>
                  </div>
                  <Badge color={statusBadgeColor(r.status)}>{REQUEST_STATUS_LABEL[r.status] ?? r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
