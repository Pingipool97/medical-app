import 'server-only';
import { db } from '../db';
import { callAi } from './provider';
import { pseudonymize, reidentify } from './pseudonymize';
import { checkPatientAssistantInput, checkPatientAssistantOutput, PATIENT_REDIRECT_MESSAGE } from './guardrails';
import { MEDICAL_DISCLAIMER, PATIENT_DISCLAIMER, FEATURE_FLAGS } from '../constants';
import { flagEnabled } from '../settings';
import { audit } from '../audit';
import type { Session } from '../auth';
import { decryptField } from '../crypto';

// ───────────────────────── Contesto paziente ─────────────────────────

export type SourceRef = { documentId: string; title: string; date: string | null };

export async function buildPatientContext(patientId: string, opts?: { doctorId?: string }) {
  const p = await db.patientProfile.findUnique({
    where: { id: patientId },
    include: {
      conditions: true, allergies: true, medications: true, surgeries: true,
      vaccinations: true, familyHistory: true, lifestyle: true, pregnancy: true,
      vitals: { orderBy: { measuredAt: 'desc' }, take: 30 },
    },
  });
  if (!p) throw new Error('NOT_FOUND');

  // Il medico vede solo i documenti condivisi con lui; senza doctorId (uso interno) tutti
  const docs = await db.document.findMany({
    where: {
      patientId,
      deletedAt: null,
      status: 'PROCESSED',
      ...(opts?.doctorId ? { sharedWith: { some: { doctorId: opts.doctorId, revokedAt: null } } } : {}),
    },
    include: { labResults: { include: { analyte: true } } },
    orderBy: { docDate: 'desc' },
    take: 25,
  });

  const sources: SourceRef[] = docs.map((d) => ({
    documentId: d.id,
    title: d.title,
    date: d.docDate ? d.docDate.toISOString().slice(0, 10) : null,
  }));

  const lines: string[] = [];
  lines.push(`PROFILO: ${p.biologicalSex === 'F' ? 'donna' : 'uomo'}, nato/a ${p.birthDate.toISOString().slice(0, 10)}. Completezza profilo: ${p.profileCompleteness}%.`);
  if (p.pregnancy?.isPregnant) lines.push('ATTENZIONE: gravidanza in corso dichiarata.');
  if (p.pregnancy?.isBreastfeeding) lines.push('ATTENZIONE: allattamento in corso dichiarato.');
  lines.push(`ALLERGIE (${p.allergies.length}): ` + (p.allergies.map((a) => `${a.allergen} (${a.kind}, ${a.severity}${a.reaction ? ', reazione: ' + a.reaction : ''})`).join('; ') || 'nessuna registrata'));
  lines.push(`FARMACI ATTUALI (${p.medications.filter((m) => m.active).length}): ` + (p.medications.filter((m) => m.active).map((m) => `${m.name} ${m.dosage ?? ''} ${m.frequency ?? ''}`.trim()).join('; ') || 'nessuno registrato'));
  const stopped = p.medications.filter((m) => !m.active);
  if (stopped.length) lines.push('FARMACI SOSPESI: ' + stopped.map((m) => `${m.name}${m.stopReason ? ' (sospeso: ' + m.stopReason + ')' : ''}`).join('; '));
  lines.push('PATOLOGIE: ' + (p.conditions.map((c) => `${c.name} (${c.status === 'ACTIVE' ? 'attiva' : 'risolta'})`).join('; ') || 'nessuna registrata'));
  if (p.surgeries.length) lines.push('INTERVENTI: ' + p.surgeries.map((s) => `${s.name} (${s.date?.toISOString().slice(0, 10) ?? 'data n.d.'})`).join('; '));
  if (p.familyHistory.length) lines.push('FAMILIARITÀ: ' + p.familyHistory.map((f) => `${f.relation}: ${f.condition}`).join('; '));
  if (p.lifestyle) lines.push(`STILE DI VITA: fumo ${p.lifestyle.smoking ?? 'n.d.'}, alcol ${p.lifestyle.alcohol ?? 'n.d.'}, attività fisica ${p.lifestyle.physicalActivity ?? 'n.d.'}`);
  if (p.vitals.length) {
    lines.push('MISURAZIONI RECENTI: ' + p.vitals.slice(0, 10).map((v) => `${v.type} ${v.value}${v.value2 ? '/' + v.value2 : ''} ${v.unit} (${v.measuredAt.toISOString().slice(0, 10)})`).join('; '));
  }
  lines.push('');
  lines.push(`DOCUMENTI DISPONIBILI (${docs.length}):`);
  for (const d of docs) {
    lines.push(`--- [DOC:${d.id}] "${d.title}" (${d.docTypeCode}, ${d.docDate?.toISOString().slice(0, 10) ?? 'data n.d.'}) ---`);
    if (d.labResults.length) {
      lines.push('Valori estratti: ' + d.labResults.map((r) => `${r.analyte?.name ?? r.rawName}: ${r.value} ${r.unit ?? ''}${r.outOfRange ? ' [FUORI RANGE]' : ''}${r.humanConfirmed ? '' : ' [non confermato da umano]'}`).join('; '));
    }
    if (d.extractedText) lines.push(d.extractedText.slice(0, 2500));
  }

  return {
    profile: p,
    contextText: lines.join('\n'),
    sources,
    coverageNote: `Analisi basata su ${docs.length} documenti e un profilo completo al ${p.profileCompleteness}%. I dati non registrati nel diario non sono considerati.`,
    identities: [{ firstName: p.firstName, lastName: p.lastName }],
  };
}

// ───────────────────────── Funzioni con flusso bozza→revisione ─────────────────────────

async function runDraftFunction(opts: {
  functionKey: string;
  audience: 'DOCTOR' | 'PATIENT';
  session: Session;
  patientId: string;
  documentId?: string;
  system: string;
  userText: string;
  sources: SourceRef[];
  coverageNote: string;
  identities: { firstName?: string | null; lastName?: string | null }[];
}) {
  const { text: pseudoText, map } = pseudonymize(opts.userText, opts.identities);
  const result = await callAi({
    functionKey: opts.functionKey,
    system: opts.system,
    userText: pseudoText,
    requestedById: opts.session.userId,
    requestedByRole: opts.session.role,
    patientId: opts.patientId,
    documentId: opts.documentId,
  });

  await audit({
    actorUserId: opts.session.userId,
    actorRole: opts.session.role,
    action: 'AI_REQUEST',
    targetType: 'AiJob',
    targetId: result.jobId,
    patientId: opts.patientId,
    metadata: { functionKey: opts.functionKey, ok: result.ok },
  });

  if (!result.ok) {
    return { ok: false as const, message: result.fallback, blocked: result.blocked };
  }

  const content = reidentify(result.text, map);
  const insufficient = /NON_HO_ELEMENTI_SUFFICIENTI/.test(content);
  const output = await db.aiOutput.create({
    data: {
      jobId: result.jobId,
      audience: opts.audience,
      state: 'DRAFT',
      contentDraft: content.replace('NON_HO_ELEMENTI_SUFFICIENTI', '').trim() || 'Non ho elementi sufficienti per questa analisi.',
      sources: JSON.stringify(opts.sources),
      coverageNote: opts.coverageNote,
      insufficientData: insufficient,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600_000), // le bozze scadono, mai zombie
    },
  });
  return { ok: true as const, output };
}

export async function runDocumentSummary(session: Session, documentId: string, audience: 'DOCTOR' | 'PATIENT') {
  const doc = await db.document.findUnique({ where: { id: documentId }, include: { patient: true, labResults: { include: { analyte: true } } } });
  if (!doc) throw new Error('NOT_FOUND');
  const functionKey = audience === 'DOCTOR' ? 'riassunto_referto_medico' : 'riassunto_referto_paziente';
  const labs = doc.labResults.map((r) => `${r.analyte?.name ?? r.rawName}: ${r.value} ${r.unit ?? ''}${r.outOfRange ? ' [FUORI RANGE]' : ''}`).join('; ');
  return runDraftFunction({
    functionKey,
    audience,
    session,
    patientId: doc.patientId,
    documentId,
    system: '', // il prompt attivo versionato viene caricato dal provider
    userText: `Documento [DOC:${doc.id}] "${doc.title}" (tipo: ${doc.docTypeCode}, data: ${doc.docDate?.toISOString().slice(0, 10) ?? 'n.d.'}).\n${labs ? 'Valori estratti: ' + labs + '\n' : ''}TESTO:\n${(doc.extractedText ?? '').slice(0, 12000) || '[testo non estratto]'}`,
    sources: [{ documentId: doc.id, title: doc.title, date: doc.docDate?.toISOString().slice(0, 10) ?? null }],
    coverageNote: `Riassunto del solo documento "${doc.title}"${doc.extractionQuality === 'PARZIALE' ? ' — ATTENZIONE: estrazione testo parziale' : ''}.`,
    identities: [{ firstName: doc.patient.firstName, lastName: doc.patient.lastName }],
  });
}

export async function runPatientSynthesis(session: Session, patientId: string) {
  const ctx = await buildPatientContext(patientId, { doctorId: session.doctorId });
  return runDraftFunction({
    functionKey: 'sintesi_paziente',
    audience: 'DOCTOR',
    session,
    patientId,
    system: '',
    userText: ctx.contextText,
    sources: ctx.sources,
    coverageNote: ctx.coverageNote,
    identities: ctx.identities,
  });
}

export async function runClinicalSuggestions(session: Session, patientId: string) {
  // Perimetro CDS: doppio cancello — feature flag globale (scelta regolatoria) + funzione abilitata
  if (!(await flagEnabled(FEATURE_FLAGS.CDS_SUGGERIMENTI))) {
    return { ok: false as const, message: 'Il modulo di supporto decisionale (suggerimenti clinici) non è attivo su questa installazione. L’attivazione è una scelta regolatoria dell’amministratore (potenziale dispositivo medico).', blocked: 'DISABLED' as const };
  }
  const ctx = await buildPatientContext(patientId, { doctorId: session.doctorId });
  return runDraftFunction({
    functionKey: 'suggerimenti_clinici',
    audience: 'DOCTOR',
    session,
    patientId,
    system: '',
    userText: ctx.contextText,
    sources: ctx.sources,
    coverageNote: ctx.coverageNote,
    identities: ctx.identities,
  });
}

export async function runVisitPrep(session: Session, appointmentId: string, audience: 'DOCTOR' | 'PATIENT') {
  const appt = await db.appointment.findUnique({ where: { id: appointmentId }, include: { patient: true, service: true } });
  if (!appt) throw new Error('NOT_FOUND');
  const ctx = await buildPatientContext(appt.patientId, { doctorId: appt.doctorId });
  const q = appt.questionnaire ? `\nQUESTIONARIO PRE-VISITA: ${appt.questionnaire}` : '';
  return runDraftFunction({
    functionKey: audience === 'DOCTOR' ? 'prep_visita_medico' : 'prep_visita_paziente',
    audience,
    session,
    patientId: appt.patientId,
    system: '',
    userText: `Visita "${appt.service?.name ?? 'visita'}" del ${appt.startsAt.toISOString()}.${q}\n\n${ctx.contextText}`,
    sources: ctx.sources,
    coverageNote: ctx.coverageNote,
    identities: ctx.identities,
  });
}

// ───────────────────────── Chat clinica per il medico ─────────────────────────

export async function clinicalChat(session: Session, patientId: string, message: string) {
  const ctx = await buildPatientContext(patientId, { doctorId: session.doctorId });
  const history = await db.aiChatMessage.findMany({
    where: { patientId, doctorUserId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  const historyText = history.reverse().map((m) => `${m.role === 'user' ? 'MEDICO' : 'ASSISTENTE'}: ${m.content}`).join('\n');

  await db.aiChatMessage.create({ data: { patientId, doctorUserId: session.userId, role: 'user', content: message } });

  const { text: pseudo, map } = pseudonymize(
    `${ctx.contextText}\n\nCONVERSAZIONE PRECEDENTE:\n${historyText}\n\nDOMANDA DEL MEDICO: ${message}`,
    ctx.identities
  );
  const result = await callAi({
    functionKey: 'chat_clinica',
    system: '',
    userText: pseudo,
    requestedById: session.userId,
    requestedByRole: session.role,
    patientId,
  });
  const answer = result.ok ? reidentify(result.text, map) : result.ok === false ? result.fallback : '';
  await db.aiChatMessage.create({
    data: {
      patientId,
      doctorUserId: session.userId,
      role: 'assistant',
      content: answer,
      jobId: result.jobId,
      sources: JSON.stringify(ctx.sources),
    },
  });
  await audit({ actorUserId: session.userId, actorRole: session.role, action: 'AI_REQUEST', targetType: 'AiChat', patientId, metadata: { functionKey: 'chat_clinica' } });
  return { answer, disclaimer: MEDICAL_DISCLAIMER, coverageNote: ctx.coverageNote };
}

// ───────────────────────── Assistente paziente (fortemente limitato) ─────────────────────────

export async function patientAssistant(session: Session, patientId: string, question: string) {
  const inputCheck = checkPatientAssistantInput(question);
  if (!inputCheck.allowed) {
    await audit({ actorUserId: session.userId, actorRole: session.role, action: 'GUARDRAIL_BLOCK', patientId, metadata: { stage: 'input', reason: inputCheck.reason } });
    return { answer: PATIENT_REDIRECT_MESSAGE, blocked: true, disclaimer: PATIENT_DISCLAIMER };
  }
  // Contesto minimo: solo il testo dei documenti del paziente per spiegare i termini, niente diario completo
  const docs = await db.document.findMany({
    where: { patientId, deletedAt: null, status: 'PROCESSED' },
    orderBy: { docDate: 'desc' },
    take: 5,
    select: { id: true, title: true, extractedText: true },
  });
  const ctxText = docs.map((d) => `[DOC:${d.id}] "${d.title}":\n${(d.extractedText ?? '').slice(0, 1500)}`).join('\n\n');
  const p = await db.patientProfile.findUnique({ where: { id: patientId }, select: { firstName: true, lastName: true } });
  const { text: pseudo, map } = pseudonymize(`ESTRATTI DAI REFERTI DEL PAZIENTE:\n${ctxText}\n\nDOMANDA: ${question}`, [p ?? {}]);

  const result = await callAi({
    functionKey: 'assistente_paziente',
    system: '',
    userText: pseudo,
    requestedById: session.userId,
    requestedByRole: session.role,
    patientId,
  });
  if (!result.ok) return { answer: result.fallback, blocked: false, disclaimer: PATIENT_DISCLAIMER };

  const answer = reidentify(result.text, map);
  const outCheck = checkPatientAssistantOutput(answer);
  if (!outCheck.allowed) {
    await audit({ actorUserId: session.userId, actorRole: session.role, action: 'GUARDRAIL_BLOCK', patientId, metadata: { stage: 'output', reason: outCheck.reason, jobId: result.jobId } });
    return { answer: PATIENT_REDIRECT_MESSAGE, blocked: true, disclaimer: PATIENT_DISCLAIMER };
  }
  return { answer, blocked: false, disclaimer: PATIENT_DISCLAIMER };
}

// ───────────────────────── Interazioni farmacologiche: motore DETERMINISTICO ─────────────────────────
// Nessun LLM decide qui: regole dalla banca dati admin. Se la banca dati è vuota, la funzione
// si dichiara non configurata invece di dare falsa sicurezza. Funzione nel perimetro CDS.

export type InteractionAlert = { severity: string; kind: 'INTERAZIONE' | 'ALLERGIA' | 'GRAVIDANZA' | 'ALLATTAMENTO'; message: string };

export async function checkDrugSafety(patientId: string, proposedDrug: string): Promise<
  { configured: false; message: string } | { configured: true; alerts: InteractionAlert[]; coverage: string }
> {
  if (!(await flagEnabled(FEATURE_FLAGS.CDS_INTERAZIONI))) {
    return { configured: false, message: 'Il controllo interazioni non è attivo su questa installazione (modulo CDS disattivato dall’amministratore).' };
  }
  const rulesCount = await db.drugInteractionRule.count({ where: { active: true } });
  if (rulesCount === 0) {
    return { configured: false, message: 'La banca dati delle interazioni non è configurata: il controllo non può essere eseguito. Nessun controllo parziale viene spacciato per completo.' };
  }
  const p = await db.patientProfile.findUnique({
    where: { id: patientId },
    include: { medications: { where: { active: true } }, allergies: true, pregnancy: true },
  });
  if (!p) throw new Error('NOT_FOUND');

  const proposed = proposedDrug.toLowerCase().trim();
  const current = p.medications.map((m) => m.name.toLowerCase().trim());
  const alerts: InteractionAlert[] = [];

  for (const drug of current) {
    const rules = await db.drugInteractionRule.findMany({
      where: {
        active: true,
        OR: [
          { substanceA: { contains: proposed }, substanceB: { contains: drug } },
          { substanceA: { contains: drug }, substanceB: { contains: proposed } },
        ],
      },
    });
    for (const r of rules) {
      alerts.push({ severity: r.severity, kind: 'INTERAZIONE', message: `${r.substanceA} + ${r.substanceB}: ${r.note}` });
    }
  }

  const contra = await db.drugContraindication.findMany({ where: { active: true, substance: { contains: proposed } } });
  for (const c of contra) {
    if (c.condition === 'GRAVIDANZA' && p.pregnancy?.isPregnant) {
      alerts.push({ severity: c.severity, kind: 'GRAVIDANZA', message: `${c.substance} in gravidanza: ${c.note}` });
    }
    if (c.condition === 'ALLATTAMENTO' && p.pregnancy?.isBreastfeeding) {
      alerts.push({ severity: c.severity, kind: 'ALLATTAMENTO', message: `${c.substance} in allattamento: ${c.note}` });
    }
    if (c.condition.startsWith('ALLERGIA:')) {
      const allergen = c.condition.split(':')[1].toLowerCase();
      if (p.allergies.some((a) => a.allergen.toLowerCase().includes(allergen))) {
        alerts.push({ severity: c.severity, kind: 'ALLERGIA', message: `Allergia dichiarata a ${allergen}: ${c.note}` });
      }
    }
  }
  // Allergia diretta al farmaco proposto
  for (const a of p.allergies) {
    if (a.kind === 'FARMACO' && proposed.includes(a.allergen.toLowerCase())) {
      alerts.push({ severity: 'GRAVE', kind: 'ALLERGIA', message: `Il paziente dichiara allergia a ${a.allergen}${a.reaction ? ' (reazione: ' + a.reaction + ')' : ''}.` });
    }
  }

  return {
    configured: true,
    alerts,
    coverage: `Controllo eseguito su ${p.medications.length} farmaci attivi registrati, ${p.allergies.length} allergie dichiarate, stato gravidanza ${p.pregnancy ? 'noto' : 'NON dichiarato'}. Profilo completo al ${p.profileCompleteness}%: il controllo copre solo ciò che è registrato nel diario.`,
  };
}
