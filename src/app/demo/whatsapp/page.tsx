import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import WhatsAppDemo from '@/components/whatsapp-demo';

// Anteprima dimostrativa, fuori dall'area riservata: non tocca il database e non mostra
// dati reali. Vive sotto /demo e non dentro /medico proprio per non far credere che sia
// una funzione attiva. La sezione ufficiale è /medico/whatsapp, dichiarata in costruzione.

export const metadata: Metadata = {
  title: 'Anteprima WhatsApp con agente IA',
  robots: { index: false, follow: false },
};

export default function DemoWhatsAppPage() {
  // Visibile solo in sviluppo o quando la demo è esplicitamente abilitata: in produzione
  // una pagina con conversazioni finte non deve essere raggiungibile per caso.
  if (process.env.DEV_LOGIN !== 'true' && process.env.DEMO_MODE !== 'true') notFound();
  return <WhatsAppDemo />;
}
