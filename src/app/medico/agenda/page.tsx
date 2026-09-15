import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensurePatientColors, ensureServiceColors } from '@/lib/agenda';
import { dateKey, minutesOfDay, todayKey, fromZoned, shiftMonthKey, startOfMonth } from '@/lib/datetime';
import { fmtDate } from '@/lib/format';

import { Card, PageTitle, EmptyState, Badge } from '@/components/ui';
import type { CalEvent } from '@/components/calendar';
import AgendaClient, {
  AvailabilityForm,
  DeleteAvailabilityButton,
  ExceptionForm,
  DeleteExceptionButton,
  CreateServiceForm,
  EditServiceForm,
  ToggleServiceButton,
} from './agenda-client';

export const dynamic = 'force-dynamic';

const WEEKDAY_LABEL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

export default async function AgendaPage() {
  const session = await getSession();
  if (!session || session.role !== 'DOCTOR' || !session.doctorId) redirect('/login');
  const doctorId = session.doctorId;

  // Prestazioni e pazienti hanno un colore stabile: senza, l'agenda è un muro monocromo.
  await Promise.all([ensureServiceColors(doctorId), ensurePatientColors(doctorId)]);

  const today = todayKey();
  // Finestra ampia: il calendario naviga lato client senza tornare al server.
  const from = fromZoned(startOfMonth(shiftMonthKey(today, -1)), '00:00');
  const to = fromZoned(startOfMonth(shiftMonthKey(today, 3)), '00:00');

  const [appts, links, avails, exceptions, services] = await Promise.all([
    db.appointment.findMany({
      where: { doctorId, startsAt: { gte: from, lt: to } },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        service: { select: { id: true, name: true, color: true } },
      },
      orderBy: { startsAt: 'asc' },
    }),
    db.doctorPatientLink.findMany({
      where: { doctorId, status: 'ACTIVE' },
      include: { patient: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    db.availability.findMany({ where: { doctorId }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] }),
    db.availabilityException.findMany({
      where: { doctorId, date: { gte: fromZoned(today, '00:00') } },
      orderBy: { date: 'asc' },
    }),
    db.serviceCatalog.findMany({ where: { doctorId }, orderBy: { name: 'asc' } }),
  ]);

  const colorByPatient = new Map(links.map((l) => [l.patientId, l.color]));

  // Il fuso si risolve qui, una volta sola: il client riceve giorno e minuti già pronti.
  const events: CalEvent[] = appts.map((a) => ({
    id: a.id,
    day: dateKey(a.startsAt),
    startMin: minutesOfDay(a.startsAt),
    endMin: minutesOfDay(a.endsAt) || 24 * 60,
    title: `${a.patient.lastName} ${a.patient.firstName}`,
    subtitle: [a.service?.name, a.mode === 'VIDEO' ? 'Video' : null].filter(Boolean).join(' · ') || undefined,
    colors: { service: a.service?.color ?? null, patient: colorByPatient.get(a.patientId) ?? null },
    status: a.status,
    href: `/medico/pazienti/${a.patientId}`,
    mode: a.mode,
  }));

  const patients = links.map((l) => ({
    id: l.patientId,
    name: `${l.patient.lastName} ${l.patient.firstName}`,
    color: l.color ?? 'indigo',
  }));

  const upcoming = appts
    .filter((a) => a.startsAt.getTime() >= Date.now() && (a.status === 'PRENOTATO' || a.status === 'CONFERMATO'))
    .slice(0, 5);

  return (
    <>
      <PageTitle title="Agenda" subtitle="Calendario appuntamenti, disponibilità e prestazioni." />

      <div className="space-y-4">
        <AgendaClient
          events={events}
          today={today}
          patients={patients}
          services={services.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, mode: s.mode, color: s.color ?? 'indigo' }))}
          upcoming={upcoming.map((a) => ({
            id: a.id,
            status: a.status,
            when: `${fmtDate(a.startsAt)} · ${String(Math.floor(minutesOfDay(a.startsAt) / 60)).padStart(2, '0')}:${String(minutesOfDay(a.startsAt) % 60).padStart(2, '0')}`,
            patient: `${a.patient.lastName} ${a.patient.firstName}`,
            patientId: a.patientId,
            service: a.service?.name ?? null,
            notes: a.doctorNotes ?? '',
          }))}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Disponibilità settimanali">
            {avails.length === 0 ? (
              <EmptyState title="Nessuna fascia impostata" hint="Senza disponibilità i pazienti non possono prenotare online." />
            ) : (
              <ul className="divide-y divide-slate-100 mb-4">
                {avails.map((a) => (
                  <li key={a.id} className="py-2 flex items-center justify-between text-sm">
                    <span>
                      <span className="font-medium">{WEEKDAY_LABEL[a.weekday]}</span>{' '}
                      <span className="text-slate-600 tabular-nums">{a.startTime}–{a.endTime}</span>
                    </span>
                    <DeleteAvailabilityButton id={a.id} />
                  </li>
                ))}
              </ul>
            )}
            <AvailabilityForm />
          </Card>

          <Card title="Chiusure ed eccezioni">
            {exceptions.length === 0 ? (
              <p className="text-sm text-slate-500 mb-4">Nessuna chiusura programmata.</p>
            ) : (
              <ul className="divide-y divide-slate-100 mb-4">
                {exceptions.map((e) => (
                  <li key={e.id} className="py-2 flex items-center justify-between text-sm">
                    <span>
                      <span className="font-medium">{fmtDate(e.date)}</span>
                      {e.reason && <span className="text-slate-600"> — {e.reason}</span>}
                    </span>
                    <DeleteExceptionButton id={e.id} />
                  </li>
                ))}
              </ul>
            )}
            <ExceptionForm />
          </Card>
        </div>

        <Card title="Catalogo prestazioni">
          {services.length === 0 ? (
            <EmptyState title="Nessuna prestazione" hint="Servono per far prenotare i pazienti e per calcolare la durata degli appuntamenti." />
          ) : (
            <ul className="divide-y divide-slate-100 mb-4">
              {services.map((s) => (
                <li key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-slate-600"> · {s.durationMin} min · {(s.priceCents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
                    {!s.active && <Badge color="gray">Disattivata</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <EditServiceForm service={{ id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents, mode: s.mode }} />
                    <ToggleServiceButton id={s.id} active={s.active} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <CreateServiceForm />
        </Card>
      </div>
    </>
  );
}
