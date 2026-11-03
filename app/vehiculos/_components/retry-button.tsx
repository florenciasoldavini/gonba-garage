'use client';

import { RotateCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';

/** Re-renders the current route on the server, keeping the query string and scroll position. */
export function RetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? 'Reintentando…' : 'Reintentar'} <RotateCw aria-hidden="true" size={16} strokeWidth={1.8} />
    </Button>
  );
}
