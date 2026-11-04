'use client';

import { useEffect } from 'react';

import { RetryButton } from '@/components/status/retry-button';
import { GENERIC_ERROR_COPY, StuckDoorCard } from '@/components/status/stuck-door';
import { geistMono, geistSans } from './fonts';
import './globals.css';

/** Replaces the root layout when the layout itself fails, so it brings its own document and styles. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <title>Algo falló | Gonba&apos;s Garage</title>
        <meta name="robots" content="noindex, nofollow" />
        <main className="stuck-door-screen">
          <StuckDoorCard {...GENERIC_ERROR_COPY} action={<RetryButton onRetry={retry} />} />
        </main>
      </body>
    </html>
  );
}
