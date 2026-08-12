import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { Card, EmptyState, PageTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

const ACTION_LABEL: Record<string, string> = {
  READ: 'Ha consultato',
  SHARE: 'Ha ricevuto in condivisione',
  EXPORT: 'Ha esportato',
  AI_REQUEST: 'Ha usato l’IA su',
};

const TARGET_LABEL: Record<string, string> = {
  Document: 'un tuo documento',
  DocumentFile: 'il file di un tuo documento',
  DocumentShare: 'una condivisione di documento',
  LabResult: 'un tuo valore di laboratorio',
  PatientProfile: 'il tuo profilo',
  Condition: 'il tuo diario (patologie)',
  Allergy: 'il tuo diario (allergie)',
  Medication: 'il tuo diario (farmaci)',
  ServiceRequest: 'una tua richiesta',
  Conversation: 'una tua conversazione',
  Appointment: 'un tuo appuntamento',
  IssuedDocument: 'un documento a te intestato',
  AiOutput: 'un contenuto IA che ti riguarda',
  DrugSafety: 'un controllo sui tuoi farmaci',
  Export: 'i tuoi dati completi',
};

const ROLE_LABEL: Record<string, string> = {
  DOCTOR: 'Medico',
  STAFF: 'Segreteria',
  ADMIN: 'Amministratore',
  CAREGIVER: 'Caregiver',
  PATIENT: 'Paziente',
};

export default async function AccessiPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');

  const page = Math.max(parseInt(searchParams.page ?? '1', 10) || 1, 1);
  const where = {
    patientId: session.patientId,
    action: { in: ['READ', 'SHARE', 'EXPORT', 'AI_REQUEST'] },
    NOT: { actorUserId: session.userId },
  };

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  // Join manuale sugli attori per mostrare il nome
  const actorIds = Array.from(new Set(logs.map((l) => l.actorUserId).filter((id): id is string => !!id)));
  const actors = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        include: { patientProfile: true, doctorProfile: true, staffProfile: true },
      })
    : [];
  const actorName = (id: string | null): string | null => {
    if (!id) return null;
    const u = actors.find((a) => a.id === id);
    if (!u) return null;
    if (u.doctorProfile) return `Dr. ${u.doctorProfile.firstName} ${u.doctorProfile.lastName}`;
    if (u.staffProfile) return `${u.staffProfile.firstName} ${u.staffProfile.lastName}`;
    if (u.patientProfile) return `${u.patientProfile.firstName} ${u.patientProfile.lastName}`;
    return u.email;
  };

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="space-y-5">
      <PageTitle
        title="Chi ha visto i miei dati"
        subtitle="Ogni accesso ai tuoi dati clinici viene registrato: qui vedi chi ha consultato cosa, quando e da dove."
      />

      <Card>
        {logs.length === 0 ? (
          <EmptyState
            title="Nessun accesso da parte di altri"
            hint="Quando un medico o un altro operatore consulterà i tuoi dati, lo vedrai qui."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Chi</th>
                  <th className="py-2 pr-3">Cosa</th>
                  <th className="py-2 pr-3">Quando</th>
                  <th className="py-2">Da dove</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="py-2.5 pr-3">
                      <span className="font-medium text-slate-800">{actorName(l.actorUserId) ?? 'Sistema'}</span>
                      {l.actorRole && <span className="block text-xs text-slate-500">{ROLE_LABEL[l.actorRole] ?? l.actorRole}</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700">
                      {ACTION_LABEL[l.action] ?? l.action}{' '}
                      {l.targetType ? (TARGET_LABEL[l.targetType] ?? `“${l.targetType}”`) : 'i tuoi dati'}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                    <td className="py-2.5 text-slate-500">{l.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <nav className="flex items-center justify-between mt-4 text-sm" aria-label="Pagine">
            {page > 1 ? (
              <Link href={`/paziente/accessi?page=${page - 1}`} className="text-brand-700 hover:underline">← Più recenti</Link>
            ) : <span />}
            <span className="text-slate-500">Pagina {page} di {totalPages}</span>
            {page < totalPages ? (
              <Link href={`/paziente/accessi?page=${page + 1}`} className="text-brand-700 hover:underline">Meno recenti →</Link>
            ) : <span />}
          </nav>
        )}
      </Card>
    </div>
  );
}
