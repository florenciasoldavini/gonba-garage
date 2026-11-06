'use client';

import { useEffect } from 'react';

import { RetryButton } from '@/components/status/retry-button';
import { StuckDoorPage } from '@/components/status/stuck-door';

/**
 * A failed catalog read, on the catalog or a car page. Thrown before the response starts, so it is
 * a real 500: search engines retry it, where a 200 with `noindex` would drop a car that still
 * exists. The catalog header is left out on purpose: it would announce an inventory that is not there.
 */
export default function CatalogError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <title>Catálogo no disponible | Gonba&apos;s Garage</title>
      <meta name="robots" content="noindex, nofollow" />
      <StuckDoorPage
        active="vehicles"
        eyebrow="Catálogo no disponible"
        title="No pudimos cargar el catálogo."
        text="El problema es nuestro, no de tu conexión. Probá de nuevo en unos segundos o escribinos por WhatsApp y te contamos qué autos hay disponibles."
        action={<RetryButton onRetry={retry} />}
      />
    </>
  );
}
