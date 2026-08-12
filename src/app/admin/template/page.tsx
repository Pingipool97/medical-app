import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { fmtDateTime } from '@/lib/format';
import { Card, Badge, PageTitle, Alert, EmptyState } from '@/components/ui';
import { TemplateEditor, SendTestButton } from './forms';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? '' : v ?? '');

export default async function TemplatePage({ searchParams }: { searchParams?: SP }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/login');

  const selKey = one(searchParams?.key);
  const selChannel = one(searchParams?.channel);

  const templates = await db.messageTemplate.findMany({ orderBy: [{ key: 'asc' }, { channel: 'asc' }, { version: 'desc' }] });

  // Raggruppa per key+channel: la prima riga (versione più alta) rappresenta il gruppo
  const groups = new Map<string, typeof templates>();
  for (const t of templates) {
    const gk = `${t.key}::${t.channel}`;
    const list = groups.get(gk) ?? [];
    list.push(t);
    groups.set(gk, list);
  }

  const selectedVersions = selKey && selChannel ? groups.get(`${selKey}::${selChannel}`) ?? [] : [];
  const selectedActive = selectedVersions.find((v) => v.active) ?? selectedVersions[0];

  return (
    <>
      <PageTitle title="Template comunicazioni" subtitle="Testi versionati di email, SMS, push e PDF, con anteprima e invio di prova." />

      <div className="mb-4">
        <Alert kind="info">
          Le comunicazioni esterne non contengono mai contenuto clinico: solo un avviso e il link autenticato alla piattaforma.
          Senza provider configurato, «Invia test» recapita il contenuto renderizzato come notifica in-app al tuo account admin.
        </Alert>
      </div>

      <div className="space-y-4">
        <Card title="Template disponibili">
          {groups.size === 0 ? (
            <EmptyState title="Nessun template presente" hint="I template vengono creati dal seed iniziale della piattaforma." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3 font-medium">Chiave</th>
                    <th className="py-2 pr-3 font-medium">Canale</th>
                    <th className="py-2 pr-3 font-medium">Versione attiva</th>
                    <th className="py-2 pr-3 font-medium">Aggiornato</th>
                    <th className="py-2 font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(groups.entries()).map(([gk, list]) => {
                    const active = list.find((v) => v.active);
                    const head = active ?? list[0];
                    const isSel = head.key === selKey && head.channel === selChannel;
                    return (
                      <tr key={gk} className={`border-b border-slate-100 ${isSel ? 'bg-brand-50' : ''}`}>
                        <td className="py-2 pr-3 font-medium">{head.key}</td>
                        <td className="py-2 pr-3"><Badge color="blue">{head.channel}</Badge></td>
                        <td className="py-2 pr-3">
                          {active ? <Badge color="green">v{active.version}</Badge> : <Badge color="amber">Nessuna attiva</Badge>}
                          <span className="text-slate-500 ml-2">({list.length} version{list.length === 1 ? 'e' : 'i'})</span>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(head.updatedAt)}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/admin/template?key=${encodeURIComponent(head.key)}&channel=${head.channel}`} className="text-brand-700 hover:underline">
                              Modifica →
                            </Link>
                            {active && <SendTestButton templateId={active.id} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {selKey && selChannel && selectedActive && (
          <Card title={`Editor — ${selKey} (${selChannel})`}>
            <TemplateEditor
              templateKey={selKey}
              channel={selChannel}
              initialSubject={selectedActive.subject ?? ''}
              initialBody={selectedActive.body}
              sourceVersion={selectedActive.version}
            />
          </Card>
        )}

        {selKey && selChannel && selectedVersions.length > 1 && (
          <Card title="Storico versioni">
            <div className="space-y-3">
              {selectedVersions.map((v) => (
                <details key={v.id} className="border border-slate-200 rounded-lg p-3">
                  <summary className="cursor-pointer text-sm">
                    <span className="font-medium">v{v.version}</span>{' '}
                    {v.active ? <Badge color="green">Attiva</Badge> : <Badge color="gray">Storica</Badge>}{' '}
                    <span className="text-slate-500">{fmtDateTime(v.updatedAt)}</span>
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    {v.subject && <p className="text-sm font-semibold mb-1">{v.subject}</p>}
                    <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap">{v.body}</pre>
                  </div>
                </details>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
