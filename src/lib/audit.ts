import 'server-only';
import { db } from './db';

type AuditInput = {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  patientId?: string | null;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

// L'audit non deve mai far fallire l'operazione principale, ma il fallimento va registrato.
export async function audit(e: AuditInput) {
  try {
    await db.auditLog.create({
      data: {
        actorUserId: e.actorUserId ?? null,
        actorRole: e.actorRole ?? null,
        action: e.action,
        targetType: e.targetType,
        targetId: e.targetId,
        patientId: e.patientId ?? null,
        ip: e.ip,
        userAgent: e.userAgent,
        metadata: e.metadata ? JSON.stringify(e.metadata) : null,
      },
    });
  } catch (err) {
    console.error('[AUDIT] scrittura fallita', err);
  }
}

// Accesso a dato clinico: obbligatorio per requisito (chi, cosa, quando, da dove), visibile al paziente
export async function auditClinicalRead(actor: { userId: string; role: string; ip?: string; userAgent?: string }, patientId: string, targetType: string, targetId: string) {
  await audit({
    actorUserId: actor.userId,
    actorRole: actor.role,
    action: 'READ',
    targetType,
    targetId,
    patientId,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
}
