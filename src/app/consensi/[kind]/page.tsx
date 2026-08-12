import { db } from '@/lib/db';
import { notFound } from 'next/navigation';

const KIND_MAP: Record<string, string> = { privacy: 'PRIVACY', salute: 'ART9_SALUTE', ia: 'IA_TRATTAMENTO', termini: 'TERMINI' };

export const dynamic = 'force-dynamic';

export default async function ConsentPage({ params }: { params: { kind: string } }) {
  const kind = KIND_MAP[params.kind];
  if (!kind) notFound();
  const v = await db.consentVersion.findFirst({ where: { kind, active: true }, orderBy: { version: 'desc' } });
  if (!v) notFound();
  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      <article className="card max-w-2xl mx-auto p-6 sm:p-8">
        <h1 className="text-xl font-bold">{v.title}</h1>
        <p className="text-xs text-slate-500 mt-1">Versione {v.version} — pubblicata il {v.publishedAt.toLocaleDateString('it-IT')}</p>
        <div className="prose prose-slate mt-4 text-sm whitespace-pre-wrap">{v.text}</div>
      </article>
    </div>
  );
}
