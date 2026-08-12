'use server';

// Server action del pannello admin.
// Regole ferree:
// - ogni action inizia con requireSession(['ADMIN'])
// - ogni action chiude con audit({ action: 'ADMIN_CONFIG', ... }) — nei metadata MAI valori di chiavi o segreti
// - le chiavi API sono cifrate con encryptField e mai restituite al client

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireSession, clientInfo, type Session } from '@/lib/auth';
import { encryptField, decryptField } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { setSetting } from '@/lib/settings';
import { testAiProvider } from '@/lib/ai/provider';
import { AI_FUNCTIONS, FEATURE_FLAGS, NOTIFICATION_EVENTS } from '@/lib/constants';
import { renderTemplate, SAMPLE_VARS } from './template/render';

export type ActionState = { error?: string; success?: string } | null;

const PROVIDER_KINDS = ['AI', 'OCR', 'EMAIL', 'SMS', 'PUSH', 'STORAGE', 'VIDEO', 'PAGAMENTI', 'FIRMA', 'SSN'];
const SEVERITIES = ['GRAVE', 'MODERATA', 'LIEVE'];
const CONSENT_KINDS = ['PRIVACY', 'ART9_SALUTE', 'TERMINI', 'IA_TRATTAMENTO'];

// Mappa funzione CDS → feature flag regolatorio che ne governa l'attivazione
const CDS_FLAG_BY_FUNCTION: Record<string, string> = {
  suggerimenti_clinici: FEATURE_FLAGS.CDS_SUGGERIMENTI,
  interazioni_farmaci: FEATURE_FLAGS.CDS_INTERAZIONI,
};

async function requireAdmin(): Promise<Session> {
  return requireSession(['ADMIN']);
}

async function auditAdmin(s: Session, targetType: string, targetId: string | undefined, metadata: Record<string, unknown>) {
  const { ip, userAgent } = clientInfo();
  await audit({ actorUserId: s.userId, actorRole: s.role, action: 'ADMIN_CONFIG', targetType, targetId, metadata, ip, userAgent });
}

function str(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

function numOrNull(formData: FormData, name: string): number | null {
  const raw = str(formData, name).replace(',', '.');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────── Provider ───────────────────────────

export async function saveProviderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const id = str(formData, 'id');
  const kind = str(formData, 'kind');
  const name = str(formData, 'name');
  const baseUrl = str(formData, 'baseUrl');
  const apiKey = String(formData.get('apiKey') ?? '').trim(); // vuoto = non cambiare
  const enabled = formData.get('enabled') === 'on';

  if (!PROVIDER_KINDS.includes(kind)) return { error: 'Tipo di provider non valido.' };
  if (!name) return { error: 'Il nome del provider è obbligatorio.' };
  if (baseUrl && !/^https?:\/\/\S+$/.test(baseUrl)) return { error: 'La base URL deve iniziare con http:// o https://.' };

  let providerId = id;
  if (id) {
    const existing = await db.providerConfig.findUnique({ where: { id } });
    if (!existing) return { error: 'Provider non trovato.' };
    if (kind !== existing.kind || name !== existing.name) {
      const dup = await db.providerConfig.findUnique({ where: { kind_name: { kind, name } } });
      if (dup && dup.id !== id) return { error: 'Esiste già un provider con questo tipo e questo nome.' };
    }
    await db.providerConfig.update({
      where: { id },
      data: { kind, name, baseUrl: baseUrl || null, enabled, ...(apiKey ? { apiKeyEnc: encryptField(apiKey) } : {}) },
    });
  } else {
    const dup = await db.providerConfig.findUnique({ where: { kind_name: { kind, name } } });
    if (dup) return { error: 'Esiste già un provider con questo tipo e questo nome.' };
    const created = await db.providerConfig.create({
      data: { kind, name, baseUrl: baseUrl || null, enabled, apiKeyEnc: apiKey ? encryptField(apiKey) : null },
    });
    providerId = created.id;
  }

  await auditAdmin(s, 'ProviderConfig', providerId, { kind, name, enabled, apiKeyChanged: Boolean(apiKey) });
  revalidatePath('/admin/provider');
  revalidatePath('/admin');
  return { success: id ? 'Provider aggiornato.' : 'Provider creato.' };
}

export async function testProviderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const id = str(formData, 'id');
  const provider = await db.providerConfig.findUnique({ where: { id } });
  if (!provider) return { error: 'Provider non trovato.' };

  let ok = false;
  let message = '';
  if (provider.kind === 'AI') {
    const res = await testAiProvider(id);
    ok = res.ok;
    message = res.message;
  } else {
    // Per gli altri kind non esiste ancora un adapter: verifica onesta di formato, dichiarata come tale.
    const key = provider.apiKeyEnc ? decryptField(provider.apiKeyEnc) : '';
    const urlOk = !provider.baseUrl || /^https?:\/\/\S+$/.test(provider.baseUrl);
    if (!key) {
      message = 'Chiave API non configurata.';
    } else if (key.length < 8) {
      message = 'La chiave API sembra troppo corta per essere valida.';
    } else if (!urlOk) {
      message = 'La base URL non è un indirizzo http(s) valido.';
    } else {
      ok = true;
      message = 'Formato di chiave e base URL verificati. Test di connessione reale disponibile solo con l’adapter del provider.';
    }
  }

  await db.providerConfig.update({
    where: { id },
    data: { lastTestAt: new Date(), lastTestOk: ok, lastTestMessage: message },
  });
  await auditAdmin(s, 'ProviderConfig', id, { test: true, kind: provider.kind, name: provider.name, ok });
  revalidatePath('/admin/provider');
  revalidatePath('/admin');
  return ok ? { success: message } : { error: message };
}

// ─────────────────────────── Configurazione IA ───────────────────────────

export async function saveAiFunctionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const functionKey = str(formData, 'functionKey');
  const def = AI_FUNCTIONS.find((f) => f.key === functionKey);
  if (!def) return { error: 'Funzione IA non riconosciuta.' };

  const enabled = formData.get('enabled') === 'on';
  const modelCustom = str(formData, 'modelCustom');
  const modelSelect = str(formData, 'model');
  const model = modelCustom || modelSelect;
  if (!model || model === '__custom') return { error: 'Indica il modello da utilizzare.' };

  const temperature = numOrNull(formData, 'temperature');
  const maxTokensRaw = numOrNull(formData, 'maxTokens');
  if (temperature === null || temperature < 0 || temperature > 1) return { error: 'La temperatura deve essere un numero tra 0 e 1.' };
  const maxTokens = maxTokensRaw === null ? null : Math.round(maxTokensRaw);
  if (maxTokens === null || maxTokens < 100 || maxTokens > 64000) return { error: 'maxTokens deve essere un numero tra 100 e 64000.' };

  // Perimetro CDS (potenziale dispositivo medico): l'abilitazione richiede il feature flag regolatorio attivo
  if (enabled && def.isCds) {
    const flagKey = CDS_FLAG_BY_FUNCTION[functionKey];
    const flag = flagKey ? await db.featureFlag.findUnique({ where: { key: flagKey } }) : null;
    if (!flag?.enabled) return { error: 'Attiva prima il feature flag CDS (scelta regolatoria).' };
  }

  await db.aiFunctionConfig.upsert({
    where: { functionKey },
    update: { enabled, model, temperature, maxTokens },
    create: { functionKey, label: def.label, isCds: def.isCds, enabled, model, temperature, maxTokens },
  });

  await auditAdmin(s, 'AiFunctionConfig', functionKey, { functionKey, enabled, model, temperature, maxTokens, isCds: def.isCds });
  revalidatePath('/admin/ia');
  return { success: `Configurazione di «${def.label}» salvata.` };
}

export async function saveSpendingCapsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const daily = numOrNull(formData, 'dailyEuro');
  const monthly = numOrNull(formData, 'monthlyEuro');
  if (daily === null || daily <= 0 || monthly === null || monthly <= 0) {
    return { error: 'Indica tetti di spesa validi (importi in euro maggiori di zero).' };
  }
  const caps = { dailyCents: Math.round(daily * 100), monthlyCents: Math.round(monthly * 100) };
  if (caps.dailyCents > caps.monthlyCents) return { error: 'Il tetto giornaliero non può superare quello mensile.' };
  await setSetting('ai_spending_caps', caps);
  await auditAdmin(s, 'SystemSetting', 'ai_spending_caps', { dailyCents: caps.dailyCents, monthlyCents: caps.monthlyCents });
  revalidatePath('/admin/ia');
  revalidatePath('/admin');
  return { success: 'Tetti di spesa aggiornati.' };
}

// ─────────────────────────── Prompt versionati ───────────────────────────

export async function savePromptVersionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const functionKey = str(formData, 'functionKey');
  const content = String(formData.get('content') ?? '').trim();
  if (!AI_FUNCTIONS.some((f) => f.key === functionKey)) return { error: 'Funzione IA non riconosciuta.' };
  if (content.length < 20) return { error: 'Il prompt è troppo corto per essere salvato come versione.' };

  const max = await db.promptTemplate.aggregate({ _max: { version: true }, where: { functionKey } });
  const version = (max._max.version ?? 0) + 1;
  const created = await db.promptTemplate.create({
    data: { functionKey, version, content, active: false, createdBy: s.email },
  });

  await auditAdmin(s, 'PromptTemplate', created.id, { functionKey, version, activated: false, contentLength: content.length });
  revalidatePath('/admin/prompt');
  return { success: `Salvata la versione ${version} (non attiva). Attivala esplicitamente quando è pronta.` };
}

export async function activatePromptVersionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const id = str(formData, 'id');
  const tpl = await db.promptTemplate.findUnique({ where: { id } });
  if (!tpl) return { error: 'Versione non trovata.' };

  await db.$transaction([
    db.promptTemplate.updateMany({ where: { functionKey: tpl.functionKey }, data: { active: false } }),
    db.promptTemplate.update({ where: { id }, data: { active: true } }),
  ]);

  await auditAdmin(s, 'PromptTemplate', id, { functionKey: tpl.functionKey, version: tpl.version, activated: true });
  revalidatePath('/admin/prompt');
  return { success: `Versione ${tpl.version} attivata: verrà usata al posto del prompt di default.` };
}

// ─────────────────────────── Template comunicazioni ───────────────────────────

export async function saveTemplateVersionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const key = str(formData, 'key');
  const channel = str(formData, 'channel');
  const subject = str(formData, 'subject');
  const body = String(formData.get('body') ?? '').trim();
  if (!key || !channel) return { error: 'Template non identificato.' };
  if (!body) return { error: 'Il contenuto del template non può essere vuoto.' };

  const max = await db.messageTemplate.aggregate({ _max: { version: true }, where: { key, channel } });
  const version = (max._max.version ?? 0) + 1;
  const [, created] = await db.$transaction([
    db.messageTemplate.updateMany({ where: { key, channel }, data: { active: false } }),
    db.messageTemplate.create({ data: { key, channel, version, subject: subject || null, body, active: true } }),
  ]);

  await auditAdmin(s, 'MessageTemplate', created.id, { key, channel, version });
  revalidatePath('/admin/template');
  return { success: `Salvata e attivata la versione ${version} del template.` };
}

export async function sendTestTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const id = str(formData, 'id');
  const tpl = await db.messageTemplate.findUnique({ where: { id } });
  if (!tpl) return { error: 'Template non trovato.' };

  const renderedBody = renderTemplate(tpl.body, SAMPLE_VARS);
  const renderedSubject = tpl.subject ? renderTemplate(tpl.subject, SAMPLE_VARS) : `Test template ${tpl.key} (${tpl.channel})`;

  // Nessun provider email coinvolto: il test è una notifica in-app all'admin, dichiarata come tale.
  await db.notification.create({
    data: {
      userId: s.userId,
      eventKey: 'template_test',
      title: `[TEST TEMPLATE] ${renderedSubject}`,
      body: renderedBody,
      channel: 'INAPP',
      status: 'SENT',
      refType: 'MessageTemplate',
      refId: tpl.id,
    },
  });

  await auditAdmin(s, 'MessageTemplate', tpl.id, { key: tpl.key, channel: tpl.channel, version: tpl.version, testSent: 'INAPP' });
  revalidatePath('/admin/template');
  return {
    success:
      'Invio di prova effettuato: poiché nessun provider email/SMS è coinvolto, il contenuto renderizzato è stato recapitato come notifica in-app al tuo account admin.',
  };
}

// ─────────────────────────── Regole di notifica ───────────────────────────

export async function saveNotificationRuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const eventKey = str(formData, 'eventKey');
  const def = NOTIFICATION_EVENTS.find((e) => e.key === eventKey);
  if (!def) return { error: 'Evento non riconosciuto.' };

  const channels = ['INAPP']; // sempre attivo
  if (formData.get('ch_EMAIL') === 'on') channels.push('EMAIL');
  if (formData.get('ch_SMS') === 'on') channels.push('SMS');
  if (formData.get('ch_PUSH') === 'on') channels.push('PUSH');
  const enabled = formData.get('enabled') === 'on';

  await db.notificationRule.upsert({
    where: { eventKey },
    update: { channels: JSON.stringify(channels), enabled },
    create: { eventKey, label: def.label, channels: JSON.stringify(channels), enabled },
  });

  await auditAdmin(s, 'NotificationRule', eventKey, { eventKey, channels, enabled });
  revalidatePath('/admin/notifiche');
  return { success: `Regola per «${def.label}» salvata.` };
}

// ─────────────────────────── Anagrafiche ───────────────────────────

export async function saveAnagraficaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const tipo = str(formData, 'tipo');
  const id = str(formData, 'id');

  try {
    switch (tipo) {
      case 'specializzazioni': {
        const code = str(formData, 'code').toLowerCase().replace(/\s+/g, '_');
        const name = str(formData, 'name');
        if (!code || !name) return { error: 'Codice e nome sono obbligatori.' };
        const dup = await db.specialization.findUnique({ where: { code } });
        if (dup && dup.id !== id) return { error: `Esiste già una specializzazione con codice «${code}».` };
        const row = id
          ? await db.specialization.update({ where: { id }, data: { code, name } })
          : await db.specialization.create({ data: { code, name } });
        await auditAdmin(s, 'Specialization', row.id, { tipo, code, name });
        break;
      }
      case 'tipi-documento': {
        const code = id || str(formData, 'code').toUpperCase().replace(/\s+/g, '_');
        const name = str(formData, 'name');
        if (!code || !name) return { error: 'Codice e nome sono obbligatori.' };
        if (!id && (await db.documentTypeDef.findUnique({ where: { code } }))) {
          return { error: `Esiste già un tipo documento con codice «${code}».` };
        }
        await db.documentTypeDef.upsert({ where: { code }, update: { name }, create: { code, name } });
        await auditAdmin(s, 'DocumentTypeDef', code, { tipo, code, name });
        break;
      }
      case 'tipi-richiesta': {
        const code = id || str(formData, 'code').toUpperCase().replace(/\s+/g, '_');
        const name = str(formData, 'name');
        const slaRaw = numOrNull(formData, 'defaultSlaHours');
        if (!code || !name) return { error: 'Codice e nome sono obbligatori.' };
        const defaultSlaHours = slaRaw === null ? 48 : Math.round(slaRaw);
        if (defaultSlaHours < 1 || defaultSlaHours > 720) return { error: 'La SLA di default deve essere tra 1 e 720 ore.' };
        if (!id && (await db.requestTypeDef.findUnique({ where: { code } }))) {
          return { error: `Esiste già un tipo richiesta con codice «${code}».` };
        }
        await db.requestTypeDef.upsert({
          where: { code },
          update: { name, defaultSlaHours },
          create: { code, name, defaultSlaHours },
        });
        await auditAdmin(s, 'RequestTypeDef', code, { tipo, code, name, defaultSlaHours });
        break;
      }
      case 'analiti': {
        const code = str(formData, 'code').toUpperCase().replace(/\s+/g, '_');
        const name = str(formData, 'name');
        const unit = str(formData, 'unit');
        if (!code || !name || !unit) return { error: 'Codice, nome e unità di misura sono obbligatori.' };
        const refLow = numOrNull(formData, 'refLow');
        const refHigh = numOrNull(formData, 'refHigh');
        if (refLow !== null && refHigh !== null && refLow >= refHigh) {
          return { error: 'Il limite inferiore di riferimento deve essere minore di quello superiore.' };
        }
        const category = str(formData, 'category') || null;
        const aliasesRaw = str(formData, 'aliases');
        const aliases = aliasesRaw
          ? JSON.stringify(aliasesRaw.split(',').map((a) => a.trim()).filter(Boolean))
          : null;
        const dup = await db.labAnalyte.findUnique({ where: { code } });
        if (dup && dup.id !== id) return { error: `Esiste già un analita con codice «${code}».` };
        const data = { code, name, unit, refLow, refHigh, category, aliases };
        const row = id
          ? await db.labAnalyte.update({ where: { id }, data })
          : await db.labAnalyte.create({ data });
        await auditAdmin(s, 'LabAnalyte', row.id, { tipo, code, name });
        break;
      }
      case 'interazioni': {
        const substanceA = str(formData, 'substanceA').toLowerCase();
        const substanceB = str(formData, 'substanceB').toLowerCase();
        const severity = str(formData, 'severity');
        const note = str(formData, 'note');
        if (!substanceA || !substanceB || !note) return { error: 'Sostanze e nota sono obbligatorie.' };
        if (substanceA === substanceB) return { error: 'Le due sostanze devono essere diverse.' };
        if (!SEVERITIES.includes(severity)) return { error: 'Gravità non valida.' };
        const data = { substanceA, substanceB, severity, note };
        const row = id
          ? await db.drugInteractionRule.update({ where: { id }, data })
          : await db.drugInteractionRule.create({ data });
        await auditAdmin(s, 'DrugInteractionRule', row.id, { tipo, substanceA, substanceB, severity });
        break;
      }
      case 'controindicazioni': {
        const substance = str(formData, 'substance').toLowerCase();
        const condition = str(formData, 'condition').toUpperCase();
        const severity = str(formData, 'severity');
        const note = str(formData, 'note');
        if (!substance || !condition || !note) return { error: 'Sostanza, condizione e nota sono obbligatorie.' };
        if (!SEVERITIES.includes(severity)) return { error: 'Gravità non valida.' };
        if (!/^(GRAVIDANZA|ALLATTAMENTO|ALLERGIA:.+)$/.test(condition)) {
          return { error: 'Condizione non valida. Formati ammessi: GRAVIDANZA, ALLATTAMENTO oppure ALLERGIA:<allergene>.' };
        }
        const data = { substance, condition, severity, note };
        const row = id
          ? await db.drugContraindication.update({ where: { id }, data })
          : await db.drugContraindication.create({ data });
        await auditAdmin(s, 'DrugContraindication', row.id, { tipo, substance, condition, severity });
        break;
      }
      default:
        return { error: 'Anagrafica non riconosciuta.' };
    }
  } catch (err) {
    console.error('[ADMIN] saveAnagrafica', err);
    return { error: 'Salvataggio non riuscito. Controlla i dati inseriti e riprova.' };
  }

  revalidatePath(`/admin/anagrafiche/${tipo}`);
  return { success: 'Voce salvata.' };
}

export async function toggleAnagraficaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const tipo = str(formData, 'tipo');
  const id = str(formData, 'id');
  const active = str(formData, 'active') === 'true';
  if (!id) return { error: 'Voce non identificata.' };

  try {
    switch (tipo) {
      case 'specializzazioni':
        await db.specialization.update({ where: { id }, data: { active } });
        break;
      case 'tipi-documento':
        await db.documentTypeDef.update({ where: { code: id }, data: { active } });
        break;
      case 'tipi-richiesta':
        await db.requestTypeDef.update({ where: { code: id }, data: { active } });
        break;
      case 'analiti':
        await db.labAnalyte.update({ where: { id }, data: { active } });
        break;
      case 'interazioni':
        await db.drugInteractionRule.update({ where: { id }, data: { active } });
        break;
      case 'controindicazioni':
        await db.drugContraindication.update({ where: { id }, data: { active } });
        break;
      default:
        return { error: 'Anagrafica non riconosciuta.' };
    }
  } catch (err) {
    console.error('[ADMIN] toggleAnagrafica', err);
    return { error: 'Operazione non riuscita.' };
  }

  await auditAdmin(s, 'Anagrafica', id, { tipo, active });
  revalidatePath(`/admin/anagrafiche/${tipo}`);
  return { success: active ? 'Voce riattivata.' : 'Voce disattivata.' };
}

// ─────────────────────────── Utenti ───────────────────────────

export async function setUserStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const userId = str(formData, 'userId');
  const status = str(formData, 'status');
  if (!['SUSPENDED', 'ACTIVE'].includes(status)) return { error: 'Stato non valido.' };
  if (userId === s.userId) return { error: 'Non puoi sospendere o riattivare il tuo stesso account.' };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.status === 'DELETED') return { error: 'Utente non trovato.' };

  await db.user.update({ where: { id: userId }, data: { status } });
  await auditAdmin(s, 'User', userId, { status, role: user.role });
  revalidatePath('/admin/utenti');
  return { success: status === 'SUSPENDED' ? 'Utente sospeso.' : 'Utente riattivato.' };
}

export async function verifyDoctorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const doctorId = str(formData, 'doctorId');
  const decision = str(formData, 'decision');
  const note = str(formData, 'note');
  if (!['VERIFIED', 'REJECTED'].includes(decision)) return { error: 'Decisione non valida.' };
  if (decision === 'REJECTED' && !note) return { error: 'Per rifiutare una verifica è obbligatoria una nota motivata.' };

  const doctor = await db.doctorProfile.findUnique({ where: { id: doctorId }, include: { user: true } });
  if (!doctor) return { error: 'Profilo medico non trovato.' };

  await db.doctorProfile.update({
    where: { id: doctorId },
    data: {
      verificationStatus: decision,
      verifiedAt: new Date(),
      verifiedByUserId: s.userId,
      verificationNote: note || null,
    },
  });
  if (decision === 'VERIFIED') {
    await db.user.update({ where: { id: doctor.userId }, data: { status: 'ACTIVE' } });
  }

  await auditAdmin(s, 'DoctorProfile', doctorId, {
    decision,
    ordineNumber: doctor.ordineNumber,
    ordineProvince: doctor.ordineProvince,
    hasNote: Boolean(note),
  });
  revalidatePath('/admin/utenti');
  revalidatePath('/admin');
  return {
    success:
      decision === 'VERIFIED'
        ? `Dr. ${doctor.firstName} ${doctor.lastName} verificato: l'account è ora attivo.`
        : `Verifica di ${doctor.firstName} ${doctor.lastName} rifiutata.`,
  };
}

// ─────────────────────────── Consensi ───────────────────────────

export async function publishConsentVersionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const kind = str(formData, 'kind');
  const title = str(formData, 'title');
  const text = String(formData.get('text') ?? '').trim();
  if (!CONSENT_KINDS.includes(kind)) return { error: 'Tipo di informativa non valido.' };
  if (!title || text.length < 50) return { error: 'Titolo obbligatorio e testo di almeno 50 caratteri.' };

  const max = await db.consentVersion.aggregate({ _max: { version: true }, where: { kind } });
  const version = (max._max.version ?? 0) + 1;
  const [, created] = await db.$transaction([
    db.consentVersion.updateMany({ where: { kind }, data: { active: false } }),
    db.consentVersion.create({ data: { kind, version, title, text, active: true } }),
  ]);

  await auditAdmin(s, 'ConsentVersion', created.id, { kind, version, textLength: text.length });
  revalidatePath('/admin/consensi');
  return { success: `Pubblicata la versione ${version} dell'informativa ${kind}. La precedente non è più attiva.` };
}

// ─────────────────────────── Feature flag ───────────────────────────

export async function toggleFlagAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireAdmin();
  const key = str(formData, 'key');
  const enable = str(formData, 'enable') === 'true';

  const flag = await db.featureFlag.findUnique({ where: { key } });
  if (!flag) return { error: 'Feature flag non trovato.' };

  // Gate regolatorio: l'attivazione di un flag CDS richiede una dichiarazione esplicita di consapevolezza
  const cdsAck = formData.get('cdsAck') === 'on';
  if (flag.isCdsGate && enable && !cdsAck) {
    return {
      error:
        'Per attivare questo flag devi spuntare la dichiarazione di consapevolezza: configura la piattaforma come supporto decisionale clinico (potenziale dispositivo medico, MDR 2017/745).',
    };
  }

  await db.featureFlag.update({ where: { key }, data: { enabled: enable } });

  const metadata: Record<string, unknown> = { flag: key, enabled: enable };
  if (flag.isCdsGate && enable) metadata.cdsAck = true;
  await auditAdmin(s, 'FeatureFlag', key, metadata);
  revalidatePath('/admin/flags');
  return { success: enable ? `Flag «${flag.label}» attivato.` : `Flag «${flag.label}» disattivato.` };
}
