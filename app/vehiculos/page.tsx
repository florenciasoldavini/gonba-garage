import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ArrowUpRight } from 'lucide-react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { activeMockVehicles } from '@/features/vehicles/data/mock-vehicles';
import { createPageMetadata } from '@/lib/metadata';
import { InventoryCatalog } from './_components/inventory-catalog';
import { InventoryCatalogFromSearchParams } from './_components/inventory-catalog-from-search-params';

export const metadata: Metadata = createPageMetadata({
  title: "Vehículos disponibles | Gonba's Garage",
  description:
    "Explorá el inventario de autos usados seleccionados de Gonba's Garage. Filtrá por marca, transmisión, tipo y precio.",
  path: '/vehiculos',
});

const Arrow = () => <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />;

export default function VehiclesPage() {
  return (
    <main className="catalog-page" id="catalog-top">
      <SiteHeader active="vehicles" />

      <section className="section-shell catalog-hero" aria-labelledby="catalog-title">
        <div>
          <Eyebrow>Inventario actual · Datos demostrativos</Eyebrow>
          <h1 id="catalog-title">Autos con una razón para estar acá.</h1>
        </div>
        <div className="catalog-hero-copy">
          <p>Una selección breve, revisada y presentada con claridad. Compará las unidades y encontrá la que mejor encaja con vos.</p>
          <span>{String(activeMockVehicles.length).padStart(2, '0')} unidades publicadas</span>
        </div>
      </section>

      <Suspense fallback={<InventoryCatalog vehicles={activeMockVehicles} />}>
        <InventoryCatalogFromSearchParams vehicles={activeMockVehicles} />
      </Suspense>

      <section className="section-shell catalog-contact glass-panel" aria-labelledby="catalog-contact-title">
        <div>
          <Eyebrow>¿No encontraste lo que buscabas?</Eyebrow>
          <h2 id="catalog-contact-title">Contanos qué auto tenés en mente.</h2>
        </div>
        <ButtonLink href="/#contacto">Hablar con Gonba&apos;s Garage <Arrow /></ButtonLink>
      </section>

      <SiteFooter topHref="#catalog-top" />
    </main>
  );
}
