import type { Metadata } from 'next';
import { Clock3, ShieldCheck } from 'lucide-react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { Eyebrow } from '@/components/ui/eyebrow';
import { SkeletonImage } from '@/components/ui/skeleton-image';
import { createPageMetadata } from '@/lib/metadata';
import { ReviewForm } from './_components/review-form';
import './page.css';

// The link Gonzalo sends after a sale or purchase. It is linked from nowhere on the site and stays out
// of search results whatever SITE_INDEXING_ENABLED says, but keeps its share preview for WhatsApp.
export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Contanos tu experiencia | Gonba's Garage",
    description: "Dejá tu opinión sobre cómo fue comprar o vender tu auto con Gonba's Garage.",
    path: '/opinar',
    image: '/social/opinar.jpg',
    imageAlt: "BMW blanco y Mercedes-Benz negro en Gonba's Garage",
  }),
  robots: { index: false, follow: false },
};

// Rendered widths from page.css, the same as the photo on /vender: the shell's width on phones, at most
// 760px in one column, then the intro column beside the form.
const REVIEW_IMAGE_SIZES =
  '(max-width: 700px) calc(100vw - 26px), (max-width: 808px) calc(100vw - 50px), (max-width: 1000px) 758px, (max-width: 1428px) calc(42vw - 23px), 574px';

export default function ReviewPage() {
  return (
    <div className="review-page" id="review-top">
      <SiteHeader />

      <main>
        <section className="section-shell review-layout" aria-labelledby="review-title">
          <aside className="review-intro">
            <div className="review-intro-heading">
              <Eyebrow>Tu opinión</Eyebrow>
              <h1 id="review-title">¿Cómo fue tu experiencia?</h1>
              <p className="review-lead">Te lleva un minuto y ayuda a otras personas a saber qué esperar.</p>
            </div>

            <div className="review-intro-details">
              <div className="review-image glass-panel">
                <SkeletonImage
                  src="/opinar-car.jpg"
                  alt="Toyota blanca y Mercedes-Benz gris en el showroom de Gonba's Garage"
                  fill
                  sizes={REVIEW_IMAGE_SIZES}
                  className="cover-image"
                />
              </div>

              <ul className="review-promises" aria-label="Información sobre tu opinión">
                <li>
                  <Clock3 aria-hidden="true" size={17} />
                  <span>
                    <strong>Un minuto</strong> y no hace falta crear una cuenta.
                  </span>
                </li>
                <li>
                  <ShieldCheck aria-hidden="true" size={17} />
                  <span>
                    <strong>Datos mínimos:</strong> no te pedimos email ni teléfono.
                  </span>
                </li>
              </ul>
            </div>
          </aside>

          <ReviewForm />
        </section>
      </main>

      <SiteFooter topHref="#review-top" />
    </div>
  );
}
