import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Cartella Intelligente', template: '%s — Cartella Intelligente' },
  description: 'Piattaforma sanitaria digitale: la tua documentazione clinica, compresa.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1761d7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}
try{var fs=localStorage.getItem('fontsize');if(fs)document.documentElement.dataset.fontsize=fs;}catch(e){}`,
          }}
        />
      </body>
    </html>
  );
}
