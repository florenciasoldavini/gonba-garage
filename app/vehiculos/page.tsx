import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { InnerPageMotion } from '@/components/motion/inner-page-motion';
import { Eyebrow } from '@/components/ui/eyebrow';
import { isLiveCatalog, listCatalogVehicles } from '@/lib/integrations/mercado-libre/catalog';
import { createPageMetadata } from '@/lib/metadata';
import { getMepQuote } from '@/lib/integrations/mep-quote';
import { InventoryCatalog } from './_components/inventory-catalog';
import { InventoryCatalogFromSearchParams } from './_components/inventory-catalog-from-search-params';

export const metadata: Metadata = { ...createPageMetadata({
  title: "Vehículos disponibles | Gonba's Garage",
  description:
    "Explorá el inventario de autos usados seleccionados de Gonba's Garage. Filtrá por marca, transmisión, tipo y precio.",
  path: '/vehiculos',
}), ...(isLiveCatalog() ? { robots: { index: false, follow: false } } : {}) };

export default async function VehiclesPage() {
  // Keep Next.js request-time rendering outside the API failure handler.
  if (isLiveCatalog()) await connection();
  let vehicles;
  const quotePromise = getMepQuote();
  try {
    vehicles = await listCatalogVehicles();
  } catch {
    return <main className="section-shell"><SiteHeader active="vehicles" /><h1>Catálogo no disponible</h1><p>No pudimos consultar las publicaciones. Revisá la conexión del backend y volvé a intentar.</p></main>;
  }
  const quote = await quotePromise;
  return (
    <InnerPageMotion className="catalog-page" id="catalog-top" variant="catalog">
      <SiteHeader active="vehicles" />

      <section className="section-shell catalog-hero" aria-labelledby="catalog-title">
        <span className="catalog-scan-line" aria-hidden="true" />
        <div>
          <Eyebrow>Inventario actual · {isLiveCatalog() ? 'Mercado Libre' : 'Datos demostrativos'}</Eyebrow>
          <h1 id="catalog-title">Autos con una razón para estar acá.</h1>
        </div>
        <div className="catalog-hero-copy">
          <p>Una selección breve, revisada y presentada con claridad. Compará las unidades y encontrá la que mejor encaja con vos.</p>
          <span>{String(vehicles.length).padStart(2, '0')} unidades publicadas</span>
        </div>
      </section>

      <Suspense fallback={<InventoryCatalog vehicles={vehicles} quote={quote} />}>
        <InventoryCatalogFromSearchParams vehicles={vehicles} quote={quote} />
      </Suspense>

      <SiteFooter topHref="#catalog-top" />
    </InnerPageMotion>
  );
}
