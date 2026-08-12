import 'server-only';
import { db } from '../db';
import { decryptField } from '../crypto';
import { getSetting } from '../settings';
import { MODEL_COSTS } from '../constants';
import { audit } from '../audit';

// Client verso il provider IA configurato dall'admin (formato API Anthropic Messages).
// Regole ferree implementate qui:
// - tetto di spesa giornaliero/mensile con blocco automatico (mai superato in silenzio)
// - tracciabilità completa: ogni chiamata crea un AiJob con modello, token, costo
// - fallback deterministico: mai un crash, mai un output inventato

export type AiCallResult =
  | { ok: true; text: string; inputTokens: number; outputTokens: number; costCents: number; jobId: string }
  | { ok: false; fallback: string; jobId: string; blocked?: 'BUDGET' | 'DISABLED' | 'NO_PROVIDER' };

const FALLBACK_TEXT =
  'Il servizio di analisi automatica non è al momento disponibile. Nessun contenuto è stato generato. ' +
  'Riprova più tardi oppure procedi manualmente: i documenti e i dati restano consultabili.';

async function budgetExceeded(): Promise<boolean> {
  const caps = await getSetting<{ dailyCents: number; monthlyCents: number }>('ai_spending_caps', { dailyCents: 500, monthlyCents: 5000 });
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [day, month] = await Promise.all([
    db.aiJob.aggregate({ _sum: { costCents: true }, where: { createdAt: { gte: dayStart } } }),
    db.aiJob.aggregate({ _sum: { costCents: true }, where: { createdAt: { gte: monthStart } } }),
  ]);
  return (day._sum.costCents ?? 0) >= caps.dailyCents || (month._sum.costCents ?? 0) >= caps.monthlyCents;
}

export async function callAi(opts: {
  functionKey: string;
  system: string;
  userText: string;
  requestedById: string;
  requestedByRole: string;
  patientId?: string;
  documentId?: string;
}): Promise<AiCallResult> {
  const cfg = await db.aiFunctionConfig.findUnique({ where: { functionKey: opts.functionKey } });
  const activePrompt = await db.promptTemplate.findFirst({
    where: { functionKey: opts.functionKey, active: true },
    orderBy: { version: 'desc' },
  });
  const model = cfg?.model ?? 'claude-haiku-4-5-20251001';

  const job = await db.aiJob.create({
    data: {
      functionKey: opts.functionKey,
      requestedById: opts.requestedById,
      requestedByRole: opts.requestedByRole,
      patientId: opts.patientId,
      documentId: opts.documentId,
      model,
      promptVersion: activePrompt?.version,
      status: 'PENDING',
    },
  });

  const fail = async (status: string, blocked?: 'BUDGET' | 'DISABLED' | 'NO_PROVIDER', error?: string): Promise<AiCallResult> => {
    await db.aiJob.update({ where: { id: job.id }, data: { status, error } });
    return { ok: false, fallback: FALLBACK_TEXT, jobId: job.id, blocked };
  };

  if (!cfg || !cfg.enabled) return fail('BLOCKED_GUARDRAIL', 'DISABLED', 'Funzione disattivata dal pannello admin');
  if (await budgetExceeded()) {
    await audit({ action: 'AI_BUDGET_BLOCK', metadata: { functionKey: opts.functionKey } });
    return fail('BLOCKED_BUDGET', 'BUDGET', 'Tetto di spesa raggiunto');
  }

  // La chiave arriva dal pannello admin (cifrata nel DB) oppure da AI_API_KEY.
  // Sulla demo il DB è effimero: l'env var è l'unica configurazione che sopravvive ai riavvii.
  const provider = await db.providerConfig.findFirst({ where: { kind: 'AI', enabled: true } });
  const apiKey = (provider?.apiKeyEnc ? decryptField(provider.apiKeyEnc) : '') || (process.env.AI_API_KEY ?? '').trim();
  if (!apiKey) return fail('FALLBACK', 'NO_PROVIDER', 'Nessun provider IA configurato');
  const baseUrl = provider?.baseUrl || process.env.AI_BASE_URL || 'https://api.anthropic.com';

  // Il prompt di sistema versionato (editor admin) prevale su quello passato dal codice
  const system = (activePrompt?.content || opts.system).trim();

  try {
    const res = await fetch(baseUrl + '/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
        system,
        messages: [{ role: 'user', content: opts.userText }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return fail('ERROR', undefined, `HTTP ${res.status}: ${errBody.slice(0, 300)}`);
    }
    const data = await res.json();
    const text: string = (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const costs = MODEL_COSTS[model] ?? { input: 300, output: 1500 };
    const costCents = (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;

    await db.aiJob.update({
      where: { id: job.id },
      data: { status: 'DONE', inputTokens, outputTokens, costCents },
    });
    if (!text.trim()) return fail('ERROR', undefined, 'Risposta vuota dal provider');
    return { ok: true, text, inputTokens, outputTokens, costCents, jobId: job.id };
  } catch (err: any) {
    return fail('ERROR', undefined, String(err?.message ?? err).slice(0, 300));
  }
}

export async function testAiProvider(providerId: string): Promise<{ ok: boolean; message: string }> {
  const provider = await db.providerConfig.findUnique({ where: { id: providerId } });
  const apiKey = (provider?.apiKeyEnc ? decryptField(provider.apiKeyEnc) : '') || (process.env.AI_API_KEY ?? '').trim();
  if (!apiKey) return { ok: false, message: 'Chiave API non configurata' };
  try {
    const res = await fetch((provider?.baseUrl || process.env.AI_BASE_URL || 'https://api.anthropic.com') + '/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Rispondi solo: OK' }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return { ok: true, message: 'Connessione riuscita' };
    return { ok: false, message: `Errore HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, message: `Connessione fallita: ${String(err?.message ?? err).slice(0, 150)}` };
  }
}
