import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { ArrowDown, ArrowUpRight, Check, Scale } from 'lucide-react';

import { TrackedButtonAnchor } from '@/components/analytics/tracked-anchor';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ContactCallout } from '@/components/marketing/contact-callout';
import { InnerPageMotion } from '@/components/motion/inner-page-motion';
import { JsonLd } from '@/components/seo/json-ld';
import { BUSINESS_AREA_LABEL, BUSINESS_VISIT_POLICY } from '@/constants/contact';
import { getWhatsAppUrl } from '@/lib/contact';
import { ButtonAnchor, ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import {
  findCatalogPublication,
  findCatalogVehicle,
  listCatalogVehicles,
} from '@/lib/integrations/mercado-libre/catalog';
import { fullSizeMercadoLibreImageUrl } from '@/lib/integrations/mercado-libre/pictures';
import { formatVehicleMileage, formatVehiclePrice } from '@/features/vehicles/presentation/formatters';
import { unbreakableVersionSegments } from '@/features/vehicles/presentation/listing-cleanup';
import { publicVehicleAttributes } from '@/features/vehicles/presentation/public-attributes';
import { VehicleSpecificationGroups } from './_components/vehicle-specification-groups';
import { getVehicleStatusPresentation } from '@/features/vehicles/presentation/status';
import { pickSimilarVehicles } from '@/features/vehicles/domain/similar-vehicles';
import { VEHICLE_PHOTO_PLACEHOLDER, type Vehicle } from '@/features/vehicles/domain/vehicle';
import { ApproximateUsdPrice } from '../_components/approximate-usd-price';
import { InventoryAlert, type InventoryAlertCriteria } from '../_components/inventory-alert';
import { createPageMetadata } from '@/lib/metadata';
import { getMepQuote } from '@/lib/integrations/mep-quote';
import { getSiteUrl } from '@/lib/site-url';
import { ORGANIZATION_SCHEMA_ID } from '@/lib/structured-data';
import type { AnalyticsEvent } from '@/lib/analytics/client';
import { PriceAlert, PriceAlertProvider } from './_components/price-alert';
import { alertEmailsConfigured } from '@/lib/alerts/config';
import { ShareButton } from './_components/share-button';
import { SimilarVehicleLink } from './_components/similar-vehicle-link';
import { VehicleAnalytics } from './_components/vehicle-analytics';
import { VehicleContactDock } from './_components/vehicle-contact-dock';
import { VehiclePhotoViewer } from './_components/vehicle-photo-viewer';
import './page.css';

type VehicleDetailPageProps = {
  params: Promise<{ slug: string }>;
};

const Arrow = () => <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />;

// Rendered per request: a reserved car turns sold by the passing of time, and a failed read must
// never be stored as the page. The publication and the list come from the catalog cache, which the
// sync worker expires (lib/catalog/cache.ts).
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: VehicleDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  let vehicle;
  try {
    vehicle = await findCatalogVehicle(slug);
  } catch {
    return { title: "Catálogo no disponible | Gonba's Garage", robots: { index: false, follow: false } };
  }

  if (!vehicle) {
    return { title: "Vehículo no encontrado | Gonba's Garage" };
  }

  const status = getVehicleStatusPresentation(vehicle);
  const title = `${vehicle.make} ${vehicle.model} ${vehicle.year} | Gonba's Garage`;
  const summary = `${vehicle.make} ${vehicle.model} ${vehicle.version}, ${vehicle.year}, ${formatVehicleMileage(vehicle.mileageKm)}.`;
  const description = status.isAvailable
    ? `${summary} Consultá disponibilidad en Gonba's Garage.`
    : `${summary} ${status.status === 'paused' ? 'Está reservado' : 'Ya se vendió'}: mirá autos parecidos disponibles en Gonba's Garage.`;

  const metadata = createPageMetadata({
    title,
    description,
    path: `/vehiculos/${vehicle.slug}`,
    image: `/og/vehiculos/${vehicle.slug}`,
    imageAlt: `${vehicle.make} ${vehicle.model} ${vehicle.version}, ${vehicle.year}`,
  });

  // Car pages stay out of search results until the final version of the site, whatever
  // SITE_INDEXING_ENABLED says (docs/seo-and-social-metadata.md).
  return { ...metadata, robots: { index: false, follow: false } };
}

export default async function VehicleDetailPage({ params }: VehicleDetailPageProps) {
  const { slug } = await params;
  let publication;
  try {
    publication = await findCatalogPublication(slug);
  } catch {
    // A backend failure is not a missing vehicle: keep notFound() for real 404s only.
    return (
      <div className="section-shell">
        <SiteHeader active="vehicles" />
        <main>
          <h1>Catálogo no disponible</h1>
          <p>No pudimos consultar esta publicación. Volvé a intentar en unos minutos.</p>
        </main>
      </div>
    );
  }

  // The slug is fixed at the first sync. Older or edited slugs for the same publication redirect.
  if (!publication) notFound();
  if (publication.vehicle.slug !== slug) permanentRedirect(`/vehiculos/${publication.vehicle.slug}`);
  const { vehicle } = publication;
  const pictures = publication.source.pictures ?? [];
  const photos = pictures
    .map(picture => fullSizeMercadoLibreImageUrl(picture.secure_url || picture.url))
    .filter((src): src is string => Boolean(src));
  // A publication without pictures can still have a thumbnail. The placeholder is not a photo of the car.
  if (!photos.length && vehicle.image !== VEHICLE_PHOTO_PLACEHOLDER) photos.push(vehicle.image);
  const attributes = publicVehicleAttributes(
    publication.source.attributes ?? [],
    `${vehicle.make} ${vehicle.model} ${vehicle.version}`,
  );

  const siteUrl = getSiteUrl();
  const vehicleUrl = new URL(`/vehiculos/${vehicle.slug}`, siteUrl).toString();
  const compareHref = `/vehiculos?comparar=${vehicle.slug}#inventario`;
  const status = getVehicleStatusPresentation(vehicle);
  const isReserved = status.status === 'paused';
  const vehicleName = `${vehicle.make} ${vehicle.model}`;
  const bodyType = vehicle.body.split(' · ')[0];
  // The card states the status, once. The eyebrow names what the title meta row leaves out.
  const titleEyebrow =
    [bodyType, vehicle.fuel].filter(fact => fact && fact !== 'Sin especificar').join(' · ') || vehicle.make;
  const formattedPrice = formatVehiclePrice(vehicle.price, vehicle.currency);
  const vehicleMeta = [vehicle.year, formatVehicleMileage(vehicle.mileageKm), vehicle.transmission.split(',')[0]];
  // The seller has several cars of the same model, so every message names the exact publication.
  const vehicleReference = [vehicle.make, vehicle.model, vehicle.version, vehicle.year].filter(Boolean).join(' ');
  const vehicleContactHref = getWhatsAppUrl(
    `Hola, quiero consultar por el ${vehicleReference}, publicado a ${formattedPrice}. ${vehicleUrl}`,
  );
  // Alerts are offered only where their emails can be sent (production, not previews).
  const alertsEnabled = alertEmailsConfigured();

  // The rail is a bonus: a catalog failure must not take down the car's page.
  const catalog: Vehicle[] = await listCatalogVehicles().catch(() => []);
  const similarVehicles = pickSimilarVehicles(vehicle, catalog);
  const availableCount = catalog.length;
  // Only peso prices get the approximate dollar line, so the quote is fetched only when one is shown.
  const quote =
    vehicle.currency === 'ARS' || similarVehicles.some(({ currency }) => currency === 'ARS')
      ? await getMepQuote()
      : null;
  // Reserved: the same model coming back (the reservation fell through, or a relisting). Sold: the
  // same make and body type.
  const alertCriteria: InventoryAlertCriteria = {
    query: isReserved ? vehicle.model : '',
    make: vehicle.make,
    transmission: '',
    bodyType: isReserved ? '' : bodyType,
    fuel: '',
    minPrice: null,
    maxPrice: null,
    minMileage: null,
    maxMileage: null,
  };
  const contact = status.isAvailable
    ? {
        href: vehicleContactHref,
        label: 'Consultar ahora',
        eyebrow: 'Coordiná una visita',
        title: 'Conocelo en persona. El resto se entiende manejando.',
      }
    : isReserved
      ? {
          href: getWhatsAppUrl(
            `Hola, vi que el ${vehicleReference}, publicado a ${formattedPrice}, está reservado. Si se libera, avisame. ${vehicleUrl}`,
          ),
          label: 'Escribinos por WhatsApp',
          eyebrow: '¿Te interesaba este?',
          title: 'Escribinos. Si la reserva se cae, sos el primero en saberlo.',
        }
      : {
          href: getWhatsAppUrl(
            `Hola, vi que el ${vehicleReference}, último precio publicado ${formattedPrice}, ya se vendió. Estoy buscando algo parecido. ${vehicleUrl}`,
          ),
          label: 'Escribinos por WhatsApp',
          eyebrow: '¿Buscás algo parecido?',
          title: 'Contanos qué auto buscás. Te avisamos cuando entre.',
        };
  const contactEvent = (placement: 'hero' | 'callout' | 'dock'): AnalyticsEvent => ({
    name: 'vehicle_contact_clicked',
    properties: {
      channel: 'whatsapp',
      placement,
      vehicle_slug: vehicle.slug,
      vehicle_status: status.isAvailable ? 'available' : isReserved ? 'reserved' : 'sold',
    },
  });
  // The same rail under every car. Reserved and sold: alternatives, right under the status card that
  // points to them. Available: other cars to keep browsing, once this one has been seen in full and
  // before the closing contact callout.
  const similarRail = similarVehicles.length > 0 && (
    <section className="section-shell detail-similar" id="similares" aria-labelledby="similar-title">
      <h2 className="eyebrow" id="similar-title">
        <span aria-hidden="true" />
        {status.isAvailable ? 'Seguí mirando' : 'Parecidos, todavía en el garage'}
      </h2>
      <Link className="text-link" href="/vehiculos">
        Ver inventario completo <Arrow />
      </Link>
      <ol className="detail-similar-list">
        {similarVehicles.map((similar, index) => (
          <SimilarVehicleLink index={index} key={similar.slug} quote={quote} vehicle={similar} />
        ))}
        {similarVehicles.length < 3 && (
          <li>
            <Link className="detail-similar-link detail-similar-more" href="/vehiculos">
              <span className="detail-similar-number">{String(similarVehicles.length + 1).padStart(2, '0')}</span>
              <span className="detail-similar-name">
                <strong>Todo el inventario</strong>
                <span>
                  {String(availableCount).padStart(2, '0')}{' '}
                  {availableCount === 1 ? 'auto disponible' : 'autos disponibles'} hoy
                </span>
              </span>
              <ArrowUpRight className="detail-similar-arrow" aria-hidden="true" size={20} strokeWidth={1.8} />
            </Link>
          </li>
        )}
      </ol>
    </section>
  );
  const organizationId = new URL(ORGANIZATION_SCHEMA_ID, siteUrl).toString();
  const vehicleSchemaId = `${vehicleUrl}#vehicle`;
  const vehicleStructuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Product', 'Vehicle'],
        '@id': vehicleSchemaId,
        mainEntityOfPage: vehicleUrl,
        name: `${vehicle.make} ${vehicle.model} ${vehicle.version}`,
        ...(photos.length ? { image: [new URL(vehicle.image, siteUrl).toString()] } : {}),
        description: vehicle.description,
        url: vehicleUrl,
        sku: vehicle.stockCode,
        brand: { '@type': 'Brand', name: vehicle.make },
        model: vehicle.model,
        color: vehicle.color,
        fuelType: vehicle.fuel,
        vehicleConfiguration: vehicle.version,
        vehicleModelDate: String(vehicle.year),
        vehicleTransmission: vehicle.transmission,
        mileageFromOdometer: {
          '@type': 'QuantitativeValue',
          value: vehicle.mileageKm,
          unitCode: 'KMT',
        },
        offers: {
          '@type': 'Offer',
          price: vehicle.price,
          priceCurrency: vehicle.currency,
          availability: status.schemaAvailability,
          itemCondition: 'https://schema.org/UsedCondition',
          seller: { '@id': organizationId },
          url: vehicleUrl,
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${vehicleUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Inicio',
            item: new URL('/', siteUrl).toString(),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Vehículos',
            item: new URL('/vehiculos', siteUrl).toString(),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: `${vehicle.make} ${vehicle.model}`,
            item: vehicleUrl,
          },
        ],
      },
    ],
  };

  return (
    <InnerPageMotion className="vehicle-detail-page" variant="detail">
      <VehicleAnalytics
        bodyType={vehicle.body.split(' · ')[0]}
        currency={vehicle.currency}
        make={vehicle.make}
        model={vehicle.model}
        price={vehicle.price}
        vehicleSlug={vehicle.slug}
        year={vehicle.year}
      />
      <JsonLd data={vehicleStructuredData} />

      <SiteHeader active="vehicles" />

      <main>
        <nav className="section-shell detail-breadcrumbs" aria-label="Ruta de navegación">
          <ol>
            <li>
              <Link href="/">Inicio</Link>
              <span aria-hidden="true">/</span>
            </li>
            <li>
              <Link href="/vehiculos">Vehículos</Link>
              <span aria-hidden="true">/</span>
            </li>
            <li aria-current="page">
              <span>{`${vehicle.make} ${vehicle.model}`}</span>
            </li>
          </ol>
        </nav>

        <section className="section-shell detail-title" aria-labelledby="vehicle-title">
          <div>
            <Eyebrow>{titleEyebrow}</Eyebrow>
            <h1 id="vehicle-title">
              {`${vehicle.make} ${vehicle.model}`} <em>{unbreakableVersionSegments(vehicle.version)}</em>
            </h1>
          </div>
          <div className="detail-title-meta">
            {vehicleMeta.map(fact => (
              <span key={fact}>{fact}</span>
            ))}
          </div>
        </section>

        <PriceAlertProvider
          enabled={alertsEnabled && status.isAvailable}
          vehicleName={`${vehicle.make} ${vehicle.model} ${vehicle.version}`}
          vehicleSlug={vehicle.slug}
          formattedPrice={formattedPrice}
        >
          <section
            className="section-shell detail-showcase"
            data-status={status.status}
            aria-label="Presentación del vehículo"
          >
            <VehiclePhotoViewer photos={photos} title={vehicle.imageAlt} />
            {!status.isAvailable && (
              <p className="detail-status-banner">
                {isReserved ? 'Ya tiene una reserva.' : 'Esta unidad ya tiene dueño.'}
              </p>
            )}

            <aside
              className="detail-purchase-card glass-panel"
              aria-label={status.isAvailable ? 'Precio y consulta' : 'Estado de la publicación'}
            >
              <div className="detail-purchase-top">
                <div className="detail-availability" data-status={status.status}>
                  <span /> {status.label}
                </div>
                <div className="detail-utility-actions">
                  {status.isAvailable && (
                    <Link className="detail-compare-button" href={compareHref}>
                      <span>Comparar</span>
                      <Scale aria-hidden="true" size={14} strokeWidth={1.8} />
                    </Link>
                  )}
                  <ShareButton
                    fallbackUrl={vehicleUrl}
                    imageSrc={vehicle.image}
                    text={`Mirá este ${vehicle.make} ${vehicle.model} ${vehicle.version} ${status.isAvailable ? 'publicado por' : 'en'} Gonba's Garage.`}
                    title={`${vehicle.make} ${vehicle.model}`}
                    vehicleMeta={`${vehicle.year} · ${vehicle.version}`}
                    vehicleSlug={vehicle.slug}
                    statusLabel={status.label}
                  />
                </div>
              </div>
              {status.isAvailable ? (
                <>
                  <p className="detail-price-label">Precio publicado</p>
                  <p className="detail-price">{formattedPrice}</p>
                  <ApproximateUsdPrice className="detail-price-usd" quote={quote} vehicle={vehicle} />
                  {/* The business area, not Mercado Libre's seller address, which is the same for every car. */}
                  <p className="detail-location">{`${BUSINESS_AREA_LABEL} · ${BUSINESS_VISIT_POLICY}`}</p>
                  <PriceAlert />
                  <div className="detail-actions">
                    <TrackedButtonAnchor
                      analyticsEvent={contactEvent('hero')}
                      href={vehicleContactHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Consultar por este auto <Arrow />
                    </TrackedButtonAnchor>
                    <ButtonAnchor href="#ficha" variant="glass">
                      Ver ficha técnica <ArrowDown aria-hidden="true" size={16} strokeWidth={1.8} />
                    </ButtonAnchor>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="detail-status-title">
                    {isReserved ? 'Este auto está reservado.' : 'Este auto ya se vendió.'}
                  </h2>
                  <p className="detail-status-copy">
                    {alertsEnabled
                      ? isReserved
                        ? 'Alguien lo reservó, pero a veces las reservas se caen: dejanos tu email y te avisamos si se libera o si entra otro igual.'
                        : 'Si buscás algo así, dejanos tu email y te avisamos cuando entre uno parecido.'
                      : isReserved
                        ? 'Alguien lo reservó, pero a veces las reservas se caen: escribinos por WhatsApp y te avisamos si se libera.'
                        : 'Si buscás algo así, escribinos por WhatsApp y te avisamos cuando entre uno parecido.'}
                    {similarVehicles.length > 0 &&
                      (isReserved
                        ? ' Mientras tanto, abajo tenés autos parecidos disponibles.'
                        : ' Abajo tenés autos parecidos que siguen en el garage.')}
                  </p>
                  <dl className="detail-last-price">
                    <dt>{isReserved ? 'Precio publicado' : 'Último precio publicado'}</dt>
                    <dd>
                      {formattedPrice}
                      {isReserved && <ApproximateUsdPrice quote={quote} vehicle={vehicle} />}
                    </dd>
                  </dl>
                  {alertsEnabled ? (
                    <InventoryAlert
                      activeFilterCount={2}
                      criteria={alertCriteria}
                      placement="vehicle"
                      resultCount={similarVehicles.length}
                      vehicleCopy={
                        isReserved
                          ? {
                              trigger: 'Avisame si se libera',
                              hint: 'O si entra otro igual. Por email.',
                              title: 'Avisame si se libera.',
                              description: `Te avisamos por email si la reserva se cae o si entra otro ${vehicleName}.`,
                            }
                          : {
                              trigger: 'Avisame si entra uno parecido',
                              hint: 'Recibí una alerta por email',
                              title: 'Avisame si entra uno parecido.',
                              description: `Te avisamos por email cuando entre otro ${vehicle.make} ${bodyType.toLocaleLowerCase('es')}.`,
                            }
                      }
                    />
                  ) : null}
                  <div className="detail-actions">
                    {!alertsEnabled && (
                      <TrackedButtonAnchor
                        analyticsEvent={contactEvent('hero')}
                        href={contact.href}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {isReserved ? 'Avisame por WhatsApp' : 'Contanos qué buscás'} <Arrow />
                      </TrackedButtonAnchor>
                    )}
                    {similarVehicles.length > 0 ? (
                      <ButtonAnchor href="#similares" variant={alertsEnabled ? 'accent' : 'glass'}>
                        Ver autos similares <ArrowDown aria-hidden="true" size={16} strokeWidth={1.8} />
                      </ButtonAnchor>
                    ) : (
                      <ButtonLink href="/vehiculos" variant={alertsEnabled ? 'accent' : 'glass'}>
                        Ver todo el inventario <Arrow />
                      </ButtonLink>
                    )}
                  </div>
                </>
              )}
              <p className="detail-disclaimer">
                {status.isAvailable
                  ? 'Precio y disponibilidad sujetos a confirmación.'
                  : isReserved
                    ? 'Precio sujeto a confirmación.'
                    : 'Datos de la última publicación, solo como referencia.'}
              </p>
            </aside>
          </section>

          {/* The card's price and contact button, kept in reach while the rest of the page is read. */}
          {status.isAvailable && (
            <VehicleContactDock
              contactEvent={contactEvent('dock')}
              contactHref={vehicleContactHref}
              formattedPrice={formattedPrice}
              imageSrc={vehicle.image}
              meta={vehicleMeta.join(' · ')}
              name={`${vehicle.make} ${vehicle.model} ${vehicle.version}`}
              usdPrice={<ApproximateUsdPrice quote={quote} vehicle={vehicle} />}
            />
          )}
        </PriceAlertProvider>

        {!status.isAvailable && similarRail}

        <section className="section-shell detail-overview" id="ficha" aria-labelledby="overview-title">
          <div className="detail-story">
            <Eyebrow>La unidad</Eyebrow>
            <h2 id="overview-title">Elegido por cómo se siente. Revisado por todo lo demás.</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>
              {vehicle.description || 'Esta publicación no incluye descripción.'}
            </p>
            <ul className="detail-highlights" aria-label="Puntos destacados">
              {vehicle.highlights.map(highlight => (
                <li key={highlight}>
                  <Check aria-hidden="true" size={14} strokeWidth={1.8} />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          <div className="detail-specs glass-panel">
            <div className="detail-specs-heading">
              <p>Ficha técnica</p>
            </div>
            <VehicleSpecificationGroups attributes={attributes} />
          </div>
        </section>

        <section className="section-shell detail-confidence" aria-label="Proceso Gonba's Garage">
          <div>
            <span>01</span>
            <strong>Selección</strong>
            <p>Elegimos unidades con identidad y una historia clara.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Revisión</strong>
            <p>Chequeamos información, estado general y documentación.</p>
          </div>
          <div>
            <span>03</span>
            <strong>Acompañamiento</strong>
            <p>Coordinamos la visita y te acompañamos hasta la entrega.</p>
          </div>
        </section>

        {status.isAvailable && similarRail}

        <ContactCallout
          actionHref={contact.href}
          actionLabel={contact.label}
          analytics={contactEvent('callout')}
          className="detail-contact"
          eyebrow={contact.eyebrow}
          id="consulta"
          title={contact.title}
          titleId="contact-title"
        />
      </main>

      <SiteFooter topHref="#vehicle-title" />
    </InnerPageMotion>
  );
}
