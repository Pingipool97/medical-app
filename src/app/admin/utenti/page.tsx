import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { fmtDateTime } from '@/lib/format';
import { Card, Badge, PageTitle, EmptyState } from '@/components/ui';
import { UserStatusButton, VerifyDoctorForm } from './forms';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? '' : v ?? '');

const ROLE_OPTIONS = [
  { value: 'PATIENT', label: 'Paziente' },
  { value: 'DOCTOR', label: 'Medico' },
  { value: 'STAFF', label: 'Segreteria' },
  { value: 'ADMIN', label: 'Amministratore' },
  { value: 'CAREGIVER', label: 'Caregiver' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Attivo' },
  { value: 'PENDING_EMAIL', label: 'Email da verificare' },
  { value: 'PENDING_VERIFICATION', label: 'In attesa di verifica' },
  { value: 'SUSPENDED', label: 'Sospeso' },
];

const STATUS_BADGE: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
  ACTIVE: 'green',
  PENDING_EMAIL: 'amber',
  PENDING_VERIFICATION: 'amber',
  SUSPENDED: 'red',
  DELETED: 'gray',
};

export default async function UtentiPage({ searchParams }: { searchParams?: SP }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/login');

  const ruolo = one(searchParams?.ruolo);
  const stato = one(searchParams?.stato);
  const q = one(searchParams?.q).toLowerCase().trim();

  const where: Prisma.UserWhereInput = { status: { not: 'DELETED' } };
  if (ruolo) where.role = ruolo;
  if (stato) where.status = stato;
  if (q) where.email = { contains: q };

  const [pendingDoctors, users, total] = await Promise.all([
    db.doctorProfile.findMany({
      where: { verificationStatus: 'PENDING' },
      include: {
        user: { select: { email: true, createdAt: true } },
        specializations: { include: { specialization: true } },
      },
      orderBy: { id: 'asc' },
    }),
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, email: true, role: true, status: true, twoFactorEnabled: true, lastLoginAt: true },
    }),
    db.user.count({ where }),
  ]);

  return (
    <>
      <PageTitle title="Gestione utenti" subtitle="Verifica dei medici, sospensioni e stato degli account." />

      <div className="space-y-4">
        <Card title={`Medici in attesa di verifica (${pendingDoctors.length})`} className="border-amber-300">
          {pendingDoctors.length === 0 ? (
            <EmptyState title="Nessun medico in attesa di verifica" />
          ) : (
            <div className="space-y-4">
              {pendingDoctors.map((d) => (
                <div key={d.id} className="border border-slate-200 rounded-lg p-4 grid gap-4 lg:grid-cols-2">
                  <div className="text-sm space-y-1">
                    <p className="font-semibold text-slate-900">Dr. {d.firstName} {d.lastName}</p>
                    <p className="text-slate-600">Ordine dei Medici di <strong>{d.ordineProvince}</strong> — iscrizione n. <strong>{d.ordineNumber}</strong></p>
                    <p className="text-slate-600">
                      Specializzazioni: {d.specializations.length > 0 ? d.specializations.map((s) => s.specialization.name).join(', ') : '—'}
                    </p>
                    <p className="text-slate-600">Email: {d.user.email}</p>
                    <p className="text-xs text-slate-500">Registrato il {fmtDateTime(d.user.createdAt)}</p>
                    <p className="text-xs text-slate-500">
                      Finché non è verificato, il medico non può emettere documenti né ricevere pazienti.
                    </p>
                  </div>
                  <VerifyDoctorForm doctorId={d.id} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={`Utenti (${total})`}>
          <form method="get" className="grid gap-3 sm:grid-cols-4 mb-4">
            <div>
              <label className="label" htmlFor="ruolo">Ruolo</label>
              <select id="ruolo" name="ruolo" defaultValue={ruolo} className="input">
                <option value="">Tutti</option>
                {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="stato">Stato</label>
              <select id="stato" name="stato" defaultValue={stato} className="input">
                <option value="">Tutti</option>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="q">Ricerca email</label>
              <input id="q" name="q" defaultValue={q} className="input" placeholder="nome@dominio.it" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-secondary w-full">Filtra</button>
            </div>
          </form>

          {users.length === 0 ? (
            <EmptyState title="Nessun utente trovato con questi filtri" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">Ruolo</th>
                    <th className="py-2 pr-3 font-medium">Stato</th>
                    <th className="py-2 pr-3 font-medium">2FA</th>
                    <th className="py-2 pr-3 font-medium">Ultimo accesso</th>
                    <th className="py-2 font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium break-all">
                        {u.email}
                        {u.id === session.userId && <span className="text-xs text-slate-500 ml-1">(tu)</span>}
                      </td>
                      <td className="py-2 pr-3"><Badge color="blue">{ROLE_OPTIONS.find((r) => r.value === u.role)?.label ?? u.role}</Badge></td>
                      <td className="py-2 pr-3">
                        <Badge color={STATUS_BADGE[u.status] ?? 'gray'}>
                          {STATUS_OPTIONS.find((s) => s.value === u.status)?.label ?? u.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">{u.twoFactorEnabled ? <Badge color="green">Attiva</Badge> : <Badge color="gray">No</Badge>}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(u.lastLoginAt)}</td>
                      <td className="py-2">
                        {u.id === session.userId ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <UserStatusButton userId={u.id} suspended={u.status === 'SUSPENDED'} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {total > users.length && (
                <p className="text-xs text-slate-500 mt-2">Mostrati i primi {users.length} di {total} utenti: affina i filtri per restringere l&rsquo;elenco.</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
