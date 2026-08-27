import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUp, ArrowUpRight, Check, Clock3, ShieldCheck } from 'lucide-react';

import { Eyebrow } from '@/components/ui/eyebrow';
import { ValuationForm } from './_components/valuation-form';

export const metadata: Metadata = {
  title: 'Vendé tu auto | Gonba Garage',
  description: 'Compartí los datos de tu vehículo y solicitá una estimación de valor a Gonba Garage.',
  alternates: { canonical: '/vender' },
};

const Arrow = () => <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />;

export default function SellVehiclePage() {
  return (
    <main className="valuation-page" id="valuation-top">
      <header className="site-header detail-header">
        <Link className="wordmark" href="/" aria-label="Gonba Garage, inicio">GONBA <span>GARAGE</span></Link>
        <nav className="main-nav" aria-label="Navegación principal">
          <Link href="/vehiculos">Vehículos</Link>
          <Link className="nav-current" href="/vender" aria-current="page">Vendé tu auto</Link>
          <Link href="/#servicios">Servicios</Link>
          <Link href="/#nosotros">Nosotros</Link>
          <Link href="/#preguntas">Preguntas</Link>
        </nav>
        <Link className="header-cta" href="/vehiculos">Ver vehículos <Arrow /></Link>
      </header>

      <div className="section-shell valuation-breadcrumbs">
        <Link href="/"><ArrowLeft aria-hidden="true" size={14} /> Volver al inicio</Link>
      </div>

      <section className="section-shell valuation-layout" aria-labelledby="valuation-title">
        <aside className="valuation-intro">
          <Eyebrow>Tasación inicial</Eyebrow>
          <h1 id="valuation-title">Contanos qué auto tenés.</h1>
          <p className="valuation-lead">Con algunos datos podemos preparar una primera estimación y decirte si la unidad encaja con nuestra selección.</p>

          <div className="valuation-image glass-panel">
            <Image src="/garage-classic.jpg" alt="Auto clásico estacionado frente a un garage" fill sizes="(max-width: 900px) 100vw, 42vw" className="cover-image" />
            <span>Tu auto puede ser el próximo.</span>
          </div>

          <ul className="valuation-promises" aria-label="Información sobre la tasación">
            <li><Clock3 aria-hidden="true" size={17} /><span><strong>Respuesta estimada</strong> dentro de las próximas 24 horas hábiles.</span></li>
            <li><ShieldCheck aria-hidden="true" size={17} /><span><strong>Datos privados</strong> usados solamente para evaluar tu vehículo.</span></li>
            <li><Check aria-hidden="true" size={17} /><span><strong>Sin compromiso</strong> la estimación inicial no te obliga a vender.</span></li>
          </ul>
        </aside>

        <ValuationForm />
      </section>

      <footer className="site-footer section-shell">
        <Link className="wordmark footer-wordmark" href="/">GONBA <span>GARAGE</span></Link>
        <p>Autos usados seleccionados · Buenos Aires, Argentina</p>
        <nav aria-label="Navegación del pie de página">
          <Link href="/vehiculos">Vehículos</Link>
          <Link href="/#servicios">Servicios</Link>
          <Link href="/#preguntas">FAQ</Link>
          <a href="#valuation-top">Volver arriba <ArrowUp aria-hidden="true" size={13} /></a>
        </nav>
        <small>Demo visual · El envío de la solicitud se conectará en una próxima etapa</small>
      </footer>
    </main>
  );
}
