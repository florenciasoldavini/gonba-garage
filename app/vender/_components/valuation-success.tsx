'use client';

import { useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';

import { useStatusMotion } from '@/components/motion/use-status-motion';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { StatusSteps } from '@/components/ui/status';

export function ValuationSuccess({ onReset }: { onReset: () => void }) {
  const root = useRef<HTMLElement>(null);
  useStatusMotion(root);

  return (
    <section className="valuation-success status-panel glass-panel" aria-live="polite" ref={root}>
      <Eyebrow>Solicitud preparada</Eyebrow>
      <h2>Ya tenemos una primera foto de tu auto.</h2>
      <p>En la versión final, Gonba&apos;s Garage recibirá estos datos para revisar la unidad y contactarte con una estimación preliminar.</p>
      <StatusSteps
        steps={[
          'Revisamos la información.',
          'Te contactamos para conocer más detalles.',
          'Coordinamos una inspección si la unidad encaja.',
        ]}
      />
      <div className="status-actions">
        <Button type="button" onClick={onReset}>
          Cargar otro vehículo <ArrowUpRight aria-hidden="true" size={16} />
        </Button>
      </div>
      <small>Demostración: todavía no se enviaron datos.</small>
    </section>
  );
}
