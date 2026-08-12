import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { decryptField } from '@/lib/crypto';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { Alert, Badge, Card, PageTitle } from '@/components/ui';
import { ProfileForm, RevokeConsentButton } from './forms';

export const dynamic = 'force-dynamic';

const CONSENT_KIND_LABEL: Record<string, string> = {
  PRIVACY: 'Informativa privacy',
  ART9_SALUTE: 'Trattamento dati sulla salute (art. 9 GDPR)',
  TERMINI: 'Termini di servizio',
  IA_TRATTAMENTO: 'Elaborazione con intelligenza artificiale',
};

export default async function ImpostazioniPage() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');

  const [profile, consents] = await Promise.all([
    db.patientProfile.findUnique({ where: { id: session.patientId } }),
    db.consentRecord.findMany({
      where: { userId: session.userId },
      include: { consentVersion: true },
      orderBy: { acceptedAt: 'desc' },
    }),
  ]);
  if (!profile) redirect('/login');

  return (
    <div className="space-y-5 max-w-3xl">
      <PageTitle
        title="Impostazioni"
        subtitle="I tuoi dati, i tuoi consensi e il controllo sulle tue informazioni."
      />

      <Card title="Dati del profilo">
        <dl className="grid grid-cols-2 gap-3 text-sm mb-5">
          <div><dt className="text-xs text-slate-500">Nome</dt><dd className="font-medium">{profile.firstName} {profile.lastName}</dd></div>
          <div><dt className="text-xs text-slate-500">Data di nascita</dt><dd className="font-medium">{fmtDate(profile.birthDate)}</dd></div>
          <div><dt className="text-xs text-slate-500">Email di accesso</dt><dd className="font-medium">{session.email}</dd></div>
        </dl>
        <ProfileForm
          profile={{
            addressStreet: profile.addressStreet ?? '',
            addressCity: profile.addressCity ?? '',
            addressProvince: profile.addressProvince ?? '',
            addressZip: profile.addressZip ?? '',
            gpName: profile.gpName ?? '',
            asl: profile.asl ?? '',
            insurance: profile.insurance ?? '',
            emergencyName: decryptField(profile.emergencyNameEnc),
            emergencyPhone: decryptField(profile.emergencyPhoneEnc),
            onboardingStep: profile.onboardingStep,
          }}
        />
      </Card>

      <Card title="I tuoi consensi">
        {consents.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun consenso registrato.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {consents.map((c) => (
              <li key={c.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {CONSENT_KIND_LABEL[c.consentVersion.kind] ?? c.consentVersion.kind}
                    {' '}
                    <span className="text-xs text-slate-500 font-normal">versione {c.consentVersion.version}</span>
                    {' '}
                    {c.revokedAt ? <Badge color="red">Revocato</Badge> : <Badge color="green">Attivo</Badge>}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Accettato il {fmtDateTime(c.acceptedAt)}
                    {c.revokedAt ? ` · revocato il ${fmtDateTime(c.revokedAt)}` : ''}
                  </p>
                </div>
                {c.consentVersion.kind === 'IA_TRATTAMENTO' && !c.revokedAt && (
                  <RevokeConsentButton consentRecordId={c.id} />
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500 mt-3">
          Il consenso all’intelligenza artificiale è facoltativo e revocabile in ogni momento: senza consenso l’assistente e le spiegazioni automatiche restano disattivati, tutto il resto funziona normalmente.
        </p>
      </Card>

      <Card title="I tuoi dati ti appartengono">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Scarica una copia di tutto</h3>
            <p className="text-sm text-slate-600 mt-0.5 mb-2">
              Puoi scaricare in qualsiasi momento un file con tutti i tuoi dati: profilo, diario, elenco documenti, richieste e appuntamenti.
            </p>
            <a href="/paziente/export" className="btn-secondary" download>
              Esporta tutti i miei dati
            </a>
          </div>
          <Alert kind="info">
            <strong>Cancellazione dell’account:</strong> se vuoi chiudere il tuo account, scrivi all’assistenza.
            Tieni presente che i documenti già condivisi con un medico restano a lui per obbligo di legge
            (conservazione della documentazione clinica), anche dopo la cancellazione.
          </Alert>
        </div>
      </Card>
    </div>
  );
}
