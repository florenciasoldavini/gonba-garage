'use client';

import { useEffect } from 'react';

import { RetryButton } from '@/components/status/retry-button';
import { GENERIC_ERROR_COPY, StuckDoorPage } from '@/components/status/stuck-door';

/** Unexpected failures inside a page. Error boundaries can't export metadata, so the tags go here. */
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <title>Algo falló | Gonba&apos;s Garage</title>
      <meta name="robots" content="noindex, nofollow" />
      <StuckDoorPage {...GENERIC_ERROR_COPY} action={<RetryButton onRetry={retry} />} />
    </>
  );
}
