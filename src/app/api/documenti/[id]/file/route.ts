import { NextRequest, NextResponse } from 'next/server';
import { getSession, clientInfo } from '@/lib/auth';
import { assertDocumentAccess } from '@/lib/access';
import { auditClinicalRead } from '@/lib/audit';
import { readDecrypted } from '@/lib/storage';

// Download del file documento: sempre autenticato, sempre auditato, mai link pubblici.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.twoFactorPending) {
    return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 401 });
  }
  try {
    const doc = await assertDocumentAccess(session, params.id);
    const { ip, userAgent } = clientInfo();
    await auditClinicalRead({ userId: session.userId, role: session.role, ip, userAgent }, doc.patientId, 'DocumentFile', doc.id);
    const buf = await readDecrypted(doc.filePath);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(doc.fileName)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e: any) {
    if (e?.message === 'FORBIDDEN') return NextResponse.json({ error: 'Non hai accesso a questo documento' }, { status: 403 });
    return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 });
  }
}
