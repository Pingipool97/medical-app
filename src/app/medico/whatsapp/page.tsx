import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { Alert, Card, PageTitle } from '@/components/ui';
import { Icon } from '@/components/icons';

export const dynamic = 'force-dynamic';

// Sezione dichiarata in costruzione. L'anteprima del flusso e del layout esiste
// (/demo/whatsapp) ma è a dati finti: qui si dice cosa manca davvero, senza far
// credere che basti premere un interruttore.

const REQUISITI: { titolo: string; testo: string }[] = [
  {
    titolo: 'Account WhatsApp Business API',
    testo: 'Serve un profilo Meta Business verificato e un numero di telefono dedicato, che non può essere già usato sull’app WhatsApp normale.',
  },
  {
    titolo: 'Template approvati da Meta',
    testo: 'I messaggi che parte lo studio (promemoria, conferme) vanno sottoposti a Meta e approvati uno per uno. Fuori dalle 24 ore dall’ultimo messaggio del paziente si possono usare solo quelli.',
  },
  {
    titolo: 'Webhook pubblico',
    testo: 'Meta consegna i messaggi in arrivo a un indirizzo raggiungibile da internet, con verifica della firma. Va esposto e presidiato.',
  },
  {
    titolo: 'Valutazione privacy',
    testo: 'I messaggi transitano sui server di Meta. Vanno definiti base giuridica, informativa e perimetro: nessun dato clinico via chat senza una decisione consapevole.',
  },
];

export default async function WhatsAppPage() {
  const session = await getSession();
  if (!session || session.role !== 'DOCTOR') redirect('/login');
  const demoEnabled = process.env.DEV_LOGIN === 'true' || process.env.DEMO_MODE === 'true';

  return (
    <>
      <PageTitle
        title="WhatsApp con agente IA"
        subtitle="Conversazioni dei pazienti su WhatsApp, gestite da un agente con la tua supervisione."
      />

      <Alert kind="warn">
        <strong>Sezione in costruzione.</strong> La funzione non è attiva: nessun messaggio viene ricevuto o inviato.
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card title="Come funzionerà">
          <ul className="space-y-3 text-sm">
            {[
              ['message', 'L’agente risponde da solo', 'Agenda, spostamenti, prezzi, orari e promemoria: gestiti senza che tu intervenga.'],
              ['shield', 'Sul clinico si ferma', 'Davanti a una domanda clinica non risponde: passa la conversazione a te e lo dice al paziente.'],
              ['user', 'Puoi subentrare quando vuoi', 'Con un tocco prendi in carico la chat; l’agente resta fermo finché non gliela restituisci.'],
              ['paperclip', 'Documenti nella cartella', 'Un referto inviato in chat finisce nella cartella del paziente, non in una cartella di download.'],
            ].map(([icon, titolo, testo]) => (
              <li key={titolo} className="flex gap-3">
                <span className="shrink-0 w-8 h-8 rounded-lg bg-accent-50 text-accent-700 flex items-center justify-center">
                  <Icon name={icon} className="w-4 h-4" />
                </span>
                <span>
                  <span className="block font-medium text-brand-950">{titolo}</span>
                  <span className="block text-slate-600">{testo}</span>
                </span>
              </li>
            ))}
          </ul>
          {demoEnabled && (
            <Link href="/demo/whatsapp" className="btn-primary mt-4 inline-flex">
              Apri l’anteprima dimostrativa
            </Link>
          )}
        </Card>

        <Card title="Cosa manca per attivarla">
          <ul className="space-y-3 text-sm">
            {REQUISITI.map((r, i) => (
              <li key={r.titolo} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-medium text-brand-950">{r.titolo}</span>
                  <span className="block text-slate-600">{r.testo}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 mt-4 border-t border-slate-200 pt-3">
            Sono passaggi con Meta e con il DPO, non solo sviluppo: i tempi dipendono in buona parte dalle loro approvazioni.
          </p>
        </Card>
      </div>
    </>
  );
}
