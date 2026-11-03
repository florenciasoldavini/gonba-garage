'use client';

import { useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';

import { Button, ButtonAnchor } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { StatusSteps } from '@/components/ui/status';
import { useStatusMotion } from '@/components/motion/use-status-motion';

type ValuationSuccessProps = {
  whatsAppUrl: string;
  onReset: () => void;
};

export function ValuationSuccess({ whatsAppUrl, onReset }: ValuationSuccessProps) {
  const root = useRef<HTMLElement>(null);
  useStatusMotion(root);

  return (
    <section className="valuation-success status-panel glass-panel" aria-live="polite" ref={root}>
      <Eyebrow>Mensaje preparado</Eyebrow>
      <h2>Seguimos la charla por WhatsApp.</h2>
      <p>Abrimos WhatsApp con los datos de tu auto. Si todavía no lo enviaste, revisalo y tocá enviar.</p>
      <StatusSteps
        steps={[
          'Enviá el mensaje y sumá fotos del auto.',
          'Revisamos la información.',
          'Te respondemos con una estimación por el mismo chat.',
        ]}
      />
      <div className="status-actions">
        <ButtonAnchor href={whatsAppUrl} target="_blank" rel="noreferrer">
          Abrir WhatsApp de nuevo <ArrowUpRight aria-hidden="true" size={16} />
        </ButtonAnchor>
        <Button type="button" variant="ghost" onClick={onReset}>
          Cargar otro vehículo
        </Button>
      </div>
    </section>
  );
}
