import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { DOC_STATUS_LABEL, REQUEST_STATUS_LABEL } from '@/lib/constants';
import { Alert, Badge, Card, EmergencyBanner, EmptyState, PageTitle, statusBadgeColor } from '@/components/ui';
import { Icon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function PazienteDashboard() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');
  const patientId = session.patientId;

  const [profile, allergies, appointments, requests, documents, notifications] = await Promise.all([
    db.patientProfile.findUnique({ where: { id: patientId }, include: { pregnancy: true } }),
    db.allergy.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } }),
    db.appointment.findMany({
      where: { patientId, startsAt: { gte: new Date() }, status: { in: ['PRENOTATO', 'CONFERMATO'] } },
      orderBy: { startsAt: 'asc' },
      take: 3,
      include: { doctor: true, service: true },
    }),
    db.serviceRequest.findMany({
      where: { patientId, status: { in: ['NUOVA', 'PRESA_IN_CARICO', 'ATTESA_INFO'] } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { doctor: true },
    }),
    db.document.findMany({ where: { patientId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 3 }),
    db.notification.findMany({
      where: { userId: session.userId, channel: 'INAPP', readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ]);
  if (!profile) redirect('/login');

  const completeness = profile.profileCompleteness;
  const preg = profile.pregnancy;

  return (
    <div className="space-y-5">
      <PageTitle
        title={`Ciao, ${profile.firstName}`}
        subtitle="Questa è la tua area personale: qui trovi documenti, appuntamenti e comunicazioni con i tuoi medici."
      />

      {/* Completezza profilo */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-medium text-slate-800">Completezza del tuo profilo sanitario: {completeness}%</p>
            <div className="mt-2 h-3 w-full rounded-full bg-slate-200" role="progressbar" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100} aria-label="Completezza del profilo sanitario">
              <div
                className={`h-3 rounded-full ${completeness >= 80 ? 'bg-emerald-600' : 'bg-amber-500'}`}
                style={{ width: `${Math.max(completeness, 4)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Un profilo più completo rende più affidabili le analisi e aiuta il medico a curarti meglio.
            </p>
          </div>
          {completeness < 80 && (
            <Link href="/paziente/onboarding" className="btn-primary">Completa il profilo</Link>
          )}
        </div>
      </Card>

      {/* Allergie: sempre in evidenza rossa, mai nascoste */}
      {allergies.length > 0 && (
        <div className="alert-critical" role="alert">
          <p className="font-semibold">⚠️ Le tue allergie registrate</p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {allergies.map((a) => (
              <li key={a.id}>
                {a.allergen} — gravità {a.severity.toLowerCase()}{a.reaction ? ` (reazione: ${a.reaction})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gravidanza / allattamento */}
      {preg && (preg.isPregnant || preg.isBreastfeeding) && (
        <Alert kind="warn">
          {preg.isPregnant && <>Nel tuo profilo è indicata una <strong>gravidanza in corso</strong>{preg.dueDate ? ` (termine previsto: ${fmtDate(preg.dueDate)})` : ''}. </>}
          {preg.isBreastfeeding && <>Nel tuo profilo è indicato l’<strong>allattamento</strong>. </>}
          Questo dato è importante per la sicurezza delle terapie: se non è più attuale, aggiornalo dal <Link href="/paziente/diario" className="underline font-medium">Diario</Link>.
        </Alert>
      )}

      {/* CTA principale */}
      <Link
        href="/paziente/documenti/carica"
        className="btn-primary w-full text-base py-4 flex items-center justify-center gap-2"
      >
        <Icon name="file" className="w-5 h-5" /> Carica un referto o un documento
      </Link>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Prossimi appuntamenti" action={<Link href="/paziente/appuntamenti" className="text-sm text-brand-700 hover:underline">Vedi tutti</Link>}>
          {appointments.length === 0 ? (
            <EmptyState title="Nessun appuntamento in programma" action={<Link href="/paziente/appuntamenti/prenota" className="btn-secondary">Prenota una visita</Link>} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {appointments.map((a) => (
                <li key={a.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{a.service?.name ?? 'Visita'} — Dr. {a.doctor.lastName}</p>
                    <p className="text-xs text-slate-500">{fmtDateTime(a.startsAt)} · {a.mode === 'VIDEO' ? 'In videoconsulto' : 'In presenza'}</p>
                  </div>
                  <Badge color={statusBadgeColor(a.status)}>{a.status === 'CONFERMATO' ? 'Confermato' : 'Prenotato'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Richieste aperte" action={<Link href="/paziente/richieste" className="text-sm text-brand-700 hover:underline">Vedi tutte</Link>}>
          {requests.length === 0 ? (
            <EmptyState title="Nessuna richiesta aperta" hint="Puoi chiedere ricette, certificati o informazioni al tuo medico." action={<Link href="/paziente/richieste/nuova" className="btn-secondary">Nuova richiesta</Link>} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {requests.map((r) => (
                <li key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.subject}</p>
                    <p className="text-xs text-slate-500">Dr. {r.doctor.lastName} · {fmtDate(r.createdAt)}</p>
                  </div>
                  <Badge color={statusBadgeColor(r.status)}>{REQUEST_STATUS_LABEL[r.status] ?? r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Ultimi documenti" action={<Link href="/paziente/documenti" className="text-sm text-brand-700 hover:underline">Vedi tutti</Link>}>
          {documents.length === 0 ? (
            <EmptyState title="Non hai ancora caricato documenti" hint="Carica un referto: penseremo noi a leggerlo e organizzarlo." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {documents.map((d) => (
                <li key={d.id} className="py-2.5 flex items-center justify-between gap-2">
                  <Link href={`/paziente/documenti/${d.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                    {d.title}
                  </Link>
                  <Badge color={statusBadgeColor(d.status)}>{DOC_STATUS_LABEL[d.status] ?? d.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm mt-3">
            <Link href="/paziente/ricevuti" className="text-brand-700 hover:underline">Documenti ricevuti dal medico →</Link>
          </p>
        </Card>

        <Card title="Notifiche da leggere" action={<Link href="/paziente/notifiche" className="text-sm text-brand-700 hover:underline">Vedi tutte</Link>}>
          {notifications.length === 0 ? (
            <EmptyState title="Nessuna notifica da leggere" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <li key={n.id} className="py-2.5">
                  <p className="text-sm font-medium text-slate-800">{n.title}</p>
                  <p className="text-xs text-slate-500">{n.body} · {fmtDateTime(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <EmergencyBanner />
    </div>
  );
}
