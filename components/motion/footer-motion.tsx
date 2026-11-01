'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

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

      media.add('(prefers-reduced-motion: no-preference)', () => {
        // Explicit end state: the Instagram card has a CSS transform transition, so a `from` tween could
        // read a mid-transition offset as its resting position. Clearing the transform afterwards leaves
        // the layout to the stylesheet and lets the card's hover lift work.
        gsap.fromTo(
          footer.children,
          { y: 24, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            stagger: 0.07,
            duration: 0.58,
            ease: 'power3.out',
            clearProps: 'transform',
            scrollTrigger: {
              trigger: footer,
              start: 'top 90%',
              once: true,
            },
          },
        );
      });

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
