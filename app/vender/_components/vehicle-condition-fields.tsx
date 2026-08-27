'use client';

import { useState } from 'react';
import { Gauge, Upload } from 'lucide-react';

import { CustomSelect } from '@/components/ui/custom-select';
import { ValuationStepHeading } from './valuation-step-heading';

const conditionOptions = [
  { value: 'Excelente', label: 'Excelente' },
  { value: 'Muy bueno', label: 'Muy bueno' },
  { value: 'Bueno', label: 'Bueno' },
  { value: 'Necesita reparaciones', label: 'Necesita reparaciones' },
];

export function VehicleConditionFields({ hidden }: { hidden: boolean }) {
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
        <label><span>Kilometraje *</span><input name="mileage" required inputMode="numeric" type="number" min="0" placeholder="48000" /></label>
        <div className="valuation-select-field">
          <span>Estado general *</span>
          <CustomSelect name="condition" ariaLabel="Estado general" required value={condition} onChange={setCondition} options={conditionOptions} />
        </div>
        <label className="valuation-field-wide"><span>Comentarios sobre el estado</span><textarea name="notes" rows={4} placeholder="Service, detalles de pintura, cubiertas, equipamiento o cualquier información relevante." /></label>
        <label className="valuation-file-field valuation-field-wide">
          <Upload aria-hidden="true" size={20} />
          <span><strong>Agregar fotos del vehículo</strong><small>Exterior, interior y tablero · Opcional</small></span>
          <input name="photos" type="file" accept="image/*" multiple />
        </label>
      </div>
    </section>
  );
}
