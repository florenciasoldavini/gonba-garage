'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
}

export function HomeGsapMotion({ children }: { children: ReactNode }) {
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

          const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });

          intro
            .from('.site-header', { y: -34, autoAlpha: 0, duration: 0.8 })
            .from('.hero-media', { scale: 1.12, autoAlpha: 0.45, duration: 1.8, ease: 'power2.out' }, 0)
            .from('.hero-overlay', { autoAlpha: 0, duration: 1.2 }, 0.08)
            .from('.hero .eyebrow', { x: -32, autoAlpha: 0, duration: 0.65 }, 0.28)
            .from(
              '#hero-title',
              {
                y: 76,
                autoAlpha: 0,
                clipPath: 'inset(0 0 100% 0)',
                duration: 1.05,
              },
              0.36,
            )
            .from('.hero-intro', { y: 26, autoAlpha: 0, duration: 0.72 }, 0.72)
            .from('.hero-actions', { y: 20, autoAlpha: 0, duration: 0.68 }, 0.84)
            .from('.hero-facts > div', { x: 54, autoAlpha: 0, stagger: 0.09, duration: 0.66 }, 0.78)
            .from('.scroll-cue', { y: -16, autoAlpha: 0, duration: 0.58 }, 1.02)
            .fromTo(
              '.hero-ignition-light',
              { xPercent: -135, autoAlpha: 0 },
              { xPercent: 135, autoAlpha: 0.8, duration: 1.35, ease: 'power2.inOut' },
              0.54,
            )
            .to('.hero-ignition-light', { autoAlpha: 0, duration: 0.24 }, 1.65);

          gsap.to('.hero-media', {
            yPercent: 9,
            scale: 1.04,
            ease: 'none',
            scrollTrigger: {
              trigger: '.hero',
              start: 'top top',
              end: 'bottom top',
              scrub: 1,
            },
          });

          gsap.to('.hero-content', {
            yPercent: -7,
            autoAlpha: 0.72,
            ease: 'none',
            scrollTrigger: {
              trigger: '.hero',
              start: '35% top',
              end: 'bottom top',
              scrub: 0.8,
            },
          });

          let cleanupPointer: (() => void) | undefined;

          if (desktop) {
            const hero = root.current?.querySelector<HTMLElement>('.hero');
            const heroMedia = root.current?.querySelector<HTMLElement>('.hero-media');
            const heroContent = root.current?.querySelector<HTMLElement>('.hero-content');
            const heroFacts = root.current?.querySelector<HTMLElement>('.hero-facts');

            if (hero && heroMedia && heroContent && heroFacts) {
              const mediaX = gsap.quickTo(heroMedia, 'x', { duration: 0.9, ease: 'power3.out' });
              const contentX = gsap.quickTo(heroContent, 'x', { duration: 0.72, ease: 'power3.out' });
              const factsX = gsap.quickTo(heroFacts, 'x', { duration: 0.8, ease: 'power3.out' });
              const factsY = gsap.quickTo(heroFacts, 'y', { duration: 0.8, ease: 'power3.out' });

              const handlePointerMove = (event: PointerEvent) => {
                const bounds = hero.getBoundingClientRect();
                const x = (event.clientX - bounds.left) / bounds.width - 0.5;
                const y = (event.clientY - bounds.top) / bounds.height - 0.5;

                mediaX(x * 18);
                contentX(x * -7);
                factsX(x * -14);
                factsY(y * -10);
              };

              const resetPointer = () => {
                mediaX(0);
                contentX(0);
                factsX(0);
                factsY(0);
              };

              hero.addEventListener('pointermove', handlePointerMove);
              hero.addEventListener('pointerleave', resetPointer);

              cleanupPointer = () => {
                hero.removeEventListener('pointermove', handlePointerMove);
                hero.removeEventListener('pointerleave', resetPointer);
              };
            }
          }

          const inventoryCards = gsap.utils.toArray<HTMLElement>('.vehicle-card-link');
          const inventory = gsap.timeline({
            defaults: { ease: 'power3.out' },
            scrollTrigger: {
              trigger: '.inventory-section',
              start: 'top 72%',
              once: true,
            },
          });

          inventory
            .from('.inventory-section .eyebrow', { x: -34, autoAlpha: 0, duration: 0.58 })
            .from('#inventory-title', { x: -64, autoAlpha: 0, duration: 0.86 }, '<0.08')
            .from('.section-heading-copy > *', { x: 38, autoAlpha: 0, stagger: 0.12, duration: 0.68 }, '<0.14')
            .fromTo(
              inventoryCards,
              {
                x: (index) => [-110, 0, 110][index] ?? 0,
                y: (index) => (index === 1 ? 76 : 28),
                rotation: (index) => [-1.2, 0, 1.2][index] ?? 0,
                autoAlpha: 0,
              },
              {
                x: 0,
                y: 0,
                rotation: 0,
                autoAlpha: 1,
                duration: 1.08,
                stagger: 0.11,
              },
              '<0.18',
            )
            .from(
              '.vehicle-card .vehicle-image',
              {
                scale: 1.055,
                xPercent: (index) => [-3, 0, 3][index] ?? 0,
                duration: 1.3,
                stagger: 0.1,
                ease: 'power2.out',
              },
              '<0.34',
            );

          const sell = gsap.timeline({
            defaults: { ease: 'power3.out' },
            scrollTrigger: {
              trigger: '.sell-section',
              start: 'top 72%',
              once: true,
            },
          });

          sell
            .from('.sell-content .eyebrow', { x: 34, autoAlpha: 0, duration: 0.55 })
            .from('.sell-content h2', { x: 58, autoAlpha: 0, duration: 0.82 }, '<0.08')
            .from('.sell-content > p:not(.eyebrow)', { x: 38, autoAlpha: 0, duration: 0.62 }, '<0.14')
            .from('.process-list li', { x: 34, autoAlpha: 0, stagger: 0.12, duration: 0.52 }, '<0.12')
            .from(
              '.sell-content .button',
              { autoAlpha: 0, duration: 0.55 },
              '<0.08',
            );

          const services = gsap.timeline({
            defaults: { ease: 'power3.out' },
            scrollTrigger: {
              trigger: '.services-section',
              start: 'top 72%',
              once: true,
            },
          });

          services
            .from('.services-section .eyebrow', { x: -30, autoAlpha: 0, duration: 0.52 })
            .from('#services-title', { y: 44, autoAlpha: 0, duration: 0.78 }, '<0.08')
            .from(
              '.service-card',
              {
                y: 82,
                rotationX: 8,
                transformOrigin: '50% 100%',
                autoAlpha: 0,
                stagger: 0.14,
                duration: 0.9,
              },
              '<0.2',
            )
            .from('.service-number', { scale: 0.4, autoAlpha: 0, stagger: 0.14, duration: 0.42 }, '<0.22');

          const trust = gsap.timeline({
            defaults: { ease: 'power3.out' },
            scrollTrigger: {
              trigger: '.trust-section',
              start: 'top 70%',
              once: true,
            },
          });

          trust
            .from('.trust-copy > *', { x: -48, autoAlpha: 0, stagger: 0.1, duration: 0.68 })
            .from('.trust-metrics > div', { x: 68, autoAlpha: 0, stagger: 0.13, duration: 0.72 }, '<0.12')
            .from('.trust-metrics strong', { yPercent: 70, autoAlpha: 0, stagger: 0.13, duration: 0.58 }, '<0.16');

          const faq = gsap.timeline({
            defaults: { ease: 'power3.out' },
            scrollTrigger: {
              trigger: '.faq-section',
              start: 'top 72%',
              once: true,
            },
          });

          faq
            .from('.faq-intro > *', { x: -44, autoAlpha: 0, stagger: 0.1, duration: 0.64 })
            .from(
              '.faq-list summary',
              { x: 42, autoAlpha: 0, stagger: 0.1, duration: 0.66 },
              '<0.12',
            );

          gsap.timeline({
            scrollTrigger: {
              trigger: '.contact-section',
              start: 'top 78%',
              once: true,
            },
          })
            .from('.contact-copy > *', { y: 36, autoAlpha: 0, stagger: 0.1, duration: 0.7, ease: 'power3.out' })
            .from('.contact-actions', { scale: 0.94, autoAlpha: 0, duration: 0.68, ease: 'power3.out' }, '<0.12')
            .fromTo(
              '.contact-glow',
              { scale: 0.7, autoAlpha: 0 },
              { scale: 1, autoAlpha: 0.8, duration: 1.15, ease: 'power2.out' },
              0,
            );

          return cleanupPointer;
        },
      );

      return () => media.revert();
    },
    { scope: root },
  );

  return (
    <main className="home-gsap" id="inicio" ref={root}>
      {children}
    </main>
  );
}
