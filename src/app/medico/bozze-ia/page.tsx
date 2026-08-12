import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDateTime, fmtDate } from '@/lib/format';
import { AI_FUNCTIONS, AI_OUTPUT_STATE_LABEL } from '@/lib/constants';
import { Badge, Card, EmptyState, PageTitle, statusBadgeColor } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function BozzeIaPage() {
  const session = await getSession();
  if (!session?.doctorId) redirect('/login');

  const outputs = await db.aiOutput.findMany({
    where: {
      state: { in: ['DRAFT', 'REVIEWED'] },
      job: { requestedById: session.userId },
    },
    orderBy: { createdAt: 'desc' },
    include: { job: { include: { patient: true } } },
    take: 100,
  });

  const fnLabel = (key: string) => AI_FUNCTIONS.find((f) => f.key === key)?.label ?? key;

  return (
    <div className="space-y-5">
      <PageTitle
        title="Coda di revisione IA"
        subtitle="Nessun contenuto generato dall’IA raggiunge il paziente senza la tua revisione. Le bozze non revisionate scadono automaticamente."
      />
      <Card>
        {outputs.length === 0 ? (
          <EmptyState title="Nessuna bozza in attesa" hint="Le bozze generate dalla cartella dei pazienti o dall’agenda compaiono qui." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {outputs.map((o) => (
              <li key={o.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <Link href={`/medico/bozze-ia/${o.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                    {fnLabel(o.job.functionKey)}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {o.job.patient ? `${o.job.patient.firstName} ${o.job.patient.lastName} · ` : ''}
                    generata il {fmtDateTime(o.createdAt)}
                    {o.expiresAt && ` · scade il ${fmtDate(o.expiresAt)}`}
                    {' · destinatario: '}{o.audience === 'PATIENT' ? 'paziente' : 'medico'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {o.insufficientData && <Badge color="amber">Dati insufficienti</Badge>}
                  <Badge color={statusBadgeColor(o.state)}>{AI_OUTPUT_STATE_LABEL[o.state] ?? o.state}</Badge>
                  <Link href={`/medico/bozze-ia/${o.id}`} className="btn-secondary !py-1.5 text-xs">Revisiona</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
