import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Gonba Garage | Autos usados seleccionados',
  description:
    'Compra y venta de autos usados seleccionados. Inventario actualizado y atención personalizada.',
  openGraph: {
    title: 'Gonba Garage | Autos usados seleccionados',
    description:
      'Compra y venta de autos usados seleccionados. Inventario actualizado y atención personalizada.',
    type: 'website',
    locale: 'es_AR',
    images: [
      {
        url: '/gonba-garage-social-preview.png',
        width: 1200,
        height: 630,
        alt: 'Gonba Garage — Autos usados seleccionados',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gonba Garage | Autos usados seleccionados',
    description: 'Compra y venta de autos usados seleccionados.',
    images: ['/gonba-garage-social-preview.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
