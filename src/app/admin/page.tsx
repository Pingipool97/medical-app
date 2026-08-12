import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { fmtEuro, fmtDateTime } from '@/lib/format';
import { Card, Badge, PageTitle, Alert, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';

function UsageBar({ used, cap, label }: { used: number; cap: number; label: string }) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const barColor = pct >= 100 ? 'bg-red-600' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium">
          {fmtEuro(used)} / {fmtEuro(cap)} <span className="text-slate-500">({pct}%)</span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/login');

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const last24h = new Date(Date.now() - 24 * 3600 * 1000);

  const [caps, daySum, monthSum, usersByRole, pendingDoctors, providers, pendingNotifications, errorJobs, errorJobsCount] =
    await Promise.all([
      getSetting<{ dailyCents: number; monthlyCents: number }>('ai_spending_caps', { dailyCents: 500, monthlyCents: 5000 }),
      db.aiJob.aggregate({ _sum: { costCents: true }, where: { createdAt: { gte: dayStart } } }),
      db.aiJob.aggregate({ _sum: { costCents: true }, where: { createdAt: { gte: monthStart } } }),
      db.user.groupBy({ by: ['role'], _count: { _all: true }, where: { status: { not: 'DELETED' } } }),
      db.doctorProfile.findMany({
        where: { verificationStatus: 'PENDING' },
        include: { user: { select: { email: true } } },
        orderBy: { id: 'asc' },
        take: 5,
      }),
      db.providerConfig.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] }),
      db.notification.count({ where: { status: 'PENDING' } }),
      db.aiJob.findMany({
        where: { status: 'ERROR', createdAt: { gte: last24h } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      db.aiJob.count({ where: { status: 'ERROR', createdAt: { gte: last24h } } }),
    ]);

  const pendingDoctorsCount = await db.doctorProfile.count({ where: { verificationStatus: 'PENDING' } });
  const dayUsed = daySum._sum.costCents ?? 0;
  const monthUsed = monthSum._sum.costCents ?? 0;
  const dayPct = caps.dailyCents > 0 ? (dayUsed / caps.dailyCents) * 100 : 0;
  const monthPct = caps.monthlyCents > 0 ? (monthUsed / caps.monthlyCents) * 100 : 0;

  const ROLE_LABEL: Record<string, string> = {
    PATIENT: 'Pazienti', DOCTOR: 'Medici', STAFF: 'Segreteria', ADMIN: 'Amministratori', CAREGIVER: 'Caregiver',
  };

  return (
    <>
      <PageTitle title="Dashboard amministrazione" subtitle="Stato della piattaforma, spesa IA e attività in attesa." />

      {(dayPct >= 80 || monthPct >= 80) && (
        <div className="mb-4">
          <Alert kind={dayPct >= 100 || monthPct >= 100 ? 'critical' : 'warn'}>
            {dayPct >= 100 || monthPct >= 100
              ? 'Tetto di spesa IA raggiunto: le nuove chiamate IA sono bloccate automaticamente.'
              : 'Attenzione: la spesa IA ha superato l’80% del tetto configurato.'}{' '}
            <Link href="/admin/ia" className="underline font-medium">Gestisci i tetti di spesa</Link>
          </Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Spesa IA" action={<Link href="/admin/ia" className="text-sm text-brand-700 hover:underline">Dettagli →</Link>}>
          <div className="space-y-4">
            <UsageBar used={dayUsed} cap={caps.dailyCents} label="Oggi" />
            <UsageBar used={monthUsed} cap={caps.monthlyCents} label="Mese corrente" />
            <p className="text-xs text-slate-500">
              Al raggiungimento del tetto le chiamate IA vengono bloccate automaticamente (mai superato in silenzio).
            </p>
          </div>
        </Card>

        <Card title="Utenti per ruolo" action={<Link href="/admin/utenti" className="text-sm text-brand-700 hover:underline">Gestisci →</Link>}>
          {usersByRole.length === 0 ? (
            <EmptyState title="Nessun utente registrato" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {usersByRole.map((r) => (
                <li key={r.role} className="flex justify-between py-2 text-sm">
                  <span className="text-slate-700">{ROLE_LABEL[r.role] ?? r.role}</span>
                  <span className="font-semibold">{r._count._all}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={`Medici in attesa di verifica (${pendingDoctorsCount})`}
          action={<Link href="/admin/utenti" className="text-sm text-brand-700 hover:underline">Verifica →</Link>}
        >
          {pendingDoctors.length === 0 ? (
            <EmptyState title="Nessun medico in attesa" hint="Le nuove registrazioni di medici compariranno qui." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingDoctors.map((d) => (
                <li key={d.id} className="py-2 text-sm flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{d.firstName} {d.lastName}</span>{' '}
                    <span className="text-slate-500">— Ordine {d.ordineProvince} n. {d.ordineNumber}</span>
                  </span>
                  <span className="text-slate-500">{d.user.email}</span>
                </li>
              ))}
              {pendingDoctorsCount > pendingDoctors.length && (
                <li className="py-2 text-sm text-slate-500">…e altri {pendingDoctorsCount - pendingDoctors.length}.</li>
              )}
            </ul>
          )}
        </Card>

        <Card title="Provider configurati" action={<Link href="/admin/provider" className="text-sm text-brand-700 hover:underline">Gestisci →</Link>}>
          {providers.length === 0 ? (
            <EmptyState title="Nessun provider configurato" hint="Configura almeno il provider IA per abilitare le analisi." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {providers.map((p) => (
                <li key={p.id} className="py-2 text-sm flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <Badge color="gray">{p.kind}</Badge> <span className="font-medium ml-1">{p.name}</span>
                    {!p.enabled && <span className="text-slate-500 ml-2">(disattivato)</span>}
                  </span>
                  <span>
                    {p.lastTestAt == null ? (
                      <Badge color="gray">Mai testato</Badge>
                    ) : p.lastTestOk ? (
                      <Badge color="green">Test OK</Badge>
                    ) : (
                      <Badge color="red">Test fallito</Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Notifiche esterne in coda" action={<Link href="/admin/notifiche" className="text-sm text-brand-700 hover:underline">Eventi e canali →</Link>}>
          {pendingNotifications === 0 ? (
            <EmptyState title="Nessuna notifica in coda" />
          ) : (
            <Alert kind="warn">
              Ci sono <strong>{pendingNotifications}</strong> notifiche esterne in stato PENDING: sono state accodate perché il
              relativo provider (email/SMS/push) non è configurato o non è attivo.{' '}
              <Link href="/admin/provider" className="underline font-medium">Configura i provider</Link>
            </Alert>
          )}
        </Card>

        <Card title={`Job IA in errore (ultime 24 ore: ${errorJobsCount})`}>
          {errorJobs.length === 0 ? (
            <EmptyState title="Nessun errore nelle ultime 24 ore" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3 font-medium">Quando</th>
                    <th className="py-2 pr-3 font-medium">Funzione</th>
                    <th className="py-2 pr-3 font-medium">Modello</th>
                    <th className="py-2 font-medium">Errore</th>
                  </tr>
                </thead>
                <tbody>
                  {errorJobs.map((j) => (
                    <tr key={j.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(j.createdAt)}</td>
                      <td className="py-2 pr-3">{j.functionKey}</td>
                      <td className="py-2 pr-3">{j.model}</td>
                      <td className="py-2 text-red-700">{(j.error ?? '—').slice(0, 120)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
