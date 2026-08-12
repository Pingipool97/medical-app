import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Badge, Card, PageTitle, statusBadgeColor } from '@/components/ui';
import { ProfileForm, AddOfficeForm, RemoveOfficeButton, AddSpecializationForm, RemoveSpecializationButton } from './forms';

export const dynamic = 'force-dynamic';

const VERIFICATION_LABEL: Record<string, string> = {
  PENDING: 'In verifica',
  VERIFIED: 'Verificato',
  REJECTED: 'Verifica non superata',
};

export default async function ImpostazioniPage() {
  const session = await getSession();
  if (!session?.doctorId) redirect('/login');

  const [doctor, allSpecs] = await Promise.all([
    db.doctorProfile.findUnique({
      where: { id: session.doctorId },
      include: { specializations: { include: { specialization: true } } },
    }),
    db.specialization.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);
  if (!doctor) redirect('/login');

  let offices: { name: string; address?: string; city?: string }[] = [];
  try { offices = JSON.parse(doctor.offices ?? '[]'); } catch { offices = []; }

  const ownedIds = new Set(doctor.specializations.map((s) => s.specializationId));
  const addable = allSpecs.filter((s) => !ownedIds.has(s.id)).map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="space-y-5">
      <PageTitle title="Impostazioni professionali" subtitle="Il tuo profilo pubblico verso i pazienti: bio, contatti, tempi di risposta, sedi e specializzazioni." />

      <Card title="Stato dell’account">
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <Badge color={statusBadgeColor(doctor.verificationStatus)}>
            {VERIFICATION_LABEL[doctor.verificationStatus] ?? doctor.verificationStatus}
          </Badge>
          <span className="text-slate-600">
            Iscrizione Ordine: {doctor.ordineNumber} ({doctor.ordineProvince})
            {doctor.structureName ? ` · ${doctor.structureName}` : ''}
          </span>
        </div>
      </Card>

      <Card title="Profilo">
        <ProfileForm
          bio={doctor.bio ?? ''}
          professionalPhone={doctor.professionalPhone ?? ''}
          responseTimeHours={doctor.responseTimeHours}
        />
      </Card>

      <Card title="Sedi">
        {offices.length === 0 ? (
          <p className="text-sm text-slate-500 mb-3">Nessuna sede registrata.</p>
        ) : (
          <ul className="divide-y divide-slate-100 mb-4">
            {offices.map((o, i) => (
              <li key={i} className="py-2 flex items-center justify-between gap-2 text-sm">
                <span>
                  <strong>{o.name}</strong>
                  {o.address ? ` · ${o.address}` : ''}{o.city ? ` · ${o.city}` : ''}
                </span>
                <RemoveOfficeButton index={i} />
              </li>
            ))}
          </ul>
        )}
        <AddOfficeForm />
      </Card>

      <Card title="Specializzazioni">
        {doctor.specializations.length === 0 ? (
          <p className="text-sm text-slate-500 mb-3">Nessuna specializzazione registrata.</p>
        ) : (
          <ul className="divide-y divide-slate-100 mb-4">
            {doctor.specializations.map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                <span>{s.specialization.name}</span>
                <RemoveSpecializationButton id={s.id} />
              </li>
            ))}
          </ul>
        )}
        <AddSpecializationForm options={addable} />
      </Card>
    </div>
  );
}
