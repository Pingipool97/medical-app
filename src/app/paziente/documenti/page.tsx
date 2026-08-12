import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { DOC_STATUS_LABEL } from '@/lib/constants';
import { Badge, Card, EmptyState, PageTitle, statusBadgeColor } from '@/components/ui';
import { Icon } from '@/components/icons';

export const dynamic = 'force-dynamic';

const QUALITY_LABEL: Record<string, string> = {
  COMPLETA: 'Lettura completa',
  PARZIALE: 'Lettura parziale',
  ILLEGGIBILE: 'Non leggibile',
};

export default async function DocumentiPage({ searchParams }: {
  searchParams: { tipo?: string; da?: string; a?: string; q?: string };
}) {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');
  const patientId = session.patientId;

  const tipo = searchParams.tipo ?? '';
  const da = searchParams.da ?? '';
  const a = searchParams.a ?? '';
  const q = (searchParams.q ?? '').trim();

  const [docTypes, documents] = await Promise.all([
    db.documentTypeDef.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    db.document.findMany({
      where: {
        patientId,
        deletedAt: null,
        ...(tipo ? { docTypeCode: tipo } : {}),
        ...(q ? { title: { contains: q } } : {}),
        ...(da || a
          ? {
              docDate: {
                ...(da ? { gte: new Date(da) } : {}),
                ...(a ? { lte: new Date(a + 'T23:59:59') } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ docDate: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  const typeName = (code: string) => docTypes.find((t) => t.code === code)?.name ?? code;

  return (
    <div className="space-y-5">
      <PageTitle
        title="I tuoi documenti"
        subtitle="Referti, esami e altri documenti che hai caricato."
        action={<Link href="/paziente/documenti/carica" className="btn-primary inline-flex items-center gap-1.5"><Icon name="file" className="w-4 h-4" /> Carica un documento</Link>}
      />

      <p className="text-sm">
        <Link href="/paziente/ricevuti" className="text-brand-700 hover:underline">Cerchi ricette e documenti inviati dal medico? Vai a “Documenti ricevuti” →</Link>
      </p>

      {/* Filtri */}
      <Card title="Filtra i documenti">
        <form method="get" className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="label" htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue={tipo} className="input">
              <option value="">Tutti i tipi</option>
              {docTypes.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="da">Dal</label>
            <input id="da" name="da" type="date" defaultValue={da} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="a">Al</label>
            <input id="a" name="a" type="date" defaultValue={a} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="q">Cerca nel titolo</label>
            <input id="q" name="q" defaultValue={q} placeholder="es. emocromo" className="input" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-secondary flex-1">Filtra</button>
            {(tipo || da || a || q) && <Link href="/paziente/documenti" className="btn-secondary">Azzera</Link>}
          </div>
        </form>
      </Card>

      {documents.length === 0 ? (
        <Card>
          <EmptyState
            title={tipo || da || a || q ? 'Nessun documento corrisponde ai filtri' : 'Non hai ancora caricato documenti'}
            hint="Carica un referto in PDF o una foto: lo leggeremo e lo organizzeremo per te."
            action={<Link href="/paziente/documenti/carica" className="btn-primary">Carica il primo documento</Link>}
          />
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {documents.map((d) => (
              <li key={d.id} className="py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <Link href={`/paziente/documenti/${d.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                      {d.title}
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {typeName(d.docTypeCode)}
                      {' · '}{d.docDate ? fmtDate(d.docDate) : 'data da confermare'}
                      {d.issuer ? ` · ${d.issuer}` : ''}
                      {d.extractionQuality ? ` · ${QUALITY_LABEL[d.extractionQuality] ?? d.extractionQuality}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge color={statusBadgeColor(d.status)}>{DOC_STATUS_LABEL[d.status] ?? d.status}</Badge>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
