'use client';

import { ArrowUpRight, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';

export function ValuationSuccess({ onReset }: { onReset: () => void }) {
  return (
    <section className="valuation-success glass-panel" aria-live="polite">
      <span className="valuation-success-icon"><Check aria-hidden="true" size={24} strokeWidth={2} /></span>
      <Eyebrow>Solicitud preparada</Eyebrow>
      <h2>Ya tenemos una primera foto de tu auto.</h2>
      <p>En la versión final, Gonba&apos;s Garage recibirá estos datos para revisar la unidad y contactarte con una estimación preliminar.</p>
      <div className="valuation-success-next">
        <strong>¿Qué sigue?</strong>
        <ol>
          <li><span>01</span> Revisamos la información.</li>
          <li><span>02</span> Te contactamos para conocer más detalles.</li>
          <li><span>03</span> Coordinamos una inspección si la unidad encaja.</li>
        </ol>
      </div>
      <Button type="button" onClick={onReset}>
        Cargar otro vehículo <ArrowUpRight aria-hidden="true" size={16} />
      </Button>
      <small>Demostración: todavía no se enviaron datos.</small>
    </section>
  );
}
