'use client';

import Image from 'next/image';
import { Scale, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';

type VehicleCompareDockProps = {
  maximum: number;
  onClear: () => void;
  onCompare: () => void;
  onRemove: (slug: string) => void;
  vehicles: Vehicle[];
};

export function VehicleCompareDock({ maximum, onClear, onCompare, onRemove, vehicles }: VehicleCompareDockProps) {
  if (vehicles.length === 0) return null;

  return (
    <div className="compare-dock-shell" aria-live="polite">
      <div className="compare-dock glass-panel">
        <div className="compare-dock-heading">
          <span><Scale aria-hidden="true" size={17} strokeWidth={1.8} /></span>
          <div><strong>Comparar vehículos</strong><small>{vehicles.length} de {maximum} seleccionados</small></div>
        </div>
        <div className="compare-dock-slots">
          {vehicles.map((vehicle) => (
            <div className="compare-dock-thumb" key={vehicle.slug}>
              <Image src={vehicle.image} alt="" fill sizes="76px" className="cover-image" />
              <button type="button" aria-label={`Quitar ${vehicle.make} ${vehicle.model}`} onClick={() => onRemove(vehicle.slug)}>
                <X aria-hidden="true" size={11} />
              </button>
            </div>
          ))}
          {Array.from({ length: maximum - vehicles.length }, (_, index) => (
            <div className="compare-dock-empty" aria-hidden="true" key={index}>+</div>
          ))}
        </div>
        <div className="compare-dock-actions">
          <button className="compare-dock-clear" type="button" onClick={onClear}>Limpiar</button>
          <Button type="button" disabled={vehicles.length < 2} onClick={onCompare}>
            Comparar {vehicles.length > 1 ? vehicles.length : ''} <Scale aria-hidden="true" size={15} strokeWidth={1.8} />
          </Button>
        </div>
      </div>
    </div>
  );
}
