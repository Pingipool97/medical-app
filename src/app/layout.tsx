import type { Metadata, Viewport } from 'next';
import './globals.css';

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
        <script
          dangerouslySetInnerHTML={{
            // Il service worker solo in produzione: in sviluppo i chunk di Next hanno nomi
            // stabili e la strategia cache-first su /_next/static servirebbe JavaScript
            // vecchio a ogni modifica, rendendo invisibili le ricompilazioni.
            // In dev si disinstalla anche quello eventualmente già registrato.
            __html: `${
              process.env.NODE_ENV === 'production'
                ? `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`
                : `if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));if(window.caches)caches.keys().then(ks=>ks.forEach(k=>caches.delete(k)));}`
            }
try{var fs=localStorage.getItem('fontsize');if(fs)document.documentElement.dataset.fontsize=fs;}catch(e){}`,
          }}
        />
      </body>
    </html>
  );
}
