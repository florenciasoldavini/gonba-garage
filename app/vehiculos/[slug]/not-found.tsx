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

const Arrow = () => <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />;

/** The empty bay, seen from above and numbered 404. On mobile the section itself draws the bay lines. */
function EmptyBay() {
  return (
    <>
      <svg className="missing-vehicle-bay-desktop" viewBox="0 0 600 700" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
        <path d="M-400 1H1000" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" />
        <path d="M160 0V700M440 0V700" stroke="rgba(255,255,255,.5)" strokeWidth="1.2" />
        <rect x="245" y="30" width="110" height="13" rx="3" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="1.2" />
        <BayLabel x={300} y={80} />
        <text className="missing-vehicle-bay-number" x="300" y="330" textAnchor="middle">404</text>
      </svg>
      <svg className="missing-vehicle-bay-mobile" viewBox="0 0 320 170" aria-hidden="true">
        <rect x="105" y="20" width="110" height="12" rx="3" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="1.2" />
        <BayLabel x={160} y={64} />
        <text className="missing-vehicle-bay-number" x="160" y="156" textAnchor="middle">404</text>
      </svg>
    </>
  );
}

function BayLabel({ x, y }: { x: number; y: number }) {
  return (
    <text className="missing-vehicle-bay-label" x={x} y={y} textAnchor="middle">
      <tspan>Puesto 404 · </tspan><tspan className="missing-vehicle-bay-free">Libre</tspan>
    </text>
  );
}

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
        <div className="missing-vehicle-bay"><EmptyBay /></div>
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
