import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { BackLink, Card, PageTitle } from '@/components/ui';
import { UploadForm } from './form';

export const dynamic = 'force-dynamic';

export default async function CaricaDocumentoPage() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');

  const [docTypes, specializations] = await Promise.all([
    db.documentTypeDef.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    db.specialization.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="space-y-5 max-w-2xl">
      <BackLink href="/paziente/documenti" label="Torna ai documenti" />
      <PageTitle
        title="Carica un documento"
        subtitle="Tre semplici passi: scegli il file, dicci che documento è, aggiungi qualche dettaglio se vuoi."
      />
      <Card>
        <UploadForm
          docTypes={docTypes.map((t) => ({ code: t.code, name: t.name }))}
          specializations={specializations.map((s) => ({ code: s.code, name: s.name }))}
        />
      </Card>
    </div>
  );
}
