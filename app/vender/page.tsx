import type { Metadata } from 'next';
import Image from 'next/image';
import { Check, Clock3, ShieldCheck } from 'lucide-react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { Eyebrow } from '@/components/ui/eyebrow';
import { ValuationForm } from './_components/valuation-form';

export const metadata: Metadata = {
  title: "Vendé tu auto | Gonba's Garage",
  description: "Compartí los datos de tu vehículo y solicitá una estimación de valor a Gonba's Garage.",
  alternates: { canonical: '/vender' },
};

export default function SellVehiclePage() {
  return (
    <main className="valuation-page" id="valuation-top">
      <SiteHeader active="sell" ctaHref="/vehiculos" ctaLabel="Ver vehículos" />

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

      <SiteFooter
        topHref="#valuation-top"
        note="Demo visual · El envío de la solicitud se conectará en una próxima etapa"
      />
    </main>
  );
}
