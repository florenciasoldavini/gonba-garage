import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ButtonAnchor, ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { VehicleGrid } from '@/components/vehicles/vehicle-grid';
import { WHATSAPP_GENERAL_MESSAGE } from '@/constants/contact';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { getWhatsAppUrl } from '@/lib/contact';
import { listCatalogVehicles } from '@/lib/integrations/mercado-libre/catalog';
import { EmptyBayDesktop, EmptyBayMobile } from '../_components/empty-bay';

const Arrow = () => <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />;

/**
 * Rendered by notFound() when no publication matches the slug. Next.js keeps the 404 status and
 * adds noindex. Backend failures never reach this page; they show the catalog-unavailable message.
 */
export default async function MissingVehicle() {
  let vehicles: Vehicle[] = [];
  try {
    vehicles = (await listCatalogVehicles()).filter(({ status }) => status === 'active').slice(0, 3);
  } catch {
    // Without inventory the page still explains the 404; it just skips the suggestions.
  }

  return (
    <main className="missing-vehicle-page" id="missing-vehicle-top">
      <SiteHeader active="vehicles" />

      <div className="section-shell detail-breadcrumbs" aria-label="Ruta de navegación">
        <Link href="/">Inicio</Link><span>/</span>
        <Link href="/vehiculos">Vehículos</Link><span>/</span>
        <span>No encontrado</span>
      </div>

      <section className="section-shell missing-vehicle" aria-labelledby="missing-vehicle-title">
        <EmptyBayMobile />
        <div className="missing-vehicle-copy">
          <Eyebrow>Error 404 · Vehículo no encontrado</Eyebrow>
          <h1 id="missing-vehicle-title">No encontramos este auto.</h1>
          <p>
            El enlace puede estar incompleto o la publicación ya no existe.
            {vehicles.length > 0 && ' Más abajo tenés los autos disponibles ahora.'}
          </p>
          <div className="status-actions">
            <ButtonLink href="/vehiculos">Ver vehículos disponibles <Arrow /></ButtonLink>
            <ButtonAnchor href={getWhatsAppUrl(WHATSAPP_GENERAL_MESSAGE)} target="_blank" rel="noopener noreferrer" variant="glass">
              Escribinos por WhatsApp <Arrow />
            </ButtonAnchor>
          </div>
        </div>
        <div className="missing-vehicle-scene"><EmptyBayDesktop /></div>
      </section>

      {vehicles.length > 0 && (
        <section className="section-shell inventory-section" aria-labelledby="missing-vehicle-available">
          <div className="section-heading">
            <div>
              <Eyebrow>Disponibles ahora</Eyebrow>
              <h2 id="missing-vehicle-available">Otras razones para estar acá.</h2>
            </div>
            <div className="section-heading-copy">
              <Link className="text-link" href="/vehiculos">Ver inventario completo <Arrow /></Link>
            </div>
          </div>
          <VehicleGrid vehicles={vehicles} />
        </section>
      )}

      <SiteFooter topHref="#missing-vehicle-top" />
    </main>
  );
}
