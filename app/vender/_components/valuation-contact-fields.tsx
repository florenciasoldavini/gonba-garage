import { Camera, UserRound } from 'lucide-react';

import type { ValuationDetail } from './valuation-message';
import { ValuationStepHeading } from './valuation-step-heading';

type ValuationContactFieldsProps = {
  hidden: boolean;
  details: ValuationDetail[];
};

export function ValuationContactFields({ hidden, details }: ValuationContactFieldsProps) {
  return (
    <section className="valuation-form-section valuation-form-step" data-step="3" hidden={hidden}>
      <ValuationStepHeading
        description="Revisá que esté todo bien antes de enviarlo."
        icon={UserRound}
        step={3}
        title="Tus datos"
      />
      <div className="valuation-fields">
        <label className="valuation-field-wide">
          <span>Nombre *</span>
          <input name="name" required autoComplete="name" placeholder="Tu nombre" />
        </label>
        <div className="valuation-summary valuation-field-wide">
          <span>Resumen</span>
          <dl>
            {details.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="valuation-photo-note valuation-field-wide">
          <Camera aria-hidden="true" size={16} strokeWidth={1.8} />
          <span>
            <strong>¿Tenés fotos del auto?</strong> Mandalas en el mismo chat, después de enviar el mensaje.
          </span>
        </p>
      </div>
    </section>
  );
}
