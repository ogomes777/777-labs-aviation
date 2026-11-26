import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import '@/styles/global.css';
import '@/styles/v7.css';
import { PREFS_BOOT } from '@/i18n/boot';

const bodoni = localFont({
  src: [
    { path: './fonts/BodoniModa-Variable.woff2', style: 'normal', weight: '400 900' },
    { path: './fonts/BodoniModa-Variable-Italic.woff2', style: 'italic', weight: '400 900' },
  ],
  variable: '--font-bodoni',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});
const script = localFont({ src: './fonts/PinyonScript-Regular.woff2', variable: '--font-pinyon', display: 'swap', weight: '400', fallback: ['Snell Roundhand', 'cursive'] });
const cormorant = localFont({
  src: [
    { path: './fonts/Cormorant-Variable.woff2', style: 'normal', weight: '300 700' },
    { path: './fonts/Cormorant-Variable-Italic.woff2', style: 'italic', weight: '300 700' },
  ],
  variable: '--font-cormorant', display: 'swap', fallback: ['Garamond', 'Georgia', 'serif'],
});
const gloock = localFont({ src: './fonts/Gloock-Regular.woff2', variable: '--font-gloock', display: 'swap', weight: '400', fallback: ['Didot', 'Georgia', 'serif'] });
const instrument = localFont({
  src: [
    { path: './fonts/InstrumentSerif-Regular.woff2', style: 'normal', weight: '400' },
    { path: './fonts/InstrumentSerif-Italic.woff2', style: 'italic', weight: '400' },
  ],
  variable: '--font-instrument', display: 'swap', fallback: ['Georgia', 'serif'],
});
const manrope = localFont({ src: './fonts/Manrope-Variable.woff2', variable: '--font-manrope', display: 'swap', weight: '200 800', fallback: ['Helvetica Neue', 'Arial', 'sans-serif'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://777-labs-aviation.vercel.app'),
  title: 'SimFly — Compra e venda de aeronaves executivas',
  description: 'Intermediação especializada em compra e venda de jatos, turbohélices e helicópteros executivos no Brasil e nos Estados Unidos. Jeito simples de voar.',
  openGraph: { title: 'SimFly — Jeito simples de voar', description: 'Conectamos compradores e vendedores de aeronaves executivas. Brasil · Estados Unidos.', images: ['/media/og.jpg'], locale: 'pt_BR', type: 'website' },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = { themeColor: '#e9dcd8', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Define o modo antes do primeiro paint (evita CLS entre layout cinemático e reduzido).
const boot = `(function(){try{var d=document.documentElement,q=new URLSearchParams(location.search),m=q.get('motion')||localStorage.getItem('777:motion');if(m!=='cinematic'&&m!=='lite'&&m!=='reduced'){m=matchMedia('(prefers-reduced-motion: reduce)').matches?'reduced':'cinematic'}if(q.get('webgl')==='0'||q.get('quality')==='lite'){if(m==='cinematic')m='lite'}else{var c=document.createElement('canvas');if(!c.getContext('webgl2')&&m==='cinematic')m='lite'}d.dataset.motion=m;d.dataset.scene='light';if(m==='cinematic')d.classList.add('intro')}catch(e){document.documentElement.dataset.motion='reduced'}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${bodoni.variable} ${manrope.variable} ${script.variable} ${cormorant.variable} ${gloock.variable} ${instrument.variable}`} data-motion="cinematic" data-scene="light" data-theme="sky" data-lang="pt" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot + PREFS_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
