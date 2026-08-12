import { db } from '@/lib/db';
import { ISSUED_KINDS } from '@/lib/constants';
import { Alert, Card, BackLink } from '@/components/ui';
import { loadPatientForDoctor } from '../load';
import { PatientHeader } from '../patient-header';
import { IssueDocumentForm } from './form';

export const dynamic = 'force-dynamic';

export default async function EmettiDocumentoPage({
  params, searchParams,
}: {
  params: { id: string };
  searchParams: { requestId?: string; kind?: string; title?: string; body?: string };
}) {
  const { doctorId, patient } = await loadPatientForDoctor(params.id, 'IssuedDocument');

  const [doctor, signatureProvider] = await Promise.all([
    db.doctorProfile.findUnique({ where: { id: doctorId } }),
    db.providerConfig.findFirst({ where: { kind: 'FIRMA', enabled: true } }),
  ]);
  const kinds = ISSUED_KINDS;
  const verified = doctor?.verificationStatus === 'VERIFIED';

  // Se si evade una richiesta, mostra il contesto
  const request = searchParams.requestId
    ? await db.serviceRequest.findFirst({ where: { id: searchParams.requestId, doctorId } })
    : null;

  return (
    <div className="space-y-5">
      <PatientHeader patient={patient} />
      <BackLink href={`/medico/pazienti/${patient.id}`} label="Torna alla cartella" />

      <Card title="Emetti un documento per il paziente">
        {!verified && (
          <div className="mb-4">
            <Alert kind="critical">Account in verifica: non puoi emettere documenti finché la verifica non è conclusa.</Alert>
          </div>
        )}

        {request && (
          <div className="mb-4">
            <Alert kind="info">
              Stai evadendo la richiesta: <strong>{request.subject}</strong> — all’emissione la richiesta passerà automaticamente allo stato «Evasa».
            </Alert>
          </div>
        )}

        <div className="mb-4 space-y-2">
          <Alert kind="warn">
            <strong>Cosa NON si emette da qui:</strong> le ricette SSN dematerializzate e i certificati di malattia INPS
            passano esclusivamente dal <strong>Sistema TS</strong>. Da questa piattaforma emetti ricette bianche (private),
            promemoria NRE, certificati liberi, richieste di esami, piani terapeutici, referti e comunicazioni.
          </Alert>
          {signatureProvider ? (
            <Alert kind="success">Provider di firma configurato: il documento sarà firmato digitalmente all’emissione.</Alert>
          ) : (
            <Alert kind="warn">
              <strong>Firma digitale non configurata:</strong> il documento uscirà esplicitamente marcato come
              «NON firmato». Per la piena validità legale l’amministratore deve configurare un provider di firma.
            </Alert>
          )}
        </div>

        <IssueDocumentForm
          patientId={patient.id}
          requestId={request?.id}
          kinds={kinds}
          defaultKind={searchParams.kind}
          defaultTitle={searchParams.title}
          defaultBody={searchParams.body}
          disabled={!verified}
        />
      </Card>
    </div>
  );
}
