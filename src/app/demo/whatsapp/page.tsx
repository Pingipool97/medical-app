import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { demoEnabled } from '@/lib/demo-access';

// L'anteprima vive dentro l'area medico, non in una pagina a sé: si guarda una funzione
// al posto giusto dell'app, non una vetrina staccata. Questo indirizzo resta solo per
// non rompere i collegamenti già in giro e rimanda là.

export default function DemoWhatsAppPage() {
  if (!demoEnabled()) notFound();
  redirect('/api/dev-login?role=DOCTOR&next=/medico/whatsapp');
}
