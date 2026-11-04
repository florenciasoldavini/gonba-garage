'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { scrollReveal } from '@/components/motion/scroll-reveal';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

type FooterMotionProps = {
  children: ReactNode;
  className: string;
};

/** The site footer element with its scroll reveal, so every page animates the footer the same way. */
export function FooterMotion({ children, className }: FooterMotionProps) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const footer = root.current;
      if (!footer) return;

      const media = gsap.matchMedia();

      media.add(
        {
          desktop: '(min-width: 901px)',
          mobile: '(max-width: 900px)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context, contextSafe) => {
          const { desktop, reduceMotion } = context.conditions as {
            desktop: boolean;
            reduceMotion: boolean;
          };

          if (reduceMotion) return;

          // Explicit end state: the Instagram card has a CSS transform transition, so a `from` tween could
          // read a mid-transition offset as its resting position. Clearing the transform afterwards leaves
          // the layout to the stylesheet and lets the card's hover lift work.
          scrollReveal(footer, { start: 'top 90%', stacked: !desktop, contextSafe }).fromTo(
            footer.children,
            { y: 24, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, stagger: 0.07, duration: 0.58, clearProps: 'transform' },
          );
        },
      );

      return () => media.revert();
    },
    { scope: root },
  );

  return (
    <footer className={className} ref={root}>
      {children}
    </footer>
  );
}
