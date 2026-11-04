import type { Metadata } from 'next';
import { Check, Clock3, ShieldCheck } from 'lucide-react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { InnerPageMotion } from '@/components/motion/inner-page-motion';
import { Eyebrow } from '@/components/ui/eyebrow';
import { SkeletonImage } from '@/components/ui/skeleton-image';
import { createPageMetadata } from '@/lib/metadata';
import { ValuationForm } from './_components/valuation-form';
import './page.css';

export const metadata: Metadata = createPageMetadata({
  title: "Vendé tu auto | Gonba's Garage",
  description: "Compartí los datos de tu vehículo y solicitá una estimación de valor a Gonba's Garage.",
  path: '/vender',
});

// Rendered widths from page.css: the shell's width on phones, at most 760px in one column, then the
// intro column beside the form (an over-estimate up to 1200px, where the form keeps its minimum).
const VALUATION_IMAGE_SIZES =
  '(max-width: 700px) calc(100vw - 26px), (max-width: 808px) calc(100vw - 50px), (max-width: 1000px) 758px, (max-width: 1428px) calc(42vw - 23px), 574px';

export default function SellVehiclePage() {
  return (
    <InnerPageMotion className="valuation-page" id="valuation-top" variant="valuation">
      <SiteHeader active="sell" />

      <main>
        <section className="section-shell valuation-layout" aria-labelledby="valuation-title">
          <aside className="valuation-intro">
            <div className="valuation-intro-heading">
              <Eyebrow>Tasación inicial</Eyebrow>
              <h1 id="valuation-title">Contanos qué auto tenés.</h1>
              <p className="valuation-lead">
                Con algunos datos podemos preparar una primera estimación y decirte si la unidad encaja con nuestra
                selección.
              </p>
            </div>

            <div className="valuation-intro-details">
              <div className="valuation-image glass-panel">
                <SkeletonImage
                  src="/garage-classic.jpg"
                  alt="Auto clásico estacionado frente a un garage"
                  fill
                  sizes={VALUATION_IMAGE_SIZES}
                  className="cover-image"
                />
                <span>Tu auto puede ser el próximo.</span>
              </div>

              <ul className="valuation-promises" aria-label="Información sobre la tasación">
                <li>
                  <Clock3 aria-hidden="true" size={17} />
                  <span>
                    <strong>Respuesta estimada</strong> dentro de las próximas 24 horas hábiles.
                  </span>
                </li>
                <li>
                  <ShieldCheck aria-hidden="true" size={17} />
                  <span>
                    <strong>Datos privados</strong> usados solamente para evaluar tu vehículo.
                  </span>
                </li>
                <li>
                  <Check aria-hidden="true" size={17} />
                  <span>
                    <strong>Sin compromiso</strong> la estimación inicial no te obliga a vender.
                  </span>
                </li>
              </ul>
            </div>
          </aside>

          <ValuationForm />
        </section>
      </main>

      <SiteFooter topHref="#valuation-top" />
    </InnerPageMotion>
  );
}
