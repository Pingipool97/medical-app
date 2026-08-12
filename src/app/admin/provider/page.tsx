import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { decryptField, maskSecret } from '@/lib/crypto';
import { fmtDateTime } from '@/lib/format';
import { Card, Badge, PageTitle, Alert, EmptyState } from '@/components/ui';
import { ProviderForm, TestProviderButton, type ProviderView } from './forms';

export const dynamic = 'force-dynamic';

const KINDS: { value: string; label: string }[] = [
  { value: 'AI', label: 'IA (analisi e riassunti)' },
  { value: 'OCR', label: 'OCR (estrazione testo)' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'PUSH', label: 'Notifiche push' },
  { value: 'STORAGE', label: 'Storage file' },
  { value: 'VIDEO', label: 'Videoconsulto' },
  { value: 'PAGAMENTI', label: 'Pagamenti' },
  { value: 'FIRMA', label: 'Firma elettronica' },
  { value: 'SSN', label: 'Integrazione SSN / Sistema TS' },
];

const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

export default async function ProviderPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/login');

  const providers = await db.providerConfig.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] });

  // La chiave non lascia mai il server in chiaro: qui viene decifrata solo per calcolarne la maschera.
  const byKind = new Map<string, (ProviderView & { lastTestAt: Date | null; lastTestOk: boolean | null; lastTestMessage: string | null })[]>();
  for (const p of providers) {
    const view = {
      id: p.id,
      kind: p.kind,
      name: p.name,
      baseUrl: p.baseUrl ?? '',
      maskedKey: p.apiKeyEnc ? maskSecret(decryptField(p.apiKeyEnc)) : '',
      enabled: p.enabled,
      lastTestAt: p.lastTestAt,
      lastTestOk: p.lastTestOk,
      lastTestMessage: p.lastTestMessage,
    };
    const list = byKind.get(p.kind) ?? [];
    list.push(view);
    byKind.set(p.kind, list);
  }

  return (
    <>
      <PageTitle title="Provider e chiavi" subtitle="Servizi esterni configurati: IA, OCR, comunicazioni, storage, pagamenti, firma." />

      <div className="mb-4">
        <Alert kind="info">
          Le chiavi sono cifrate a riposo (AES-256-GCM), mostrate mascherate e mai esposte al frontend. L&rsquo;accesso a
          quest&rsquo;area richiede l&rsquo;autenticazione a due fattori dell&rsquo;admin.
        </Alert>
      </div>

      <div className="space-y-4">
        {providers.length === 0 && (
          <Card>
            <EmptyState title="Nessun provider configurato" hint="Aggiungi il primo provider con il modulo in fondo alla pagina." />
          </Card>
        )}

        {Array.from(byKind.entries()).map(([kind, list]) => (
          <Card key={kind} title={`${KIND_LABEL[kind] ?? kind} (${kind})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3 font-medium">Nome</th>
                    <th className="py-2 pr-3 font-medium">Base URL</th>
                    <th className="py-2 pr-3 font-medium">Chiave</th>
                    <th className="py-2 pr-3 font-medium">Stato</th>
                    <th className="py-2 pr-3 font-medium">Ultimo test</th>
                    <th className="py-2 font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 font-medium">{p.name}</td>
                      <td className="py-2 pr-3 text-slate-600 break-all">{p.baseUrl || '—'}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{p.maskedKey || <span className="text-slate-400">non impostata</span>}</td>
                      <td className="py-2 pr-3">{p.enabled ? <Badge color="green">Attivo</Badge> : <Badge color="gray">Disattivato</Badge>}</td>
                      <td className="py-2 pr-3">
                        {p.lastTestAt == null ? (
                          <Badge color="gray">Mai testato</Badge>
                        ) : (
                          <div className="space-y-0.5">
                            {p.lastTestOk ? <Badge color="green">OK</Badge> : <Badge color="red">Fallito</Badge>}
                            <p className="text-xs text-slate-500">{fmtDateTime(p.lastTestAt)}</p>
                            {p.lastTestMessage && <p className="text-xs text-slate-500 max-w-xs">{p.lastTestMessage}</p>}
                          </div>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-col gap-2 items-start">
                          <TestProviderButton providerId={p.id} />
                          <details className="w-full">
                            <summary className="cursor-pointer text-brand-700 text-xs hover:underline">Modifica</summary>
                            <div className="mt-3 p-3 rounded-lg border border-slate-200 bg-slate-50 min-w-[280px]">
                              <ProviderForm
                                provider={{ id: p.id, kind: p.kind, name: p.name, baseUrl: p.baseUrl, maskedKey: p.maskedKey, enabled: p.enabled }}
                                kinds={KINDS}
                              />
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

        <Card title="Aggiungi provider">
          <ProviderForm kinds={KINDS} />
        </Card>
      </div>
    </>
  );
}
