// Costruzione condivisa dei filtri audit: usata dalla pagina e dalla route di export CSV,
// così l'export applica esattamente gli stessi filtri della vista.
import type { Prisma } from '@prisma/client';

export type AuditFilters = {
  azione?: string;
  ruolo?: string;
  targetType?: string;
  da?: string; // YYYY-MM-DD
  a?: string; // YYYY-MM-DD
  patientId?: string;
};

export function buildAuditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (f.azione) where.action = f.azione;
  if (f.ruolo) where.actorRole = f.ruolo;
  if (f.targetType) where.targetType = { contains: f.targetType };
  if (f.patientId) where.patientId = f.patientId;

  const createdAt: Prisma.DateTimeFilter = {};
  if (f.da) {
    const d = new Date(`${f.da}T00:00:00`);
    if (!Number.isNaN(d.getTime())) createdAt.gte = d;
  }
  if (f.a) {
    const d = new Date(`${f.a}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) createdAt.lte = d;
  }
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;
  return where;
}

export const AUDIT_ACTIONS = [
  'LOGIN', 'LOGIN_FAIL', 'LOGIN_2FA_OK', 'LOGIN_2FA_FAIL', 'LOGOUT', 'REGISTER',
  'READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'AI_REQUEST', 'AI_BUDGET_BLOCK',
  'SHARE', 'REVOKE', 'ADMIN_CONFIG', 'GUARDRAIL_BLOCK',
];

export const AUDIT_ROLES = ['PATIENT', 'DOCTOR', 'STAFF', 'ADMIN', 'CAREGIVER'];
