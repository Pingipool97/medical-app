import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { AI_FUNCTIONS } from '@/lib/constants';
import { fmtDateTime } from '@/lib/format';
import { Card, Badge, PageTitle, Alert, EmptyState } from '@/components/ui';
import { PromptEditor, ActivateVersionButton } from './forms';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? '' : v ?? '');

export default async function PromptPage({ searchParams }: { searchParams?: SP }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/login');

  const fn = one(searchParams?.fn);
  const va = Number(one(searchParams?.va)) || 0;
  const vb = Number(one(searchParams?.vb)) || 0;
  const editV = Number(one(searchParams?.v)) || 0;

  const templates = await db.promptTemplate.findMany({ orderBy: [{ functionKey: 'asc' }, { version: 'desc' }] });
  const byFn = new Map<string, typeof templates>();
  for (const t of templates) {
    const list = byFn.get(t.functionKey) ?? [];
    list.push(t);
    byFn.set(t.functionKey, list);
  }

  const selectedDef = AI_FUNCTIONS.find((f) => f.key === fn);
  const versions = selectedDef ? byFn.get(fn) ?? [] : [];
  const activeVersion = versions.find((v) => v.active);
  const editSource = editV ? versions.find((v) => v.version === editV) : activeVersion;
  const cmpA = va ? versions.find((v) => v.version === va) : undefined;
  const cmpB = vb ? versions.find((v) => v.version === vb) : undefined;

  return (
    <>
      <PageTitle title="Prompt di sistema" subtitle="Editor versionato dei prompt per ogni funzione IA." />

      <div className="mb-4">
        <Alert kind="warn">
          Il prompt attivo viene usato dal sistema al posto di quello di default. Le regole di citazione fonti e disclaimer
          devono restare.
        </Alert>
      </div>

      <div className="space-y-4">
        <Card title="Funzioni IA">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3 font-medium">Funzione</th>
                  <th className="py-2 pr-3 font-medium">Versione attiva</th>
                  <th className="py-2 pr-3 font-medium">Versioni</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {AI_FUNCTIONS.map((f) => {
                  const list = byFn.get(f.key) ?? [];
                  const active = list.find((v) => v.active);
                  return (
                    <tr key={f.key} className={`border-b border-slate-100 ${f.key === fn ? 'bg-brand-50' : ''}`}>
                      <td className="py-2 pr-3">
                        <span className="font-medium">{f.label}</span>{' '}
                        <code className="text-xs text-slate-500">{f.key}</code>
                      </td>
                      <td className="py-2 pr-3">
                        {active ? <Badge color="green">v{active.version}</Badge> : <Badge color="gray">Default di sistema</Badge>}
                      </td>
                      <td className="py-2 pr-3">{list.length}</td>
                      <td className="py-2">
                        <Link href={`/admin/prompt?fn=${f.key}`} className="text-brand-700 hover:underline">Gestisci →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {selectedDef && (
          <>
            <Card title={`Storico versioni — ${selectedDef.label}`}>
              {versions.length === 0 ? (
                <EmptyState title="Nessuna versione salvata" hint="Il sistema sta usando il prompt di default. Salva la prima versione con l'editor qui sotto." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-200">
                        <th className="py-2 pr-3 font-medium">Versione</th>
                        <th className="py-2 pr-3 font-medium">Stato</th>
                        <th className="py-2 pr-3 font-medium">Creata</th>
                        <th className="py-2 pr-3 font-medium">Autore</th>
                        <th className="py-2 font-medium">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((v) => (
                        <tr key={v.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3 font-medium">v{v.version}</td>
                          <td className="py-2 pr-3">{v.active ? <Badge color="green">Attiva</Badge> : <Badge color="gray">Non attiva</Badge>}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(v.createdAt)}</td>
                          <td className="py-2 pr-3">{v.createdBy ?? '—'}</td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-2 items-center">
                              {!v.active && <ActivateVersionButton id={v.id} version={v.version} />}
                              <Link href={`/admin/prompt?fn=${fn}&v=${v.version}`} className="text-xs text-brand-700 hover:underline">
                                Apri nell&rsquo;editor
                              </Link>
                              <Link
                                href={`/admin/prompt?fn=${fn}&va=${activeVersion?.version ?? v.version}&vb=${v.version}`}
                                className="text-xs text-brand-700 hover:underline"
                              >
                                Confronta con attiva
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {cmpA && cmpB && (
              <Card title={`Confronto: v${cmpA.version} ↔ v${cmpB.version}`}>
                <div className="grid gap-4 lg:grid-cols-2">
                  {[cmpA, cmpB].map((v) => (
                    <div key={v.id}>
                      <p className="text-sm font-medium mb-1">
                        Versione {v.version} {v.active && <Badge color="green">Attiva</Badge>}
                      </p>
                      <div className="overflow-x-auto">
                        <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap max-h-96 overflow-y-auto select-all">
                          {v.content}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card title={`Editor — ${selectedDef.label}`}>
              <PromptEditor
                functionKey={fn}
                initialContent={editSource?.content ?? ''}
                sourceVersion={editSource?.version}
              />
            </Card>
          </>
        )}
      </div>
    </>
  );
}
