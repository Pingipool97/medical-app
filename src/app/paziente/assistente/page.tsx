import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Alert, Card, EmergencyBanner, PageTitle } from '@/components/ui';
import { PremiumGate } from '@/components/premium-gate';
import { getPlanState } from '@/lib/subscription';
import { AssistantChat } from './chat';

export const dynamic = 'force-dynamic';

export default async function AssistentePage() {
  const session = await getSession();
  if (!session?.patientId) redirect('/login');
  const plan = await getPlanState(session.userId);

  return (
    <div className="space-y-5 max-w-3xl">
      <PageTitle
        title="Assistente"
        subtitle="Un aiuto per capire meglio i tuoi documenti e usare la piattaforma."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Alert kind="info">
          <p className="font-semibold">Cosa può fare</p>
          <ul className="list-disc list-inside text-sm mt-1">
            <li>Spiegarti in parole semplici i termini dei tuoi referti</li>
            <li>Aiutarti a usare la piattaforma (caricare documenti, prenotare…)</li>
            <li>Suggerirti quali domande fare al medico</li>
          </ul>
        </Alert>
        <Alert kind="warn">
          <p className="font-semibold">Cosa NON fa</p>
          <ul className="list-disc list-inside text-sm mt-1">
            <li>Non fa diagnosi e non interpreta i tuoi sintomi</li>
            <li>Non consiglia farmaci né terapie</li>
            <li>Non sostituisce il tuo medico: per queste domande usa le <Link href="/paziente/richieste/nuova" className="underline">Richieste</Link></li>
          </ul>
        </Alert>
      </div>

      {plan.isPremium ? (
        <Card>
          <AssistantChat />
        </Card>
      ) : (
        <PremiumGate
          title="L’assistente è incluso nel piano Premium"
          description="Con Premium puoi chiedere all’assistente cosa significano i termini dei tuoi referti, quante volte vuoi."
        />
      )}

      <EmergencyBanner />
    </div>
  );
}
