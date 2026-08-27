import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowDown, ArrowUpRight, Scale } from 'lucide-react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ContactCallout } from '@/components/marketing/contact-callout';
import { ButtonAnchor } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { findMockVehicle, mockVehicles } from '@/features/vehicles/data/mock-vehicles';
import { formatVehicleMileage, formatVehiclePrice } from '@/features/vehicles/presentation/formatters';
import { getVehicleSpecification, vehicleSpecificationLabels, type VehicleSpecificationKey } from '@/features/vehicles/presentation/specifications';
import { getSiteUrl } from '@/lib/site-url';
import { PriceAlert } from './_components/price-alert';
import { ShareButton } from './_components/share-button';
import { VehicleAnalytics } from './_components/vehicle-analytics';

type VehicleDetailPageProps = {
  params: Promise<{ slug: string }>;
};

const Arrow = () => <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />;

export function generateStaticParams() {
  return mockVehicles.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: VehicleDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = findMockVehicle(slug);

  if (!vehicle) {
    return { title: 'Vehículo no encontrado | Gonba Garage' };
  }

  const title = `${vehicle.make} ${vehicle.model} ${vehicle.year} | Gonba Garage`;
  const description = `${vehicle.make} ${vehicle.model} ${vehicle.version}, ${vehicle.year}, ${formatVehicleMileage(vehicle.mileageKm)}. Consultá disponibilidad en Gonba Garage.`;

  return {
    title,
    description,
    alternates: { canonical: `/vehiculos/${vehicle.slug}` },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'es_AR',
      images: [{ url: vehicle.image, alt: vehicle.imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [vehicle.image],
    },
  };
}

export default async function VehicleDetailPage({ params }: VehicleDetailPageProps) {
  const { slug } = await params;
  const vehicle = findMockVehicle(slug);

  if (!vehicle) notFound();

  const siteUrl = getSiteUrl();
  const vehicleUrl = new URL(`/vehiculos/${vehicle.slug}`, siteUrl).toString();
  const compareHref = `/vehiculos?comparar=${vehicle.slug}#inventario`;
  const vehicleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: `${vehicle.make} ${vehicle.model} ${vehicle.version}`,
    image: [new URL(vehicle.image, siteUrl).toString()],
    description: vehicle.description,
    url: vehicleUrl,
    sku: vehicle.stockCode,
    brand: { '@type': 'Brand', name: vehicle.make },
    model: vehicle.model,
    vehicleModelDate: String(vehicle.year),
    mileageFromOdometer: {
      '@type': 'QuantitativeValue',
      value: vehicle.mileageKm,
      unitCode: 'KMT',
    },
    offers: {
      '@type': 'Offer',
      price: vehicle.price,
      priceCurrency: vehicle.currency,
      availability: 'https://schema.org/InStock',
      url: vehicleUrl,
    },
  };

  const detailSpecificationKeys: VehicleSpecificationKey[] = [
    'year', 'mileage', 'engine', 'transmission', 'fuel', 'traction', 'body', 'color',
  ];
  const specs = detailSpecificationKeys.map((key) => [
    vehicleSpecificationLabels[key],
    getVehicleSpecification(vehicle, key),
  ]);

  return (
    <main className="vehicle-detail-page">
      <VehicleAnalytics
        bodyType={vehicle.body.split(' · ')[0]}
        currency={vehicle.currency}
        make={vehicle.make}
        model={vehicle.model}
        price={vehicle.price}
        vehicleSlug={vehicle.slug}
        year={vehicle.year}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleSchema) }}
      />

      <SiteHeader ctaHref="#consulta" ctaLabel="Consultar" />

      <div className="section-shell detail-breadcrumbs" aria-label="Ruta de navegación">
        <Link href="/">Inicio</Link><span>/</span>
        <Link href="/vehiculos">Vehículos</Link><span>/</span>
        <span>{vehicle.make} {vehicle.model}</span>
      </div>

      <section className="section-shell detail-title" aria-labelledby="vehicle-title">
        <div>
          <Eyebrow>Disponible · Datos demostrativos</Eyebrow>
          <h1 id="vehicle-title">{vehicle.make} {vehicle.model}<em>{vehicle.version}</em></h1>
        </div>
        <div className="detail-title-meta">
          <span>{vehicle.year}</span>
          <span>{formatVehicleMileage(vehicle.mileageKm)}</span>
          <span>{vehicle.transmission.split(',')[0]}</span>
        </div>
      </section>

      <section className="section-shell detail-showcase" aria-label="Presentación del vehículo">
        <div className="detail-primary-image">
          <Image
            src={vehicle.image}
            alt={vehicle.imageAlt}
            fill
            loading="eager"
            sizes="(max-width: 980px) 100vw, 72vw"
            className="cover-image"
          />
          <span className="detail-image-count">01 / 03</span>
          <span className="detail-stock">Stock {vehicle.stockCode}</span>
        </div>

        <aside className="detail-purchase-card glass-panel" aria-label="Precio y consulta">
          <div className="detail-purchase-top">
            <div className="detail-availability"><span /> Disponible</div>
            <div className="detail-utility-actions">
              <Link className="detail-compare-button" href={compareHref}>
                <Scale aria-hidden="true" size={14} strokeWidth={1.8} />
                <span>Comparar</span>
              </Link>
              <ShareButton
                title={`${vehicle.make} ${vehicle.model} ${vehicle.version}`}
                text={`Mirá este ${vehicle.make} ${vehicle.model} ${vehicle.version} publicado por Gonba Garage.`}
                fallbackUrl={vehicleUrl}
                vehicleSlug={vehicle.slug}
              />
            </div>
          </div>
          <p className="detail-price-label">Precio publicado</p>
          <p className="detail-price">{formatVehiclePrice(vehicle.price, vehicle.currency)}</p>
          <p className="detail-location">{vehicle.location}</p>
          <PriceAlert
            vehicleName={`${vehicle.make} ${vehicle.model} ${vehicle.version}`}
            vehicleSlug={vehicle.slug}
            formattedPrice={formatVehiclePrice(vehicle.price, vehicle.currency)}
          />
          <div className="detail-actions">
            <ButtonAnchor href="#consulta">Consultar por este auto <Arrow /></ButtonAnchor>
            <ButtonAnchor href="#ficha" variant="glass">Ver ficha técnica <ArrowDown aria-hidden="true" size={16} strokeWidth={1.8} /></ButtonAnchor>
          </div>
          <p className="detail-disclaimer">Precio y disponibilidad sujetos a confirmación. Esta página utiliza información de demostración.</p>
        </aside>
      </section>

      <section className="section-shell detail-overview" id="ficha" aria-labelledby="overview-title">
        <div className="detail-story">
          <Eyebrow>La unidad</Eyebrow>
          <h2 id="overview-title">Elegido por cómo se siente. Revisado por todo lo demás.</h2>
          <p>{vehicle.description}</p>
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
          <dl>
            {specs.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section-shell detail-gallery" aria-label="Galería del vehículo">
        <div className="detail-gallery-image detail-gallery-wide">
          <Image src={vehicle.image} alt={`Vista lateral de ${vehicle.make} ${vehicle.model}`} fill sizes="(max-width: 760px) 100vw, 66vw" className="cover-image detail-crop-left" />
        </div>
        <div className="detail-gallery-image">
          <Image src={vehicle.image} alt={`Detalle de ${vehicle.make} ${vehicle.model}`} fill sizes="(max-width: 760px) 100vw, 34vw" className="cover-image detail-crop-right" />
        </div>
      </section>

      <section className="section-shell detail-confidence" aria-label="Proceso Gonba Garage">
        <div><span>01</span><strong>Selección</strong><p>Elegimos unidades con identidad y una historia clara.</p></div>
        <div><span>02</span><strong>Revisión</strong><p>Chequeamos información, estado general y documentación.</p></div>
        <div><span>03</span><strong>Acompañamiento</strong><p>Coordinamos la visita y te acompañamos hasta la entrega.</p></div>
      </section>

      <ContactCallout
        actionHref={`mailto:ventas@gonbagarage.com.ar?subject=Consulta ${vehicle.make} ${vehicle.model}`}
        actionLabel="Consultar ahora"
        analytics={{ channel: 'email', placement: 'vehicle_detail', vehicleSlug: vehicle.slug }}
        className="detail-contact"
        eyebrow="Coordiná una visita"
        id="consulta"
        note="Contacto provisional para esta demostración."
        title="Conocelo en persona. El resto se entiende manejando."
        titleId="contact-title"
      />

      <SiteFooter topHref="#vehicle-title" />
    </main>
  );
}
