'use client';

import { useState } from 'react';
import { Gauge } from 'lucide-react';

import { CustomSelect } from '@/components/ui/custom-select';
import { ValuationFieldError } from './valuation-field-error';
import { ValuationStepHeading } from './valuation-step-heading';
import { fieldErrorProps, type ValuationErrors } from './valuation-validation';

const conditionOptions = [
  { value: 'Excelente', label: 'Excelente' },
  { value: 'Muy bueno', label: 'Muy bueno' },
  { value: 'Bueno', label: 'Bueno' },
  { value: 'Necesita reparaciones', label: 'Necesita reparaciones' },
];

export function VehicleConditionFields({ hidden, errors }: { hidden: boolean; errors: ValuationErrors }) {
  const [condition, setCondition] = useState('');

  return (
    <section className="valuation-form-section valuation-form-step" data-step="2" hidden={hidden}>
      <ValuationStepHeading
        description="Una descripción honesta permite preparar una estimación más realista."
        icon={Gauge}
        step={2}
        title="Estado y configuración"
      />
      <div className="valuation-fields">
        <label>
          <span>Kilometraje *</span>
          <input
            name="mileage"
            required
            inputMode="numeric"
            type="number"
            min="0"
            placeholder="48000"
            {...fieldErrorProps('mileage', errors.mileage)}
          />
          <ValuationFieldError field="mileage" message={errors.mileage} />
        </label>
        <div className="valuation-select-field">
          <span>Estado general *</span>
          <CustomSelect
            name="condition"
            ariaLabel="Estado general"
            value={condition}
            onChange={setCondition}
            options={conditionOptions}
            {...fieldErrorProps('condition', errors.condition)}
          />
          <ValuationFieldError field="condition" message={errors.condition} />
        </div>
        <label className="valuation-field-wide">
          <span>Comentarios sobre el estado</span>
          <textarea
            name="notes"
            rows={4}
            placeholder="Service, detalles de pintura, cubiertas, equipamiento o cualquier información relevante."
          />
        </label>
      </div>
    </section>
  );
}
