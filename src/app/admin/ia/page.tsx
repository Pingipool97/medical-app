import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { AI_FUNCTIONS, MODEL_COSTS } from '@/lib/constants';
import { fmtEuro } from '@/lib/format';
import { Card, PageTitle, Alert, EmptyState } from '@/components/ui';
import { AiFunctionRow, SpendingCapsForm, type AiFunctionView } from './forms';

export const dynamic = 'force-dynamic';

export default async function IaConfigPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/login');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [configs, caps, byFunction, byRequester] = await Promise.all([
    db.aiFunctionConfig.findMany(),
    getSetting<{ dailyCents: number; monthlyCents: number }>('ai_spending_caps', { dailyCents: 500, monthlyCents: 5000 }),
    db.aiJob.groupBy({
      by: ['functionKey'],
      where: { createdAt: { gte: monthStart } },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, costCents: true },
      orderBy: { _sum: { costCents: 'desc' } },
    }),
    db.aiJob.groupBy({
      by: ['requestedById'],
      where: { createdAt: { gte: monthStart } },
      _count: { _all: true },
      _sum: { costCents: true },
      orderBy: { _sum: { costCents: 'desc' } },
      take: 10,
    }),
  ]);

  const cfgByKey = new Map(configs.map((c) => [c.functionKey, c]));
  // Ogni funzione dichiarata in AI_FUNCTIONS compare sempre, anche senza riga a DB (creata al salvataggio)
  const rows: AiFunctionView[] = AI_FUNCTIONS.map((f) => {
    const c = cfgByKey.get(f.key);
    return {
      functionKey: f.key,
      label: f.label,
      isCds: f.isCds,
      enabled: c?.enabled ?? false,
      model: c?.model ?? 'claude-haiku-4-5-20251001',
      temperature: c?.temperature ?? 0.2,
      maxTokens: c?.maxTokens ?? 1500,
    };
  });

  const knownModels = Object.keys(MODEL_COSTS);
  const requesterUsers = await db.user.findMany({
    where: { id: { in: byRequester.map((r) => r.requestedById) } },
    select: { id: true, email: true },
  });
  const emailById = new Map(requesterUsers.map((u) => [u.id, u.email]));
  const labelByKey = new Map(AI_FUNCTIONS.map((f) => [f.key, f.label]));

  return (
    <>
      <PageTitle title="Configurazione IA" subtitle="Funzioni, modelli, tetti di spesa e consumi del mese corrente." />

      <div className="space-y-4">
        <Card title="Funzioni IA">
          <div className="mb-3">
            <Alert kind="info">
              Le funzioni marcate <strong>CDS</strong> rientrano nel perimetro del supporto decisionale clinico: la loro
              abilitazione richiede che il feature flag regolatorio corrispondente sia attivo.
            </Alert>
          </div>
          <div className="space-y-3">
            {rows.map((cfg) => (
              <AiFunctionRow key={cfg.functionKey} cfg={cfg} knownModels={knownModels} />
            ))}
          </div>
        </Card>

        <Card title="Tetti di spesa IA">
          <SpendingCapsForm
            dailyEuro={(caps.dailyCents / 100).toFixed(2)}
            monthlyEuro={(caps.monthlyCents / 100).toFixed(2)}
          />
        </Card>

        <Card title="Consumi del mese corrente per funzione">
          {byFunction.length === 0 ? (
            <EmptyState title="Nessuna chiamata IA questo mese" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3 font-medium">Funzione</th>
                    <th className="py-2 pr-3 font-medium">Chiamate</th>
                    <th className="py-2 pr-3 font-medium">Token input</th>
                    <th className="py-2 pr-3 font-medium">Token output</th>
                    <th className="py-2 font-medium">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {byFunction.map((r) => (
                    <tr key={r.functionKey} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{labelByKey.get(r.functionKey) ?? r.functionKey}</td>
                      <td className="py-2 pr-3">{r._count._all}</td>
                      <td className="py-2 pr-3">{(r._sum.inputTokens ?? 0).toLocaleString('it-IT')}</td>
                      <td className="py-2 pr-3">{(r._sum.outputTokens ?? 0).toLocaleString('it-IT')}</td>
                      <td className="py-2 font-medium">{fmtEuro(r._sum.costCents ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Top 10 richiedenti del mese">
          {byRequester.length === 0 ? (
            <EmptyState title="Nessuna chiamata IA questo mese" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3 font-medium">Utente</th>
                    <th className="py-2 pr-3 font-medium">Chiamate</th>
                    <th className="py-2 font-medium">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {byRequester.map((r) => (
                    <tr key={r.requestedById} className="border-b border-slate-100">
                      <td className="py-2 pr-3">{emailById.get(r.requestedById) ?? r.requestedById}</td>
                      <td className="py-2 pr-3">{r._count._all}</td>
                      <td className="py-2 font-medium">{fmtEuro(r._sum.costCents ?? 0)}</td>
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
