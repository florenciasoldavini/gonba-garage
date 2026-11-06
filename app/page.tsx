import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { ArrowDown, ArrowLeftRight, ArrowUpRight, FileCheck, HandCoins } from 'lucide-react';

import { TrackedAnchor } from '@/components/analytics/tracked-anchor';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ContactCallout } from '@/components/marketing/contact-callout';
import { BUSINESS_AREA_LABEL, WHATSAPP_GENERAL_MESSAGE } from '@/constants/contact';
import { getWhatsAppUrl } from '@/lib/contact';
import { createPageMetadata } from '@/lib/metadata';
import { ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { SkeletonImage } from '@/components/ui/skeleton-image';
import { HomeGsapMotion } from '@/app/_components/home-gsap-motion';
import { FaqAccordion } from '@/app/_components/faq-accordion';
import { HomeReviews } from '@/app/_components/home-reviews';
import { listCatalogVehicles } from '@/lib/integrations/mercado-libre/catalog';
import { readHomeReviews } from '@/lib/reviews/cache';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { VehicleGrid } from '@/components/vehicles/vehicle-grid';
import './page.css';

export const metadata: Metadata = createPageMetadata({
  title: "Gonba's Garage | Autos usados seleccionados",
  description: 'Compra y venta de autos usados seleccionados. Inventario actualizado y atención personalizada.',
  path: '/',
});

const Arrow = () => <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />;

// The portrait photo fills the section's width: one column up to 1000px, then 1.08fr of the layout.
const SELL_IMAGE_SIZES =
  '(max-width: 700px) calc(100vw - 26px), (max-width: 1000px) calc(100vw - 50px), (max-width: 1428px) calc(54vw - 27px), 744px';

export default async function Home() {
  // Rendered per request, outside the failure handler, so a failed read is never stored as the
  // page. The vehicles come from the catalog cache, which the sync worker expires.
  await connection();
  // The section is only a bonus: when the reviews can't be read, the page goes on without it.
  const reviewsRead = readHomeReviews().catch(() => {
    console.error('home_reviews_unavailable');
    return [];
  });
  let vehicles: Vehicle[] = [];
  let inventoryUnavailable = false;
  try {
    vehicles = (await listCatalogVehicles()).filter(({ status }) => status === 'active').slice(0, 3);
  } catch {
    inventoryUnavailable = true;
  }
  const reviews = await reviewsRead;
  return (
    <HomeGsapMotion>
      <SiteHeader />

      <main>
        <section className="hero section-shell" aria-labelledby="hero-title">
          <div className="hero-media" aria-hidden="true">
            <SkeletonImage src="/hero-interior.jpg" alt="" fill loading="eager" sizes="100vw" className="cover-image" />
          </div>
          <div className="hero-overlay" />
          <div className="hero-ignition-light" aria-hidden="true" />
          <div className="hero-content">
            <Eyebrow>Autos usados seleccionados</Eyebrow>
            <h1 id="hero-title">Encontrá un auto que valga la pena manejar.</h1>
            <p className="hero-intro">
              Seleccionamos, revisamos y presentamos cada vehículo con la información que necesitás para elegir con
              confianza.
            </p>
            <div className="hero-actions">
              <ButtonLink href="/vehiculos">
                Ver vehículos <Arrow />
              </ButtonLink>
              <ButtonLink href="/vender" variant="glass">
                Quiero vender mi auto
              </ButtonLink>
            </div>
          </div>
          <aside className="hero-facts glass-panel" aria-label="Información destacada">
            <div>
              <span className="hero-fact-mark" aria-hidden="true" />
              <span>Selección cuidadosa</span>
            </div>
            <div>
              <span className="hero-fact-mark" aria-hidden="true" />
              <span>Información transparente</span>
            </div>
            <div>
              <span className="hero-fact-mark" aria-hidden="true" />
              <span>Atención directa</span>
            </div>
          </aside>
          <a className="scroll-cue" href="#vehiculos">
            Explorar <ArrowDown aria-hidden="true" size={16} strokeWidth={1.8} />
          </a>
        </section>

        <section className="section-shell inventory-section" id="vehiculos" aria-labelledby="inventory-title">
          <div className="section-heading">
            <div>
              <Eyebrow>Inventario</Eyebrow>
              <h2 id="inventory-title">Elegidos por una razón.</h2>
            </div>
            <div className="section-heading-copy">
              <p>Una selección corta y cuidada. Menos tiempo buscando, más claridad para decidir.</p>
              <Link className="text-link" href="/vehiculos">
                Ver inventario completo <Arrow />
              </Link>
            </div>
          </div>
          {vehicles.length > 0 ? (
            <VehicleGrid vehicles={vehicles} />
          ) : (
            <p role="status">
              {inventoryUnavailable
                ? 'No pudimos cargar las unidades en este momento. Consultá el inventario completo o escribinos por WhatsApp.'
                : 'No hay unidades disponibles en este momento. Escribinos y contanos qué auto buscás.'}
            </p>
          )}
        </section>

        <section className="section-shell sell-section" id="vender" aria-labelledby="sell-title">
          <div className="sell-media">
            <SkeletonImage
              src="/sell-showroom.jpg"
              alt="Toyota negra y BMW blanco exhibidos en Gonba's Garage"
              fill
              sizes={SELL_IMAGE_SIZES}
              className="cover-image"
            />
          </div>
          <div className="sell-content glass-panel">
            <Eyebrow>Vendé tu auto</Eyebrow>
            <h2 id="sell-title">Una operación simple, clara y sin vueltas.</h2>
            <p>
              Contanos qué auto tenés. Lo evaluamos, coordinamos una revisión y te presentamos una propuesta
              transparente.
            </p>
            <ol className="process-list">
              <li>
                <span>01</span> Compartís los datos del vehículo
              </li>
              <li>
                <span>02</span> Coordinamos la evaluación
              </li>
              <li>
                <span>03</span> Recibís una propuesta
              </li>
            </ol>
            <ButtonLink href="/vender">
              Solicitar una tasación <Arrow />
            </ButtonLink>
          </div>
        </section>

        <section className="section-shell services-section" id="servicios" aria-labelledby="services-title">
          <div className="section-heading compact-heading">
            <div>
              <Eyebrow>Otros servicios</Eyebrow>
              <h2 id="services-title">Todo lo importante, en un solo lugar.</h2>
            </div>
          </div>
          <div className="services-grid">
            <article className="service-card glass-panel">
              <span className="service-icon">
                <HandCoins aria-hidden="true" size={18} strokeWidth={1.8} />
              </span>
              <div>
                <h3>Consignación</h3>
                <p>Publicamos y vendemos tu auto por vos, con una comisión del 5%.</p>
              </div>
            </article>
            <article className="service-card glass-panel">
              <span className="service-icon">
                <ArrowLeftRight aria-hidden="true" size={18} strokeWidth={1.8} />
              </span>
              <div>
                <h3>Permutas</h3>
                <p>Evaluamos tu vehículo como parte de pago de forma directa y transparente.</p>
              </div>
            </article>
            <article className="service-card glass-panel">
              <span className="service-icon">
                <FileCheck aria-hidden="true" size={18} strokeWidth={1.8} />
              </span>
              <div>
                <h3>Gestoría</h3>
                <p>Acompañamiento documental para una transferencia clara y ordenada.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="section-shell trust-section" aria-labelledby="trust-title">
          <span className="trust-anchor" id="nosotros" />
          <div className="trust-copy">
            <Eyebrow>La diferencia Gonba&apos;s Garage</Eyebrow>
            <h2 id="trust-title">No se trata de vender cualquier auto.</h2>
            <p>
              Soy Gonzalo Barreiro, y desde chico me apasionan los autos. En 2020 empecé mi negocio de compra y venta, y
              hoy somos un equipo en {BUSINESS_AREA_LABEL}, con más de 300 autos vendidos.
            </p>
          </div>
          <div className="trust-metrics glass-panel">
            <div>
              <span>Vendiendo autos desde</span>
              <strong>2020</strong>
            </div>
            <div>
              <span>Autos vendidos</span>
              <strong>+300</strong>
            </div>
            <div>
              <span>Respuesta estimada</span>
              <strong>24 h</strong>
            </div>
          </div>
        </section>

        {reviews.length > 0 ? <HomeReviews reviews={reviews} /> : null}

        <section className="section-shell faq-section" id="preguntas" aria-labelledby="faq-title">
          <div className="faq-intro">
            <Eyebrow>Preguntas frecuentes</Eyebrow>
            <h2 id="faq-title">Lo que conviene saber antes de empezar.</h2>
            <p>
              Si tu pregunta no está acá,{' '}
              <TrackedAnchor
                analyticsEvent={{
                  name: 'contact_intent_clicked',
                  properties: { channel: 'whatsapp', placement: 'home_faq' },
                }}
                className="faq-contact-link"
                href={getWhatsAppUrl(WHATSAPP_GENERAL_MESSAGE)}
                rel="noreferrer"
                target="_blank"
              >
                escribinos
                <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.8} />
              </TrackedAnchor>{' '}
              y la resolvemos juntos.
            </p>
          </div>
          <FaqAccordion />
        </section>

        <ContactCallout
          actionHref={getWhatsAppUrl(WHATSAPP_GENERAL_MESSAGE)}
          actionLabel="Escribir por WhatsApp"
          analytics={{ name: 'contact_intent_clicked', properties: { channel: 'whatsapp', placement: 'home_contact' } }}
          eyebrow="Hablemos"
          id="contacto"
          title="El próximo paso puede empezar con un mensaje."
          titleId="contact-title"
        />
      </main>

      <SiteFooter home topHref="#inicio" />
    </HomeGsapMotion>
  );
}
