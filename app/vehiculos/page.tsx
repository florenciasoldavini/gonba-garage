import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUp, ArrowUpRight } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { mockVehicles } from '@/features/vehicles/data/mock-vehicles';
import { InventoryCatalog } from './_components/inventory-catalog';

export const metadata: Metadata = {
  title: 'Vehículos disponibles | Gonba Garage',
  description: 'Explorá el inventario de autos usados seleccionados de Gonba Garage. Filtrá por marca, transmisión, tipo y precio.',
  alternates: { canonical: '/vehiculos' },
};

const Arrow = () => <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />;

type VehiclesPageProps = {
  searchParams: Promise<{ comparar?: string | string[] }>;
};

export default async function VehiclesPage({ searchParams }: VehiclesPageProps) {
  const params = await searchParams;
  const initialCompareSlug = typeof params.comparar === 'string' ? params.comparar : undefined;

  return (
    <main className="catalog-page" id="catalog-top">
      <header className="site-header detail-header">
        <Link className="wordmark" href="/" aria-label="Gonba Garage, inicio">
          GONBA <span>GARAGE</span>
        </Link>
        <nav className="main-nav" aria-label="Navegación principal">
          <Link className="nav-current" href="/vehiculos" aria-current="page">Vehículos</Link>
          <Link href="/vender">Vendé tu auto</Link>
          <Link href="/#servicios">Servicios</Link>
          <Link href="/#nosotros">Nosotros</Link>
          <Link href="/#preguntas">Preguntas</Link>
        </nav>
        <Link className="header-cta" href="/#contacto">Contactar <Arrow /></Link>
      </header>

      <section className="section-shell catalog-hero" aria-labelledby="catalog-title">
        <div>
          <Eyebrow>Inventario actual · Datos demostrativos</Eyebrow>
          <h1 id="catalog-title">Autos con una razón para estar acá.</h1>
        </div>
        <div className="catalog-hero-copy">
          <p>Una selección breve, revisada y presentada con claridad. Compará las unidades y encontrá la que mejor encaja con vos.</p>
          <span>{String(mockVehicles.length).padStart(2, '0')} unidades publicadas</span>
        </div>
      </section>

      <InventoryCatalog vehicles={mockVehicles} initialCompareSlug={initialCompareSlug} />

      <section className="section-shell catalog-contact glass-panel" aria-labelledby="catalog-contact-title">
        <div>
          <Eyebrow>¿No encontraste lo que buscabas?</Eyebrow>
          <h2 id="catalog-contact-title">Contanos qué auto tenés en mente.</h2>
        </div>
        <ButtonLink href="/#contacto">Hablar con Gonba Garage <Arrow /></ButtonLink>
      </section>

      <footer className="site-footer section-shell">
        <Link className="wordmark footer-wordmark" href="/">GONBA <span>GARAGE</span></Link>
        <p>Autos usados seleccionados · Buenos Aires, Argentina</p>
        <nav aria-label="Navegación del pie de página">
          <Link href="/vehiculos">Vehículos</Link>
          <Link href="/#servicios">Servicios</Link>
          <Link href="/#preguntas">FAQ</Link>
          <a href="#catalog-top">Volver arriba <ArrowUp aria-hidden="true" size={13} /></a>
        </nav>
        <small>Demo visual · Contenido e información comercial a confirmar</small>
      </footer>
    </main>
  );
}
