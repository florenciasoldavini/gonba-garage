import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { ArrowDown, ArrowUpRight, Scale } from 'lucide-react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ContactCallout } from '@/components/marketing/contact-callout';
import { InnerPageMotion } from '@/components/motion/inner-page-motion';
import { JsonLd } from '@/components/seo/json-ld';
import { getWhatsAppUrl } from '@/lib/contact';
import { ButtonAnchor, ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { findCatalogPublication, findCatalogVehicle, isLiveCatalog, listCatalogVehicles } from '@/lib/integrations/mercado-libre/catalog';
import { fullSizeMercadoLibreImageUrl } from '@/lib/integrations/mercado-libre/pictures';
import { formatVehicleMileage, formatVehiclePrice } from '@/features/vehicles/presentation/formatters';
import { getVehicleSpecification, vehicleSpecificationLabels, type VehicleSpecificationKey } from '@/features/vehicles/presentation/specifications';
import { publicVehicleAttributes } from '@/features/vehicles/presentation/public-attributes';
import { VehicleSpecificationGroups } from './_components/vehicle-specification-groups';
import { getVehicleStatusPresentation } from '@/features/vehicles/presentation/status';
import { pickSimilarVehicles } from '@/features/vehicles/domain/similar-vehicles';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { CatalogVehicleCard } from '../_components/catalog-vehicle-card';
import { InventoryAlert, type InventoryAlertCriteria } from '../_components/inventory-alert';
import { createPageMetadata } from '@/lib/metadata';
import { isSiteIndexingEnabled } from '@/lib/site-indexing';
import { getSiteUrl } from '@/lib/site-url';
import { ORGANIZATION_SCHEMA_ID } from '@/lib/structured-data';
import { PriceAlert } from './_components/price-alert';
import { alertDeliveryEnabled } from '@/lib/alerts/config';
import { ShareButton } from './_components/share-button';
import { VehicleAnalytics } from './_components/vehicle-analytics';
import { VehiclePhotoViewer } from './_components/vehicle-photo-viewer';

type VehicleDetailPageProps = {
  params: Promise<{ slug: string }>;
};

const Arrow = () => <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />;

// Live publications are read at request time from the synced database copy.
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

  if (isLiveCatalog()) return { ...metadata, robots: { index: false, follow: false } };
  // Reserved and sold pages stay reachable but out of search results: the seller often relists the
  // same car under a new publication, and its links to available cars are still worth following.
  return !status.isAvailable && isSiteIndexingEnabled()
    ? { ...metadata, robots: { index: false, follow: true } }
    : metadata;
}

export default async function VehicleDetailPage({ params }: VehicleDetailPageProps) {
  const { slug } = await params;
  let vehicle, publication;
  try {
    publication = await findCatalogPublication(slug);
    vehicle = publication ? publication.vehicle : await findCatalogVehicle(slug);
  } catch {
    // A backend failure is not a missing vehicle: keep notFound() for real 404s only.
    return <div className="section-shell"><SiteHeader active="vehicles" /><main><h1>Catálogo no disponible</h1><p>No pudimos consultar esta publicación. Volvé a intentar en unos minutos.</p></main></div>;
  }

  // The slug is fixed at the first sync. Older or edited slugs for the same publication redirect.
  if (publication && publication.vehicle.slug !== slug) permanentRedirect(`/vehiculos/${publication.vehicle.slug}`);
  if (!vehicle) notFound();
  const pictures = publication?.source.pictures ?? [];
  const photos = pictures.map(picture => fullSizeMercadoLibreImageUrl(picture.secure_url || picture.url))
    .filter((src): src is string => Boolean(src));
  if (!photos.length) photos.push(vehicle.image);
  const attributes = publicVehicleAttributes(
    publication?.source.attributes ?? [],
    `${vehicle.make} ${vehicle.model} ${vehicle.version}`,
  );

  const siteUrl = getSiteUrl();
  const vehicleUrl = new URL(`/vehiculos/${vehicle.slug}`, siteUrl).toString();
  const compareHref = `/vehiculos?comparar=${vehicle.slug}#inventario`;
  const vehicleContactHref = getWhatsAppUrl(`Hola, quiero consultar por el ${vehicle.make} ${vehicle.model}.`);
  const status = getVehicleStatusPresentation(vehicle);
  const isReserved = status.status === 'paused';
  const vehicleName = `${vehicle.make} ${vehicle.model}`;
  const bodyType = vehicle.body.split(' · ')[0];
  const formattedPrice = formatVehiclePrice(vehicle.price, vehicle.currency);

  let similarVehicles: Vehicle[] = [];
  let availableCount = 0;
  if (!status.isAvailable) {
    // The rail is a bonus: a catalog failure must not take down the page of a car that is not for sale.
    const catalog = await listCatalogVehicles().catch(() => []);
    similarVehicles = pickSimilarVehicles(vehicle, catalog);
    availableCount = catalog.length;
  }
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
  const contact = status.isAvailable ? {
    href: vehicleContactHref,
    label: 'Consultar ahora',
    eyebrow: 'Coordiná una visita',
    title: 'Conocelo en persona. El resto se entiende manejando.',
  } : isReserved ? {
    href: getWhatsAppUrl(`Hola, vi que el ${vehicleName} está reservado. Si se libera, avisame.`),
    label: 'Escribinos por WhatsApp',
    eyebrow: '¿Te interesaba este?',
    title: 'Escribinos. Si la reserva se cae, sos el primero en saberlo.',
  } : {
    href: getWhatsAppUrl(`Hola, vi que el ${vehicleName} ya se vendió. Estoy buscando algo parecido.`),
    label: 'Escribinos por WhatsApp',
    eyebrow: '¿Buscás algo parecido?',
    title: 'Contanos qué auto buscás. Te avisamos cuando entre.',
  };
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
        image: [new URL(vehicle.image, siteUrl).toString()],
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

  const detailSpecificationKeys: VehicleSpecificationKey[] = [
    'year', 'mileage', 'engine', 'transmission', 'fuel', 'traction', 'body', 'color',
  ];
  const specs = detailSpecificationKeys.map((key) => [
    vehicleSpecificationLabels[key],
    getVehicleSpecification(vehicle, key),
  ]);

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
          <li><Link href="/">Inicio</Link><span aria-hidden="true">/</span></li>
          <li><Link href="/vehiculos">Vehículos</Link><span aria-hidden="true">/</span></li>
          <li aria-current="page"><span>{`${vehicle.make} ${vehicle.model}`}</span></li>
        </ol>
      </nav>

      <section className="section-shell detail-title" aria-labelledby="vehicle-title">
        <div>
          <Eyebrow>{status.label} · {publication ? 'Mercado Libre' : 'Datos demostrativos'}</Eyebrow>
          <h1 id="vehicle-title">{`${vehicle.make} ${vehicle.model}`}{' '}<em>{vehicle.version}</em></h1>
        </div>
        <div className="detail-title-meta">
          <span>{vehicle.year}</span>
          <span>{formatVehicleMileage(vehicle.mileageKm)}</span>
          <span>{vehicle.transmission.split(',')[0]}</span>
        </div>
      </section>

      <section className="section-shell detail-showcase" data-status={status.status} aria-label="Presentación del vehículo">
        <VehiclePhotoViewer photos={photos} title={vehicle.imageAlt} stockCode={vehicle.stockCode} />
        {!status.isAvailable && (
          <p className="detail-status-banner" data-status={status.status}>
            <b>{status.label}</b>
            <span>{isReserved ? 'Ya tiene una reserva.' : 'Esta unidad ya tiene dueño.'}</span>
          </p>
        )}

        <aside className="detail-purchase-card glass-panel" aria-label={status.isAvailable ? 'Precio y consulta' : 'Estado de la publicación'}>
          <div className="detail-purchase-top">
            <div className="detail-availability" data-status={status.status}><span /> {status.label}</div>
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
              <p className="detail-location">{vehicle.location}</p>
              {!publication || alertDeliveryEnabled() ? (
                <PriceAlert
                  vehicleName={`${vehicle.make} ${vehicle.model} ${vehicle.version}`}
                  vehicleSlug={vehicle.slug}
                  formattedPrice={formattedPrice}
                />
              ) : null}
              <div className="detail-actions">
                <ButtonAnchor href={vehicleContactHref} rel="noreferrer" target="_blank">
                  Consultar por este auto <Arrow />
                </ButtonAnchor>
                <ButtonAnchor href="#ficha" variant="glass">Ver ficha técnica <ArrowDown aria-hidden="true" size={16} strokeWidth={1.8} /></ButtonAnchor>
              </div>
            </>
          ) : (
            <>
              <h2 className="detail-status-title">{isReserved ? 'Este auto está reservado.' : 'Este auto ya se vendió.'}</h2>
              <p className="detail-status-copy">
                {isReserved
                  ? 'Alguien lo reservó, pero a veces las reservas se caen: dejanos tu email y te avisamos si se libera.'
                  : 'Si buscás algo así, dejanos tu email y te avisamos cuando entre uno parecido.'}
                {similarVehicles.length > 0 && (isReserved
                  ? ' Mientras tanto, abajo tenés autos parecidos disponibles.'
                  : ' Abajo tenés autos parecidos que siguen en el garage.')}
              </p>
              <dl className="detail-last-price">
                <dt>{isReserved ? 'Precio publicado' : 'Último precio publicado'}</dt>
                <dd>{formattedPrice}</dd>
              </dl>
              <InventoryAlert
                activeFilterCount={2}
                criteria={alertCriteria}
                placement="vehicle"
                resultCount={similarVehicles.length}
                vehicleCopy={isReserved ? {
                  trigger: 'Avisame si se libera',
                  title: 'Avisame si se libera.',
                  description: `Si la reserva se cae o entra otro ${vehicleName}, te avisamos por email.`,
                } : {
                  trigger: 'Avisame si entra uno parecido',
                  title: 'Avisame si entra uno parecido.',
                  description: `Te avisamos por email cuando entre otro ${vehicle.make} ${bodyType.toLocaleLowerCase('es')}.`,
                }}
              />
              <div className="detail-actions">
                {similarVehicles.length > 0 ? (
                  <ButtonAnchor href="#similares">Ver autos similares <ArrowDown aria-hidden="true" size={16} strokeWidth={1.8} /></ButtonAnchor>
                ) : (
                  <ButtonLink href="/vehiculos">Ver todo el inventario <Arrow /></ButtonLink>
                )}
              </div>
            </>
          )}
          <p className="detail-disclaimer">
            {status.isAvailable ? 'Precio y disponibilidad sujetos a confirmación.'
              : isReserved ? 'Precio sujeto a confirmación.'
              : 'Datos de la última publicación, solo como referencia.'}
            {!publication && ' Esta página utiliza información de demostración.'}
          </p>
        </aside>
      </section>

      {similarVehicles.length > 0 && (
        <section className="section-shell detail-similar" id="similares" aria-labelledby="similar-title">
          <div className="detail-similar-heading">
            <div>
              <Eyebrow>Disponibles ahora</Eyebrow>
              <h2 id="similar-title">Parecidos, y todavía en el garage.</h2>
            </div>
            <Link className="text-link" href="/vehiculos">Ver inventario completo <Arrow /></Link>
          </div>
          <div className="detail-similar-grid">
            {similarVehicles.map((similar, index) => (
              <CatalogVehicleCard headingLevel="h3" index={index} key={similar.slug} vehicle={similar} />
            ))}
            {similarVehicles.length < 3 && (
              <Link className="detail-similar-more glass-panel" href="/vehiculos">
                <span>Inventario</span>
                <span className="catalog-card-arrow" aria-hidden="true"><ArrowUpRight size={17} strokeWidth={1.8} /></span>
                <strong>Ver todo el inventario</strong>
                <p>{String(availableCount).padStart(2, '0')} {availableCount === 1 ? 'auto disponible' : 'autos disponibles'} hoy. Filtrá por marca, carrocería, precio y kilometraje.</p>
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="section-shell detail-overview" id="ficha" aria-labelledby="overview-title">
        <div className="detail-story">
          <Eyebrow>La unidad</Eyebrow>
          <h2 id="overview-title">Elegido por cómo se siente. Revisado por todo lo demás.</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{vehicle.description || 'Esta publicación no incluye descripción.'}</p>
          {status.isAvailable && publication?.source.permalink && <a href={publication.source.permalink} target="_blank" rel="noreferrer">Ver publicación en Mercado Libre</a>}
          <ul className="detail-highlights" aria-label="Puntos destacados">
            {vehicle.highlights.map((highlight, index) => (
              <li key={highlight}><span>0{index + 1}</span>{highlight}</li>
            ))}
          </ul>
        </div>

        <div className="detail-specs glass-panel">
          <div className="detail-specs-heading">
            <p>Ficha técnica</p>
            <span>{vehicle.stockCode}</span>
          </div>
          {publication ? <VehicleSpecificationGroups attributes={attributes} /> : <dl>
            {specs.map(([label, value], index) => (
              <div key={`${label}-${index}`}><dt>{label}</dt><dd>{value || 'No especificado'}</dd></div>
            ))}
          </dl>}
        </div>
      </section>

      <VehiclePhotoViewer photos={photos} title={vehicle.imageAlt} layout="grid" />

      <section className="section-shell detail-confidence" aria-label="Proceso Gonba's Garage">
        <div><span>01</span><strong>Selección</strong><p>Elegimos unidades con identidad y una historia clara.</p></div>
        <div><span>02</span><strong>Revisión</strong><p>Chequeamos información, estado general y documentación.</p></div>
        <div><span>03</span><strong>Acompañamiento</strong><p>Coordinamos la visita y te acompañamos hasta la entrega.</p></div>
      </section>

      <ContactCallout
        actionHref={contact.href}
        actionLabel={contact.label}
        analytics={{ channel: 'whatsapp', placement: 'vehicle_detail', vehicleSlug: vehicle.slug }}
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
