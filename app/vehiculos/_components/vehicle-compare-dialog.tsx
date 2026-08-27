'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRight, Check, Scale, X } from 'lucide-react';

import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import {
  getVehicleSpecification,
  vehicleSpecificationLabels,
  type VehicleSpecificationKey,
} from '@/features/vehicles/presentation/specifications';

type VehicleCompareDialogProps = {
  vehicles: Vehicle[];
  isOpen: boolean;
  onClose: () => void;
  onRemove: (slug: string) => void;
  onClear: () => void;
};

const comparisonKeys: VehicleSpecificationKey[] = [
  'price', 'year', 'mileage', 'transmission', 'engine', 'fuel', 'traction', 'body', 'color', 'location',
];

export function VehicleCompareDialog({ vehicles, isOpen, onClose, onRemove, onClear }: VehicleCompareDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [differencesOnly, setDifferencesOnly] = useState(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const rows = useMemo(() => {
    const allRows = comparisonKeys.map((key) => [
      vehicleSpecificationLabels[key],
      ...vehicles.map((vehicle) => getVehicleSpecification(vehicle, key)),
    ]);

    return differencesOnly
      ? allRows.filter(([, ...values]) => new Set(values).size > 1)
      : allRows;
  }, [differencesOnly, vehicles]);

  return (
    <dialog className="vehicle-compare-dialog" ref={dialogRef} onClose={onClose}>
      <div className="vehicle-compare-modal">
        <header className="vehicle-compare-modal-header">
          <div className="vehicle-compare-modal-title">
            <span><Scale aria-hidden="true" size={17} strokeWidth={1.8} /></span>
            <div>
              <h2>Comparar vehículos</h2>
              <p>{vehicles.length} unidades seleccionadas · Inventario actual</p>
            </div>
          </div>
          <button className="vehicle-compare-close" type="button" aria-label="Cerrar comparación" onClick={onClose}><X aria-hidden="true" size={18} /></button>
        </header>

        <div className="vehicle-compare-controls">
          <label>
            <input type="checkbox" checked={differencesOnly} onChange={(event) => setDifferencesOnly(event.target.checked)} />
            <span><Check aria-hidden="true" size={12} /></span>
            Mostrar solo diferencias
          </label>
          <button type="button" onClick={onClear}>Limpiar selección</button>
        </div>

        <div className="vehicle-compare-scroll">
          <div className="vehicle-compare-content" style={{ '--compare-count': vehicles.length } as CSSProperties}>
            <div className="vehicle-compare-cards">
              <div className="vehicle-compare-corner" aria-hidden="true" />
              {vehicles.map((vehicle) => (
                <article className="vehicle-compare-card" key={vehicle.slug}>
                  <div className="vehicle-compare-card-image">
                    <Image src={vehicle.image} alt={vehicle.imageAlt} fill sizes="260px" className="cover-image" />
                    <button type="button" aria-label={`Quitar ${vehicle.make} ${vehicle.model}`} onClick={() => onRemove(vehicle.slug)}><X aria-hidden="true" size={12} /></button>
                  </div>
                  <p>{vehicle.year} · {vehicle.version}</p>
                  <h3>{vehicle.make} {vehicle.model}</h3>
                  <Link href={`/vehiculos/${vehicle.slug}`}>Ver vehículo <ArrowUpRight aria-hidden="true" size={14} /></Link>
                </article>
              ))}
            </div>

            <div className="vehicle-compare-table" role="table" aria-label="Especificaciones comparadas">
              {rows.map(([label, ...values]) => (
                <div className="vehicle-compare-row" role="row" key={label}>
                  <div role="rowheader">{label}</div>
                  {values.map((value, index) => <div role="cell" key={`${label}-${vehicles[index]?.slug}`}>{value}</div>)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
