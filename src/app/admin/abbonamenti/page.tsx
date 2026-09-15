import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { expireOverdueSubscriptions } from '@/lib/subscription';
import { fmtDate, fmtEuro } from '@/lib/format';
import { PREMIUM_PRICE_CENTS, SUBSCRIPTION_STATUS_LABEL } from '@/lib/constants';
import { Alert, Badge, Card, EmptyState, PageTitle } from '@/components/ui';
import { ActivateForm, CancelButton, DoctorAiToggle } from './forms';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
  ACTIVE: 'green',
  PENDING_PAYMENT: 'amber',
  EXPIRED: 'gray',
  CANCELLED: 'red',
};

export default async function AbbonamentiPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/login');

  // Allinea gli abbonamenti scaduti prima di mostrare i numeri: senza un job periodico
  // resterebbero ACTIVE a schermo pur non dando più accesso (il gate li considera scaduti).
  await expireOverdueSubscriptions();

  const [subs, patientsWithout, doctors, activeCount] = await Promise.all([
    db.subscription.findMany({
      include: { user: { select: { email: true, role: true, patientProfile: { select: { firstName: true, lastName: true } } } } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
    }),
    db.user.count({ where: { role: 'PATIENT', status: { not: 'DELETED' }, subscription: null } }),
    db.doctorProfile.findMany({
      select: { id: true, firstName: true, lastName: true, aiIncluded: true, user: { select: { email: true } } },
      orderBy: { lastName: 'asc' },
    }),
    db.subscription.count({ where: { plan: 'PREMIUM', status: 'ACTIVE' } }),
  ]);

  const pending = subs.filter((s) => s.status === 'PENDING_PAYMENT');
  const ricavoAnnuo = activeCount * PREMIUM_PRICE_CENTS;

  return (
    <>
      <PageTitle title="Abbonamenti" subtitle="Piano Premium dei pazienti e IA inclusa dei professionisti." />

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <Card title="Premium attivi">
          <p className="text-3xl font-bold text-brand-950">{activeCount}</p>
          <p className="text-sm text-slate-500 mt-1">{fmtEuro(ricavoAnnuo)} / anno ricorrenti</p>
        </Card>
        <Card title="In attesa di pagamento">
          <p className="text-3xl font-bold text-amber-700">{pending.length}</p>
          <p className="text-sm text-slate-500 mt-1">Richieste da confermare</p>
        </Card>
        <Card title="Pazienti sul piano gratuito">
          <p className="text-3xl font-bold text-slate-700">{patientsWithout}</p>
          <p className="text-sm text-slate-500 mt-1">Mai passati al Premium</p>
        </Card>
      </div>

      <Alert kind="info">
        Il pagamento online non è integrato: le attivazioni qui sono manuali. Quando collegherai un provider di
        pagamento, il webhook potrà chiamare la stessa logica di attivazione senza modifiche al modello dati.
      </Alert>

      {pending.length > 0 && (
        <Card title={`Richieste da confermare (${pending.length})`} className="border-amber-300">
          <ul className="divide-y divide-slate-100">
            {pending.map((s) => (
              <li key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <p className="font-medium">
                    {s.user.patientProfile ? `${s.user.patientProfile.lastName} ${s.user.patientProfile.firstName}` : s.user.email}
                  </p>
                  <p className="text-slate-500 text-xs">{s.user.email} · richiesto il {fmtDate(s.createdAt)}</p>
                </div>
                <ActivateForm userId={s.userId} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Tutti gli abbonamenti">
        {subs.length === 0 ? (
          <EmptyState title="Nessun abbonamento" hint="Compariranno qui appena un paziente richiede il Premium." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3 font-medium">Utente</th>
                  <th className="py-2 pr-3 font-medium">Piano</th>
                  <th className="py-2 pr-3 font-medium">Stato</th>
                  <th className="py-2 pr-3 font-medium">Scadenza</th>
                  <th className="py-2 font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      <span className="font-medium">
                        {s.user.patientProfile ? `${s.user.patientProfile.lastName} ${s.user.patientProfile.firstName}` : '—'}
                      </span>
                      <span className="block text-xs text-slate-500 break-all">{s.user.email}</span>
                    </td>
                    <td className="py-2 pr-3"><Badge color={s.plan === 'PREMIUM' ? 'violet' : 'gray'}>{s.plan}</Badge></td>
                    <td className="py-2 pr-3">
                      <Badge color={STATUS_BADGE[s.status] ?? 'gray'}>{SUBSCRIPTION_STATUS_LABEL[s.status] ?? s.status}</Badge>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{s.expiresAt ? fmtDate(s.expiresAt) : '—'}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <ActivateForm userId={s.userId} label={s.status === 'ACTIVE' ? 'Rinnova' : 'Attiva'} />
                        {s.status === 'ACTIVE' && <CancelButton userId={s.userId} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="IA dei professionisti">
        <p className="text-sm text-slate-600 mb-3">
          Per i professionisti l’IA è inclusa e si monetizza nel prezzo di vendita dell’app: qui c’è solo
          l’interruttore per i casi particolari.
        </p>
        {doctors.length === 0 ? (
          <EmptyState title="Nessun professionista registrato" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {doctors.map((d) => (
              <li key={d.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-medium">{d.lastName} {d.firstName}</span>
                  <span className="block text-xs text-slate-500 break-all">{d.user.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge color={d.aiIncluded ? 'green' : 'gray'}>{d.aiIncluded ? 'IA inclusa' : 'IA disattivata'}</Badge>
                  <DoctorAiToggle doctorId={d.id} included={d.aiIncluded} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
