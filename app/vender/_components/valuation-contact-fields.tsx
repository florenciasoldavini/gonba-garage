import { ClipboardCheck } from 'lucide-react';

import { ValuationStepHeading } from './valuation-step-heading';

export function ValuationContactFields({ hidden }: { hidden: boolean }) {
  return (
    <section className="valuation-form-section valuation-form-step" data-step="3" hidden={hidden}>
      <ValuationStepHeading
        description="Los usamos únicamente para contactarte y coordinar los próximos pasos."
        icon={ClipboardCheck}
        step={3}
        title="Tus datos"
      />
      <div className="valuation-fields">
        <label><span>Nombre y apellido *</span><input name="name" required autoComplete="name" placeholder="Tu nombre" /></label>
        <label><span>Teléfono *</span><input name="phone" required autoComplete="tel" type="tel" placeholder="11 0000 0000" /></label>
      </div>
    </section>
  );
}
