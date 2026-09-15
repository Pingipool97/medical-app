import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaUpdater } from '@/components/pwa-updater';

export const metadata: Metadata = {
  title: { default: 'HABITUS APP', template: '%s — HABITUS APP' },
  description: 'Fisio e benessere: la tua documentazione clinica, compresa. Agenda, referti e assistenza in un unico posto.',
  applicationName: 'HABITUS APP',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'HABITUS', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1e104a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        {children}
        <PwaUpdater />
        <script
          dangerouslySetInnerHTML={{
            // Solo la dimensione del testo: va applicata prima del primo disegno, o si
            // vedrebbe la pagina cambiare taglia sotto gli occhi.
            __html: `try{var fs=localStorage.getItem('fontsize');if(fs)document.documentElement.dataset.fontsize=fs;}catch(e){}`,
          }}
        />
      </body>
    </html>
  );
}
