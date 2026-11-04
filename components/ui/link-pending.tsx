'use client';

import { useLinkStatus } from 'next/link';
import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Car pages render on demand, so a tap can wait on the server. These sit inside a `Link` and show
 * that the tap landed while the next page loads.
 */

/** The link's trailing icon, swapped for a spinner while its page loads. */
export function LinkPendingIcon({
  children,
  size,
  className,
}: {
  children: ReactNode;
  size: number;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  if (!pending) return children;
  return (
    <LoaderCircle
      className={`icon-spinner${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      size={size}
      strokeWidth={1.8}
    />
  );
}

/** An empty marker for the link's CSS to style a whole card with `:has([data-link-pending])`. */
export function LinkPendingMarker() {
  const { pending } = useLinkStatus();
  return <span hidden data-link-pending={pending || undefined} />;
}
