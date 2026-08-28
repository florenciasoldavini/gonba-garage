'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState, type CSSProperties } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowUpRight, Check, Scale, X } from 'lucide-react';

import { useDialogMotion } from '@/components/motion/use-dialog-motion';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import {
  getVehicleSpecification,
  vehicleSpecificationLabels,
  type VehicleSpecificationKey,
} from '@/features/vehicles/presentation/specifications';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

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
  const [differencesOnly, setDifferencesOnly] = useState(true);
  const vehicleKey = vehicles.map(({ slug }) => slug).join('|');
  const { closeDialog, closeDialogAfter, dialogRef } = useDialogMotion({
    isOpen,
    itemSelector: '.vehicle-compare-modal-header, .vehicle-compare-controls, .vehicle-compare-card, .vehicle-compare-row',
    panelSelector: '.vehicle-compare-modal',
    variant: 'compare',
  });

  const rows = useMemo(() => {
    const allRows = comparisonKeys.map((key) => [
      vehicleSpecificationLabels[key],
      ...vehicles.map((vehicle) => getVehicleSpecification(vehicle, key)),
    ]);

    return differencesOnly
      ? allRows.filter(([, ...values]) => new Set(values).size > 1)
      : allRows;
  }, [differencesOnly, vehicles]);

  const removeVehicle = (slug: string) => {
    if (vehicles.length <= 2) {
      closeDialogAfter(() => onRemove(slug));
      return;
    }

    onRemove(slug);
  };

  useGSAP(
    () => {
      if (!dialogRef.current?.open || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const cards = gsap.utils.toArray<HTMLElement>('.vehicle-compare-card');
      const rowElements = gsap.utils.toArray<HTMLElement>('.vehicle-compare-row');

      if (cards.length > 0) {
        gsap.fromTo(
          cards,
          { x: 24, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, stagger: 0.06, duration: 0.45, ease: 'power3.out' },
        );
      }
      if (rowElements.length > 0) {
        gsap.fromTo(
          rowElements,
          { y: 12, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, stagger: 0.025, duration: 0.32, ease: 'power2.out' },
        );
      }
    },
    { scope: dialogRef, dependencies: [differencesOnly, vehicleKey], revertOnUpdate: true },
  );

  return (
    <dialog
      className="vehicle-compare-dialog"
      ref={dialogRef}
      onCancel={(event) => { event.preventDefault(); closeDialog(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
      onClose={onClose}
    >
      <div className="vehicle-compare-modal">
        <header className="vehicle-compare-modal-header">
          <div className="vehicle-compare-modal-title">
            <span><Scale aria-hidden="true" size={17} strokeWidth={1.8} /></span>
            <div>
              <h2>Comparar vehículos</h2>
              <p>{vehicles.length} unidades seleccionadas · Inventario actual</p>
            </div>
          </div>
          <button className="vehicle-compare-close" type="button" aria-label="Cerrar comparación" onClick={closeDialog}><X aria-hidden="true" size={18} /></button>
        </header>

        <div className="vehicle-compare-controls">
          <label>
            <input type="checkbox" checked={differencesOnly} onChange={(event) => setDifferencesOnly(event.target.checked)} />
            <span><Check aria-hidden="true" size={12} /></span>
            Mostrar solo diferencias
          </label>
          <button type="button" onClick={() => closeDialogAfter(onClear)}>Limpiar selección</button>
        </div>

        <div className="vehicle-compare-scroll">
          <div className="vehicle-compare-content" style={{ '--compare-count': vehicles.length } as CSSProperties}>
            <div className="vehicle-compare-cards">
              <div className="vehicle-compare-corner" aria-hidden="true" />
              {vehicles.map((vehicle) => (
                <article className="vehicle-compare-card" key={vehicle.slug}>
                  <div className="vehicle-compare-card-image">
                    <Image src={vehicle.image} alt={vehicle.imageAlt} fill sizes="260px" className="cover-image" />
                    <button type="button" aria-label={`Quitar ${vehicle.make} ${vehicle.model}`} onClick={() => removeVehicle(vehicle.slug)}><X aria-hidden="true" size={12} /></button>
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
