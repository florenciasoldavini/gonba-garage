import type { Metadata } from 'next';
import localFont from 'next/font/local';
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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://gonba-garage.vercel.app',
  ),
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
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
