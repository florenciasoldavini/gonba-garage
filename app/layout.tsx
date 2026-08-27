import type { Metadata } from 'next';
import localFont from 'next/font/local';

import { JsonLd } from '@/components/seo/json-ld';
import { SITE_NAME } from '@/lib/metadata';
import { isSiteIndexingEnabled } from '@/lib/site-indexing';
import { getSiteUrl } from '@/lib/site-url';
import { getSiteStructuredData } from '@/lib/structured-data';
import './globals.css';

const geistSans = localFont({
  src: [
    {
      path: './fonts/geist-sans-variable.ttf',
      weight: '100 900',
      style: 'normal',
    },
    {
      path: './fonts/geist-sans-variable-italic.ttf',
      weight: '100 900',
      style: 'italic',
    },
  ],
  variable: '--font-geist-sans',
  display: 'swap',
  fallback: ['Arial', 'Helvetica', 'sans-serif'],
});

const geistMono = localFont({
  src: [
    {
      path: './fonts/geist-mono-variable.ttf',
      weight: '100 900',
      style: 'normal',
    },
    {
      path: './fonts/geist-mono-variable-italic.ttf',
      weight: '100 900',
      style: 'italic',
    },
  ],
  variable: '--font-geist-mono',
  display: 'swap',
  fallback: ['monospace'],
});

const homeTitle = "Gonba's Garage | Autos usados seleccionados";
const homeDescription =
  'Compra y venta de autos usados seleccionados. Inventario actualizado y atención personalizada.';
const indexingEnabled = isSiteIndexingEnabled();

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  applicationName: SITE_NAME,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
  title: homeTitle,
  description: homeDescription,
  robots: {
    index: indexingEnabled,
    follow: indexingEnabled,
    googleBot: {
      index: indexingEnabled,
      follow: indexingEnabled,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <JsonLd data={getSiteStructuredData()} />
        {children}
      </body>
    </html>
  );
}
