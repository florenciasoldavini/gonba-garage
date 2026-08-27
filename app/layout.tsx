import type { Metadata } from 'next';
import localFont from 'next/font/local';

import { SITE_NAME } from '@/lib/metadata';
import { getSiteUrl } from '@/lib/site-url';
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

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  applicationName: SITE_NAME,
  title: homeTitle,
  description: homeDescription,
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
      <body>{children}</body>
    </html>
  );
}
