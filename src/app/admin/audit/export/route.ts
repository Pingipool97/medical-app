import { NextRequest, NextResponse } from 'next/server';
import { getSession, clientInfo } from '@/lib/auth';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { buildAuditWhere, type AuditFilters } from '../filters';

export const dynamic = 'force-dynamic';

const EXPORT_MAX = 10000;

function csvCell(value: string | null | undefined): string {
  const v = value ?? '';
  return `"${v.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return new NextResponse('Non autorizzato', { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const filters: AuditFilters = {
    azione: sp.get('azione') || undefined,
    ruolo: sp.get('ruolo') || undefined,
    targetType: sp.get('targetType') || undefined,
    da: sp.get('da') || undefined,
    a: sp.get('a') || undefined,
    patientId: sp.get('patientId') || undefined,
  };
  const where = buildAuditWhere(filters);

  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: EXPORT_MAX,
    include: { actor: { select: { email: true } } },
  });

  const header = ['data_ora', 'attore_email', 'ruolo_attore', 'azione', 'target_type', 'target_id', 'patient_id', 'ip', 'user_agent', 'metadata'];
  const lines = [header.join(';')];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.createdAt.toISOString()),
        csvCell(r.actor?.email ?? ''),
        csvCell(r.actorRole),
        csvCell(r.action),
        csvCell(r.targetType),
        csvCell(r.targetId),
        csvCell(r.patientId),
        csvCell(r.ip),
        csvCell(r.userAgent),
        csvCell(r.metadata),
      ].join(';'),
    );
  }
  const csv = '﻿' + lines.join('\r\n'); // BOM per compatibilità Excel

  // Anche l'export è un evento tracciato
  const { ip, userAgent } = clientInfo();
  await audit({
    actorUserId: session.userId,
    actorRole: session.role,
    action: 'EXPORT',
    targetType: 'AuditLog',
    metadata: { filters, count: rows.length, truncated: rows.length === EXPORT_MAX },
    ip,
    userAgent,
  });

  const filename = `audit-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
