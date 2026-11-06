import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { InnerPageMotion } from '@/components/motion/inner-page-motion';
import { Eyebrow } from '@/components/ui/eyebrow';
import { alertEmailsConfigured } from '@/lib/alerts/config';
import { listCatalogVehicles } from '@/lib/integrations/mercado-libre/catalog';
import { createPageMetadata } from '@/lib/metadata';
import { getMepQuote } from '@/lib/integrations/mep-quote';
import { CatalogHeroCount, CatalogResultCountProvider } from './_components/catalog-result-count';
import { InventoryCatalog } from './_components/inventory-catalog';
import { InventoryCatalogFromSearchParams } from './_components/inventory-catalog-from-search-params';
import './page.css';

export const metadata: Metadata = createPageMetadata({
  title: "Vehículos disponibles | Gonba's Garage",
  description:
    "Explorá el inventario de autos usados seleccionados de Gonba's Garage. Filtrá por marca, transmisión, tipo y precio.",
  path: '/vehiculos',
  image: '/social/vehiculos.jpg',
  imageAlt: "Autos usados exhibidos en el showroom de Gonba's Garage",
});

export default async function VehiclesPage() {
  // Rendered per request, so a failed read is never stored as the page: it reaches error.tsx as a
  // 500. The vehicles come from the catalog cache, which the sync worker expires.
  await connection();
  const quotePromise = getMepQuote();
  const vehicles = await listCatalogVehicles();
  const quote = await quotePromise;
  const alertsEnabled = alertEmailsConfigured();
  return (
    <InnerPageMotion className="catalog-page" id="catalog-top" variant="catalog">
      <SiteHeader active="vehicles" />

      <main>
        <CatalogResultCountProvider>
          <section className="section-shell catalog-hero" aria-labelledby="catalog-title">
            <span className="catalog-scan-line" aria-hidden="true" />
            <div>
              <Eyebrow>Inventario actual</Eyebrow>
              <h1 id="catalog-title">Autos con una razón para estar acá.</h1>
            </div>
            <div className="catalog-hero-copy">
              <p>
                Una selección breve, revisada y presentada con claridad. Compará las unidades y encontrá la que mejor
                encaja con vos.
              </p>
              <CatalogHeroCount total={vehicles.length} />
            </div>
          </section>

          <Suspense fallback={<InventoryCatalog vehicles={vehicles} quote={quote} alertsEnabled={alertsEnabled} />}>
            <InventoryCatalogFromSearchParams vehicles={vehicles} quote={quote} alertsEnabled={alertsEnabled} />
          </Suspense>
        </CatalogResultCountProvider>
      </main>

      <SiteFooter topHref="#catalog-top" />
    </InnerPageMotion>
  );
}
