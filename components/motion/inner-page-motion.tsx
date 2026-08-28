'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

type InnerPageMotionProps = {
  children: ReactNode;
  className: string;
  id?: string;
  variant: 'catalog' | 'detail' | 'valuation';
};

export function InnerPageMotion({ children, className, id, variant }: InnerPageMotionProps) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add(
        {
          desktop: '(min-width: 901px)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const { desktop, reduceMotion } = context.conditions as {
            desktop: boolean;
            reduceMotion: boolean;
          };

          if (reduceMotion) return;

          if (variant === 'catalog') {
            const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });

            intro
              .from('.site-header', { y: -30, autoAlpha: 0, duration: 0.75 })
              .from('.catalog-hero .eyebrow', { x: -32, autoAlpha: 0, duration: 0.55 }, 0.22)
              .from(
                '#catalog-title',
                { y: 62, autoAlpha: 0, clipPath: 'inset(0 0 100% 0)', duration: 0.95 },
                0.3,
              )
              .from('.catalog-hero-copy > *', { x: 42, autoAlpha: 0, stagger: 0.12, duration: 0.65 }, 0.58)
              .from('.catalog-filters-desktop', { x: desktop ? -38 : 0, autoAlpha: 0, duration: 0.72 }, 0.7)
              .from('.catalog-toolbar', { y: 22, autoAlpha: 0, duration: 0.58 }, 0.78)
              .fromTo(
                '.catalog-scan-line',
                { xPercent: -120, autoAlpha: 0 },
                { xPercent: 120, autoAlpha: 0.85, duration: 1.4, ease: 'power2.inOut' },
                0.3,
              )
              .to('.catalog-scan-line', { autoAlpha: 0, duration: 0.2 }, 1.5);

            gsap.timeline({
              scrollTrigger: {
                trigger: '.catalog-contact',
                start: 'top 78%',
                once: true,
              },
            })
              .from('.catalog-contact > div > *', {
                x: -38,
                autoAlpha: 0,
                stagger: 0.1,
                duration: 0.68,
                ease: 'power3.out',
              })
              .from('.catalog-contact > .button', { autoAlpha: 0, duration: 0.52 }, '<0.16');
          }

          if (variant === 'detail') {
            const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });

            intro
              .from('.site-header', { y: -30, autoAlpha: 0, duration: 0.75 })
              .from('.detail-breadcrumbs > *', { x: -14, autoAlpha: 0, stagger: 0.06, duration: 0.42 }, 0.18)
              .from('.detail-title .eyebrow', { x: -30, autoAlpha: 0, duration: 0.52 }, 0.28)
              .from(
                '#vehicle-title',
                { y: 62, autoAlpha: 0, clipPath: 'inset(0 0 100% 0)', duration: 0.95 },
                0.34,
              )
              .from('.detail-title-meta span', { x: 22, autoAlpha: 0, stagger: 0.09, duration: 0.5 }, 0.67)
              .fromTo(
                '.detail-primary-image',
                { clipPath: 'inset(0 100% 0 0)' },
                { clipPath: 'inset(0 0% 0 0)', duration: 1.18, ease: 'power3.inOut' },
                0.56,
              )
              .from('.detail-primary-image .cover-image', { scale: 1.1, duration: 1.45, ease: 'power2.out' }, 0.62)
              .from('.detail-purchase-card', { x: desktop ? 64 : 0, y: desktop ? 0 : 28, autoAlpha: 0, duration: 0.86 }, 0.72)
              .from('.detail-purchase-card > *', { y: 16, autoAlpha: 0, stagger: 0.055, duration: 0.42 }, 0.91);

            const overview = gsap.timeline({
              defaults: { ease: 'power3.out' },
              scrollTrigger: {
                trigger: '.detail-overview',
                start: 'top 72%',
                once: true,
              },
            });

            overview
              .from('.detail-story > :not(.detail-highlights)', { x: -46, autoAlpha: 0, stagger: 0.1, duration: 0.66 })
              .from('.detail-highlights li', { x: -28, autoAlpha: 0, stagger: 0.1, duration: 0.5 }, '<0.16')
              .from('.detail-specs', { x: desktop ? 58 : 0, y: desktop ? 0 : 32, autoAlpha: 0, duration: 0.76 }, '<0.1')
              .from('.detail-specs dl > div', { x: 24, autoAlpha: 0, stagger: 0.055, duration: 0.4 }, '<0.18');

            gsap.fromTo(
              '.detail-gallery-image',
              {
                clipPath: (index) => index === 0 ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)',
              },
              {
                clipPath: 'inset(0% 0 0 0)',
                stagger: 0.12,
                duration: 1.05,
                ease: 'power3.inOut',
                scrollTrigger: {
                  trigger: '.detail-gallery',
                  start: 'top 76%',
                  once: true,
                },
              },
            );

            gsap.from('.detail-confidence > div', {
              y: 54,
              autoAlpha: 0,
              stagger: 0.13,
              duration: 0.75,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: '.detail-confidence',
                start: 'top 76%',
                once: true,
              },
            });

            gsap.timeline({
              scrollTrigger: {
                trigger: '.detail-contact',
                start: 'top 78%',
                once: true,
              },
            })
              .from('.detail-contact .contact-copy > *', { y: 34, autoAlpha: 0, stagger: 0.1, duration: 0.65, ease: 'power3.out' })
              .from('.detail-contact .contact-actions', { scale: 0.96, autoAlpha: 0, duration: 0.6, ease: 'power3.out' }, '<0.12')
              .fromTo(
                '.detail-contact .contact-glow',
                { scale: 0.72, autoAlpha: 0 },
                { scale: 1, autoAlpha: 0.8, duration: 1.05, ease: 'power2.out' },
                0,
              );
          }

          if (variant === 'valuation') {
            const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });

            intro
              .from('.site-header', { y: -30, autoAlpha: 0, duration: 0.75 })
              .from('.valuation-intro .eyebrow', { x: -30, autoAlpha: 0, duration: 0.52 }, 0.24)
              .from(
                '#valuation-title',
                { y: 58, autoAlpha: 0, clipPath: 'inset(0 0 100% 0)', duration: 0.92 },
                0.3,
              )
              .from('.valuation-lead', { x: -34, autoAlpha: 0, duration: 0.64 }, 0.6)
              .fromTo(
                '.valuation-image',
                { clipPath: 'inset(50% 0 50% 0)' },
                { clipPath: 'inset(0% 0 0% 0)', duration: 1.05, ease: 'power3.inOut' },
                0.68,
              )
              .from('.valuation-image .cover-image', { scale: 1.09, duration: 1.35, ease: 'power2.out' }, 0.7)
              .from('.valuation-promises li', { x: -30, autoAlpha: 0, stagger: 0.1, duration: 0.52 }, 0.88)
              .from('.valuation-promises svg', { scale: 0.45, autoAlpha: 0, stagger: 0.1, duration: 0.35 }, 1.02)
              .from('.valuation-form', {
                x: desktop ? 54 : 0,
                y: desktop ? 0 : 28,
                autoAlpha: 0,
                duration: 0.86,
              }, 0.52);
          }

          gsap.from('.site-footer > *', {
            y: 24,
            autoAlpha: 0,
            stagger: 0.07,
            duration: 0.58,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: '.site-footer',
              start: 'top 90%',
              once: true,
            },
          });
        },
      );

      return () => media.revert();
    },
    { scope: root, dependencies: [variant] },
  );

  return (
    <main className={`${className} inner-page-motion inner-page-motion-${variant}`} id={id} ref={root}>
      {children}
    </main>
  );
}
