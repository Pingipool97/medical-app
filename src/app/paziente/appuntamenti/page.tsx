import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { APPOINTMENT_STATUS_LABEL } from '@/lib/constants';
import { Badge, Card, EmptyState, PageTitle, statusBadgeColor } from '@/components/ui';
import { CancelAppointmentForm, JoinWaitlistForm } from './client';

export const dynamic = 'force-dynamic';

export default async function AppuntamentiPage() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');
  const patientId = session.patientId;

  const now = new Date();
  const [upcoming, past, links, waitlist] = await Promise.all([
    db.appointment.findMany({
      where: { patientId, startsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
      include: { doctor: true, service: true },
    }),
    db.appointment.findMany({
      where: { patientId, startsAt: { lt: now } },
      orderBy: { startsAt: 'desc' },
      take: 30,
      include: { doctor: true, service: true },
    }),
    db.doctorPatientLink.findMany({
      where: { patientId, status: 'ACTIVE' },
      include: { doctor: { include: { services: { where: { active: true } } } } },
    }),
    db.waitlistEntry.findMany({
      where: { patientId },
      include: { doctor: true, service: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageTitle
        title="I tuoi appuntamenti"
        subtitle="Prossime visite, storico e lista d'attesa."
        action={<Link href="/paziente/appuntamenti/prenota" className="btn-primary">＋ Prenota una visita</Link>}
      />

      <Card title="Prossimi appuntamenti">
        {upcoming.length === 0 ? (
          <EmptyState
            title="Nessun appuntamento in programma"
            action={<Link href="/paziente/appuntamenti/prenota" className="btn-primary">Prenota una visita</Link>}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {upcoming.map((a) => (
              <li key={a.id} className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {a.service?.name ?? 'Visita'} — Dr. {a.doctor.firstName} {a.doctor.lastName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {fmtDateTime(a.startsAt)} · {a.mode === 'VIDEO' ? 'In videoconsulto' : 'In presenza'}
                    </p>
                    {a.status === 'ANNULLATO' && a.cancelReason && (
                      <p className="text-xs text-slate-500">Motivo: {a.cancelReason}</p>
                    )}
                  </div>
                  <Badge color={statusBadgeColor(a.status)}>{APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}</Badge>
                </div>
                {(a.status === 'PRENOTATO' || a.status === 'CONFERMATO') && (
                  <CancelAppointmentForm appointmentId={a.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Lista d'attesa" >
        <p className="text-sm text-slate-600 mb-3">
          Se non trovi posto, mettiti in lista: ti avviseremo appena si libera uno slot.
        </p>
        {waitlist.length > 0 && (
          <ul className="mb-4 divide-y divide-slate-100">
            {waitlist.map((w) => (
              <li key={w.id} className="py-2 text-sm text-slate-700">
                Dr. {w.doctor.firstName} {w.doctor.lastName}
                {w.service ? ` — ${w.service.name}` : ' — qualsiasi prestazione'}
                <span className="text-xs text-slate-500"> · in lista dal {fmtDate(w.createdAt)}{w.notifiedAt ? ` · avvisato il ${fmtDate(w.notifiedAt)}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
        {links.length === 0 ? (
          <p className="text-sm text-slate-500">Collega prima un medico dalla sezione <Link href="/paziente/medici" className="text-brand-700 hover:underline">I miei medici</Link>.</p>
        ) : (
          <JoinWaitlistForm
            doctors={links.map((l) => ({
              id: l.doctorId,
              label: `Dr. ${l.doctor.firstName} ${l.doctor.lastName}`,
              services: l.doctor.services.map((s) => ({ id: s.id, label: s.name })),
            }))}
          />
        )}
      </Card>

      <Card title="Appuntamenti passati">
        {past.length === 0 ? (
          <EmptyState title="Nessun appuntamento passato" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {past.map((a) => (
              <li key={a.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {a.service?.name ?? 'Visita'} — Dr. {a.doctor.firstName} {a.doctor.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{fmtDateTime(a.startsAt)}</p>
                </div>
                <Badge color={statusBadgeColor(a.status)}>{APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
