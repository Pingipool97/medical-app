import 'server-only';
import { db } from './db';
import { readDecrypted } from './storage';
import { notify } from './notify';

// Coda di elaborazione documenti: asincrona, con stato visibile all'utente (stepsLog) e retry.
// L'upload non muore mai in silenzio: ogni passo lascia traccia, ogni fallimento è visibile e ritentabile.

type Step = { step: string; ok: boolean; detail: string; at: string };

const CF_RE = /\b[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]\b/g;
const DATE_RE = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/;

export async function enqueueProcessing(documentId: string) {
  const job = await db.processingJob.create({ data: { documentId } });
  // Fire-and-forget: l'elaborazione parte subito ma non blocca la risposta all'utente.
  processJob(job.id).catch((err) => console.error('[PIPELINE] errore non gestito', err));
  return job.id;
}

export async function retryJob(jobId: string) {
  await db.processingJob.update({ where: { id: jobId }, data: { status: 'QUEUED', lastError: null } });
  processJob(jobId).catch((err) => console.error('[PIPELINE] errore retry', err));
}

async function processJob(jobId: string) {
  const job = await db.processingJob.findUnique({ where: { id: jobId }, include: { document: { include: { patient: { include: { user: true } } } } } });
  if (!job || job.status === 'RUNNING' || job.status === 'DONE') return;
  if (job.attempts >= job.maxAttempts) {
    await db.processingJob.update({ where: { id: jobId }, data: { status: 'FAILED', lastError: 'Numero massimo di tentativi raggiunto' } });
    await db.document.update({ where: { id: job.documentId }, data: { status: 'FAILED' } });
    return;
  }

  const steps: Step[] = [];
  const log = (step: string, ok: boolean, detail: string) => steps.push({ step, ok, detail, at: new Date().toISOString() });
  const doc = job.document;

  await db.processingJob.update({ where: { id: jobId }, data: { status: 'RUNNING', attempts: { increment: 1 } } });
  await db.document.update({ where: { id: doc.id }, data: { status: 'PROCESSING' } });

  try {
    // 1. Deduplica per hash
    const dup = await db.document.findFirst({
      where: { patientId: doc.patientId, sha256: doc.sha256, id: { not: doc.id }, deletedAt: null },
    });
    if (dup) {
      log('deduplica', false, `File identico a "${dup.title}" già caricato`);
      await db.document.update({
        where: { id: doc.id },
        data: { status: 'NEEDS_REVIEW', duplicateOfId: dup.id },
      });
      await finish(jobId, steps, 'DONE');
      return;
    }
    log('deduplica', true, 'Nessun duplicato');

    // 2. Estrazione testo
    let text = '';
    let quality: 'COMPLETA' | 'PARZIALE' | 'ILLEGGIBILE' = 'ILLEGGIBILE';
    let confidence = 0;
    if (doc.mimeType === 'application/pdf') {
      try {
        const buf = await readDecrypted(doc.filePath);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse');
        const parsed = await pdfParse(buf);
        text = (parsed.text ?? '').trim();
        if (text.length > 200) { quality = 'COMPLETA'; confidence = 0.95; }
        else if (text.length > 0) { quality = 'PARZIALE'; confidence = 0.5; }
        log('estrazione_testo', text.length > 0, text.length > 0 ? `${text.length} caratteri estratti dal PDF` : 'PDF senza testo nativo (scansione): serve OCR');
      } catch (e: any) {
        log('estrazione_testo', false, `Parsing PDF fallito: ${String(e?.message).slice(0, 120)}`);
      }
    }
    if (!text) {
      // Immagini o PDF scansionati: serve il provider OCR configurato
      const ocr = await db.providerConfig.findFirst({ where: { kind: 'OCR', enabled: true } });
      if (ocr) {
        // Adapter OCR: qui si integra il provider reale (deskew, contrasto, multi-pagina).
        log('ocr', false, `Provider OCR "${ocr.name}" configurato ma adapter non ancora collegato a un servizio reale`);
      } else {
        log('ocr', false, 'Nessun provider OCR configurato: il documento resta consultabile come immagine, i valori vanno inseriti manualmente');
      }
    }

    // 3. Coerenza intestatario: CF nel documento vs profilo (referto del figlio sul profilo della madre)
    const cfs = Array.from(new Set((text.toUpperCase().match(CF_RE) ?? [])));
    let thirdParty = false;
    if (cfs.length > 0) {
      const { lookupHash } = await import('./crypto');
      const patientMatches = cfs.some((cf) => lookupHash(cf) === doc.patient.codiceFiscaleHash);
      if (!patientMatches) {
        thirdParty = true;
        log('coerenza_intestatario', false, 'Nel documento compare un codice fiscale che non corrisponde all’intestatario del profilo: verifica richiesta');
      } else if (cfs.length > 1) {
        thirdParty = true;
        log('coerenza_intestatario', true, 'Rilevati dati di terzi nel documento: possibile oscuramento');
      } else {
        log('coerenza_intestatario', true, 'Intestatario coerente con il profilo');
      }
    } else {
      log('coerenza_intestatario', true, 'Nessun codice fiscale rilevato nel testo');
    }

    // 4. Data del documento (estratta, da confermare)
    let extractedDate: Date | null = null;
    const dm = text.match(DATE_RE);
    if (dm) {
      const d = new Date(parseInt(dm[3]), parseInt(dm[2]) - 1, parseInt(dm[1]));
      if (!isNaN(d.getTime()) && d < new Date() && d.getFullYear() > 1930) extractedDate = d;
    }
    log('estrazione_data', !!extractedDate, extractedDate ? `Data rilevata: ${extractedDate.toLocaleDateString('it-IT')} (da confermare)` : 'Nessuna data rilevata nel testo');

    // 5. Valori di laboratorio (matching deterministico su anagrafica analiti + alias)
    let labCount = 0;
    let outOfRangeCount = 0;
    if (text) {
      const analytes = await db.labAnalyte.findMany({ where: { active: true } });
      for (const a of analytes) {
        const names = [a.name, a.code, ...(a.aliases ? (JSON.parse(a.aliases) as string[]) : [])];
        for (const n of names) {
          const re = new RegExp(`${n.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*[:=]?\\s*(\\d+[.,]?\\d*)`, 'i');
          const m = text.match(re);
          if (m) {
            const value = parseFloat(m[1].replace(',', '.'));
            if (isNaN(value)) continue;
            // Plausibilità: fuori da 20x il range di riferimento = implausibile → quarantena valore
            const implausible = a.refHigh != null && (value > a.refHigh * 20 || value < 0);
            const outOfRange = !implausible && ((a.refLow != null && value < a.refLow) || (a.refHigh != null && value > a.refHigh));
            await db.labResult.create({
              data: {
                documentId: doc.id,
                patientId: doc.patientId,
                analyteId: a.id,
                rawName: m[0].split(/[:=\d]/)[0].trim() || a.name,
                value,
                unit: a.unit,
                refLow: a.refLow,
                refHigh: a.refHigh,
                outOfRange,
                implausible,
                confidence: quality === 'COMPLETA' ? 0.9 : 0.5,
                humanConfirmed: false,
                measuredAt: extractedDate ?? doc.docDate,
              },
            });
            labCount++;
            if (outOfRange) outOfRangeCount++;
            break;
          }
        }
      }
      log('valori_laboratorio', true, labCount > 0 ? `${labCount} valori estratti (${outOfRangeCount} fuori range) — da confermare` : 'Nessun valore riconosciuto');
    }

    // 6. Salvataggio esiti
    await db.document.update({
      where: { id: doc.id },
      data: {
        status: thirdParty && !cfs.some(() => true) ? 'NEEDS_REVIEW' : thirdParty ? 'NEEDS_REVIEW' : 'PROCESSED',
        extractedText: text || null,
        extractionQuality: quality,
        ocrConfidence: confidence,
        thirdPartyFound: thirdParty,
        docDate: doc.docDate ?? extractedDate,
        dateConfirmed: !!doc.docDate,
        extractedData: JSON.stringify({ dataEstratta: extractedDate?.toISOString() ?? null, cfTrovati: cfs.length }),
      },
    });

    // 7. Evento in timeline
    await db.timelineEvent.create({
      data: {
        patientId: doc.patientId,
        type: 'DOCUMENTO',
        date: doc.docDate ?? extractedDate ?? doc.createdAt,
        title: doc.title,
        summary: labCount > 0 ? `${labCount} valori estratti${outOfRangeCount > 0 ? `, ${outOfRangeCount} fuori range` : ''}` : quality === 'ILLEGGIBILE' ? 'Testo non estratto automaticamente' : null,
        refType: 'Document',
        refId: doc.id,
        specializationCode: doc.specializationCode,
        flags: JSON.stringify({ outOfRange: outOfRangeCount > 0, unconfirmed: labCount > 0 }),
      },
    });

    await finish(jobId, steps, 'DONE');
    await notify({
      userId: doc.patient.user.id,
      eventKey: 'documento_elaborato',
      title: 'Documento elaborato',
      body: `"${doc.title}" è stato elaborato${labCount > 0 ? ` — ${labCount} valori estratti, verifica che siano corretti` : ''}.`,
      refType: 'Document',
      refId: doc.id,
    });
  } catch (err: any) {
    log('errore', false, String(err?.message ?? err).slice(0, 200));
    await db.processingJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', lastError: String(err?.message ?? err).slice(0, 300), stepsLog: JSON.stringify(steps) },
    });
    await db.document.update({ where: { id: job.documentId }, data: { status: 'FAILED' } });
  }
}

async function finish(jobId: string, steps: Step[], status: string) {
  await db.processingJob.update({ where: { id: jobId }, data: { status, stepsLog: JSON.stringify(steps) } });
}
