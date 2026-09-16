import { fmtOrdine } from '@/lib/format';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Badge, Card, PageTitle, statusBadgeColor } from '@/components/ui';
import { ProfileForm, AddOfficeForm, RemoveOfficeButton, SpecializationsForm } from './forms';
import { NotificationPrefs } from '@/components/notification-prefs';
import { loadNotificationPrefs } from '@/lib/notif-prefs';

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

  // Si passano TUTTE le professioni, non solo quelle mancanti: il modulo mostra l'elenco
  // intero con spuntate quelle gia' possedute, e si toglie una spunta per rimuoverla.
  const owned = doctor.specializations.map((s) => s.specializationId);
  const specOptions = allSpecs.map((s) => ({
    value: s.id,
    label: s.name,
    note: s.requiresOrdine ? 'Iscritta a un Ordine professionale' : undefined,
  }));
  const notifPrefs = await loadNotificationPrefs(session.userId, session.role);

  return (
    <div className="space-y-5">
      <PageTitle title="Impostazioni professionali" subtitle="Il tuo profilo pubblico verso i pazienti: bio, contatti, tempi di risposta, sedi e specializzazioni." />

      <Card title="Stato dell’account">
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <Badge color={statusBadgeColor(doctor.verificationStatus)}>
            {VERIFICATION_LABEL[doctor.verificationStatus] ?? doctor.verificationStatus}
          </Badge>
          <span className="text-slate-600">
            {fmtOrdine(doctor.ordineNumber, doctor.ordineProvince) ?? 'Professione senza albo'}
            {doctor.structureName ? ` · ${doctor.structureName}` : ''}
          </span>
        </div>
      </Card>

      <Card title="Notifiche">
        <p className="text-sm text-slate-600 mb-3">
          Scegli su quali canali vuoi essere avvisato. Le notifiche in app restano sempre attive.
        </p>
        <NotificationPrefs rows={notifPrefs} />
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

      <Card title="Professioni e specializzazioni">
        <p className="text-sm text-slate-600 mb-3">
          Puoi esercitarne più di una: spunta tutte quelle che ti riguardano. È quello che il paziente
          legge sotto al tuo nome quando ti cerca.
        </p>
        <SpecializationsForm options={specOptions} selected={owned} />
      </Card>
    </div>
  );
}
