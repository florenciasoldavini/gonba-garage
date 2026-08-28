'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

type DialogMotionVariant = 'center' | 'compare' | 'sheet';

type UseDialogMotionOptions = {
  contentKey?: string;
  isOpen?: boolean;
  itemSelector?: string;
  panelSelector: string;
  variant?: DialogMotionVariant;
};

const getPanelStart = (variant: DialogMotionVariant) => {
  if (variant === 'sheet') return { xPercent: 12, y: 0, scale: 1 };
  if (variant === 'compare') return { xPercent: 0, y: 42, scale: 0.985 };
  return { xPercent: 0, y: 28, scale: 0.97 };
};

export function useDialogMotion({
  contentKey,
  isOpen,
  itemSelector,
  panelSelector,
  variant = 'center',
}: UseDialogMotionOptions) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const openAnimationRef = useRef<() => void>(() => undefined);
  const closeAnimationRef = useRef<(afterClose?: () => void) => void>(() => undefined);

  useGSAP(
    (_context, contextSafe) => {
      openAnimationRef.current = contextSafe!(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (!dialog.open) dialog.showModal();

        timelineRef.current?.kill();

        const panel = dialog.querySelector<HTMLElement>(panelSelector);
        if (!panel) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          gsap.set([dialog, panel], { clearProps: 'all' });
          return;
        }

        const items = itemSelector
          ? Array.from(dialog.querySelectorAll<HTMLElement>(itemSelector))
          : [];
        const start = getPanelStart(variant);
        const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

        timeline
          .fromTo(dialog, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.24 })
          .fromTo(
            panel,
            { ...start, autoAlpha: 0 },
            { xPercent: 0, y: 0, scale: 1, autoAlpha: 1, duration: variant === 'compare' ? 0.62 : 0.52 },
            0,
          );

        if (items.length > 0) {
          timeline.fromTo(
            items,
            { y: 17, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, stagger: 0.045, duration: 0.38 },
            0.13,
          );
        }

        timelineRef.current = timeline;
      });

      closeAnimationRef.current = contextSafe!((afterClose?: () => void) => {
        const dialog = dialogRef.current;
        if (!dialog?.open) return;

        timelineRef.current?.kill();

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          dialog.close();
          afterClose?.();
          return;
        }

        const panel = dialog.querySelector<HTMLElement>(panelSelector);
        if (!panel) {
          dialog.close();
          afterClose?.();
          return;
        }

        const start = getPanelStart(variant);
        timelineRef.current = gsap.timeline({
          defaults: { ease: 'power2.inOut' },
          onComplete: () => {
            dialog.close();
            afterClose?.();
          },
        })
          .to(panel, {
            xPercent: start.xPercent * 0.55,
            y: start.y * 0.65,
            scale: 0.985,
            autoAlpha: 0,
            duration: 0.3,
          })
          .to(dialog, { autoAlpha: 0, duration: 0.18 }, '<0.08');
      });

      return () => timelineRef.current?.kill();
    },
    { scope: dialogRef, dependencies: [itemSelector, panelSelector, variant], revertOnUpdate: true },
  );

  const openDialog = useCallback(() => openAnimationRef.current(), []);
  const closeDialog = useCallback(() => closeAnimationRef.current(), []);
  const closeDialogAfter = useCallback((afterClose: () => void) => closeAnimationRef.current(afterClose), []);

  useEffect(() => {
    if (isOpen === undefined) return;
    if (isOpen) openDialog();
    else closeDialog();
  }, [closeDialog, isOpen, openDialog]);

  useGSAP(
    () => {
      const dialog = dialogRef.current;
      if (contentKey === undefined || !dialog?.open) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const view = dialog.querySelector<HTMLElement>('[data-dialog-view]');
      if (!view) return;

      gsap.fromTo(
        Array.from(view.children),
        { y: 18, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, stagger: 0.055, duration: 0.42, ease: 'power3.out' },
      );
    },
    { scope: dialogRef, dependencies: [contentKey], revertOnUpdate: true },
  );

  return { closeDialog, closeDialogAfter, dialogRef, openDialog };
}
