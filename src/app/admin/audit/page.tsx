import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { fmtDateTime } from '@/lib/format';
import { Card, Badge, PageTitle, EmptyState } from '@/components/ui';
import { buildAuditWhere, AUDIT_ACTIONS, AUDIT_ROLES, type AuditFilters } from './filters';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? '' : v ?? '');

export default async function AuditPage({ searchParams }: { searchParams?: SP }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/login');

  const filters: AuditFilters = {
    azione: one(searchParams?.azione) || undefined,
    ruolo: one(searchParams?.ruolo) || undefined,
    targetType: one(searchParams?.targetType) || undefined,
    da: one(searchParams?.da) || undefined,
    a: one(searchParams?.a) || undefined,
    patientId: one(searchParams?.patientId) || undefined,
  };
  const page = Math.max(1, Number(one(searchParams?.page)) || 1);
  const where = buildAuditWhere(filters);

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { email: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
  const filterQuery = qs.toString();
  const pageHref = (p: number) => `/admin/audit?${filterQuery}${filterQuery ? '&' : ''}page=${p}`;
  const exportHref = `/admin/audit/export${filterQuery ? `?${filterQuery}` : ''}`;

  return (
    <>
      <PageTitle
        title="Audit log"
        subtitle="Ogni accesso e modifica è tracciato: chi, cosa, quando, da dove."
        action={<a href={exportHref} className="btn-secondary text-sm">Esporta CSV</a>}
      />

      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-4">
          <div>
            <label className="label" htmlFor="azione">Azione</label>
            <select id="azione" name="azione" defaultValue={filters.azione ?? ''} className="input">
              <option value="">Tutte</option>
              {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ruolo">Ruolo attore</label>
            <select id="ruolo" name="ruolo" defaultValue={filters.ruolo ?? ''} className="input">
              <option value="">Tutti</option>
              {AUDIT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="targetType">Tipo target</label>
            <input id="targetType" name="targetType" defaultValue={filters.targetType ?? ''} className="input" placeholder="es. Document" />
          </div>
          <div>
            <label className="label" htmlFor="da">Da</label>
            <input id="da" name="da" type="date" defaultValue={filters.da ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="a">A</label>
            <input id="a" name="a" type="date" defaultValue={filters.a ?? ''} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="patientId">ID paziente</label>
            <input id="patientId" name="patientId" defaultValue={filters.patientId ?? ''} className="input" placeholder="cuid del paziente" />
          </div>
          <div className="sm:col-span-3 lg:col-span-6 flex gap-2">
            <button type="submit" className="btn-secondary">Filtra</button>
            <Link href="/admin/audit" className="btn text-sm text-slate-600 hover:bg-slate-100">Azzera filtri</Link>
          </div>
        </form>

        {rows.length === 0 ? (
          <EmptyState title="Nessun evento con questi filtri" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3 font-medium">Data e ora</th>
                    <th className="py-2 pr-3 font-medium">Attore</th>
                    <th className="py-2 pr-3 font-medium">Azione</th>
                    <th className="py-2 pr-3 font-medium">Target</th>
                    <th className="py-2 pr-3 font-medium">Paziente</th>
                    <th className="py-2 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                      <td className="py-2 pr-3 break-all">
                        {r.actor?.email ?? <span className="text-slate-400">sistema</span>}
                        {r.actorRole && <span className="text-xs text-slate-500 block">{r.actorRole}</span>}
                      </td>
                      <td className="py-2 pr-3"><Badge color={r.action.includes('FAIL') || r.action.includes('BLOCK') ? 'red' : 'gray'}>{r.action}</Badge></td>
                      <td className="py-2 pr-3">
                        {r.targetType ? (
                          <>
                            {r.targetType}
                            {r.targetId && <span className="text-xs text-slate-500 block break-all">{r.targetId}</span>}
                          </>
                        ) : '—'}
                      </td>
                      <td className="py-2 pr-3 text-xs break-all">{r.patientId ?? '—'}</td>
                      <td className="py-2 text-xs">{r.ip ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 text-sm">
              <p className="text-slate-600">
                {total} eventi — pagina {page} di {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && <Link href={pageHref(page - 1)} className="btn-secondary text-xs px-3 py-1.5">← Precedente</Link>}
                {page < totalPages && <Link href={pageHref(page + 1)} className="btn-secondary text-xs px-3 py-1.5">Successiva →</Link>}
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
