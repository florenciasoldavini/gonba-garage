'use client';

import { useRef, type ReactNode } from 'react';

import { useStatusMotion } from '@/components/motion/use-status-motion';

export function AlertResultMotion({ children, labelledBy }: { children: ReactNode; labelledBy: string }) {
  const root = useRef<HTMLElement>(null);
  useStatusMotion(root);

  return (
    <section className="alert-result status-panel glass-panel" aria-labelledby={labelledBy} ref={root}>
      {children}
    </section>
  );
}
