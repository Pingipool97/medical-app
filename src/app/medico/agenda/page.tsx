import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDate, fmtEuro } from '@/lib/format';
import { APPOINTMENT_STATUS_LABEL } from '@/lib/constants';
import { Badge, Card, EmptyState, PageTitle, statusBadgeColor } from '@/components/ui';
import { Icon } from '@/components/icons';
import {
  BriefingButton, CompleteWithNotesForm, CancelAppointmentButton,
  AvailabilityForm, DeleteAvailabilityButton, ExceptionForm,
  CreateServiceForm, EditServiceForm, ToggleServiceButton,
} from './agenda-client';

export const dynamic = 'force-dynamic';

const WEEKDAY_LABEL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MODE_LABEL: Record<string, string> = { PRESENZA: 'Solo in presenza', VIDEO: 'Solo videoconsulto', ENTRAMBI: 'Presenza o video' };

export default async function AgendaPage() {
  const session = await getSession();
  if (!session?.doctorId) redirect('/login');
  const doctorId = session.doctorId;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 14 * 86400_000);

  const [appointments, availabilities, exceptions, services] = await Promise.all([
    db.appointment.findMany({
      where: { doctorId, startsAt: { gte: start, lt: end } },
      orderBy: { startsAt: 'asc' },
      include: { patient: true, service: true },
    }),
    db.availability.findMany({ where: { doctorId }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] }),
    db.availabilityException.findMany({ where: { doctorId, date: { gte: start } }, orderBy: { date: 'asc' } }),
    db.serviceCatalog.findMany({ where: { doctorId }, orderBy: { name: 'asc' } }),
  ]);

  // Raggruppa per giorno
  const byDay = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const key = a.startsAt.toISOString().slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), a]);
  }
  const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-5">
      <PageTitle title="Agenda" subtitle="I prossimi 14 giorni, la gestione delle disponibilità e il catalogo delle prestazioni." />

      <Card title="Appuntamenti (prossimi 14 giorni)">
        {days.length === 0 ? (
          <EmptyState title="Nessun appuntamento in agenda" hint="I pazienti collegati possono prenotare in base alle tue disponibilità." />
        ) : (
          <div className="space-y-5">
            {days.map(([day, appts]) => (
              <div key={day}>
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2 capitalize">
                  {new Date(day + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })}
                </h3>
                <ul className="space-y-3">
                  {appts.map((a) => {
                    let motivo: string | null = null;
                    try { motivo = a.questionnaire ? (JSON.parse(a.questionnaire).motivo ?? null) : null; } catch { motivo = null; }
                    const active = a.status === 'PRENOTATO' || a.status === 'CONFERMATO';
                    return (
                      <li key={a.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {a.startsAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                              {' – '}
                              {a.endsAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                              {' · '}
                              <Link href={`/medico/pazienti/${a.patientId}`} className="text-brand-700 hover:underline">
                                {a.patient.firstName} {a.patient.lastName}
                              </Link>
                            </p>
                            <p className="text-xs text-slate-500">
                              {a.service?.name ?? 'Visita'} · {a.mode === 'VIDEO' ? 'Videoconsulto' : 'In presenza'}
                            </p>
                          </div>
                          <Badge color={statusBadgeColor(a.status)}>{APPOINTMENT_STATUS_LABEL[a.status] ?? a.status}</Badge>
                        </div>

                        {motivo && (
                          <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">
                            <span className="font-medium">Questionario pre-visita:</span> {motivo}
                          </p>
                        )}
                        {a.doctorNotes && (
                          <p className="text-sm text-slate-700 bg-emerald-50 rounded-lg px-3 py-2">
                            <span className="font-medium">Note visita:</span> {a.doctorNotes}
                          </p>
                        )}

                        <div className="flex items-start gap-2 flex-wrap">
                          {active && <BriefingButton appointmentId={a.id} />}
                          {active && <CompleteWithNotesForm appointmentId={a.id} defaultNotes={a.doctorNotes ?? ''} />}
                          {(a.status === 'COMPLETATO' || a.doctorNotes) && (
                            <Link
                              href={`/medico/pazienti/${a.patientId}/emetti?kind=REFERTO_VISITA&title=${encodeURIComponent(`Referto visita del ${fmtDate(a.startsAt)}`)}&body=${encodeURIComponent(a.doctorNotes ?? '')}`}
                              className="btn-secondary !py-1.5 text-xs inline-flex items-center gap-1.5"
                            >
                              <Icon name="pencil" className="w-4 h-4" /> Genera referto dalle note
                            </Link>
                          )}
                          {active && <CancelAppointmentButton appointmentId={a.id} />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Disponibilità settimanali">
        {availabilities.length === 0 ? (
          <p className="text-sm text-slate-500 mb-3">Nessuna fascia configurata: i pazienti non vedono slot prenotabili.</p>
        ) : (
          <ul className="divide-y divide-slate-100 mb-4">
            {availabilities.map((av) => (
              <li key={av.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <span>{WEEKDAY_LABEL[av.weekday]} · {av.startTime}–{av.endTime}</span>
                <DeleteAvailabilityButton id={av.id} />
              </li>
            ))}
          </ul>
        )}
        <AvailabilityForm />
      </Card>

      <Card title="Chiusure ed eccezioni (ferie, congressi…)">
        {exceptions.length === 0 ? (
          <p className="text-sm text-slate-500 mb-3">Nessuna chiusura futura registrata.</p>
        ) : (
          <ul className="divide-y divide-slate-100 mb-4">
            {exceptions.map((ex) => (
              <li key={ex.id} className="py-2 text-sm">
                {fmtDate(ex.date)}{ex.reason ? ` — ${ex.reason}` : ''}
              </li>
            ))}
          </ul>
        )}
        <ExceptionForm />
      </Card>

      <Card title="Catalogo prestazioni">
        {services.length === 0 ? (
          <p className="text-sm text-slate-500 mb-3">Nessuna prestazione: aggiungine una per rendere prenotabile l’agenda.</p>
        ) : (
          <ul className="divide-y divide-slate-100 mb-4">
            {services.map((s) => (
              <li key={s.id} className="py-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
                  <span className={s.active ? '' : 'text-slate-400 line-through'}>
                    <strong>{s.name}</strong> · {s.durationMin} min · {fmtEuro(s.priceCents)} · {MODE_LABEL[s.mode] ?? s.mode}
                  </span>
                  <span className="flex items-center gap-3">
                    {!s.active && <Badge color="gray">Disattivata</Badge>}
                    <ToggleServiceButton id={s.id} active={s.active} />
                  </span>
                </div>
                <EditServiceForm service={{ id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents, mode: s.mode, active: s.active }} />
              </li>
            ))}
          </ul>
        )}
        <CreateServiceForm />
      </Card>
    </div>
  );
}
