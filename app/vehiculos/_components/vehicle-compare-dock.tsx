'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Scale, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

type VehicleCompareDockProps = {
  maximum: number;
  onClear: () => void;
  onCompare: () => void;
  onRemove: (slug: string) => void;
  vehicles: Vehicle[];
};

export function VehicleCompareDock({ maximum, onClear, onCompare, onRemove, vehicles }: VehicleCompareDockProps) {
  const root = useRef<HTMLDivElement>(null);
  const vehicleKey = vehicles.map(({ slug }) => slug).join('|');

  useGSAP(
    () => {
      const shell = root.current;
      if (!shell) return;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(shell, { autoAlpha: vehicles.length > 0 ? 1 : 0, y: 0 });
        return;
      }

      gsap.to(shell, {
        y: vehicles.length > 0 ? 0 : 34,
        autoAlpha: vehicles.length > 0 ? 1 : 0,
        duration: vehicles.length > 0 ? 0.5 : 0.32,
        ease: vehicles.length > 0 ? 'power3.out' : 'power2.inOut',
        overwrite: 'auto',
      });

      if (vehicles.length > 0) {
        gsap.fromTo(
          '.compare-dock-thumb',
          { scale: 0.78, x: 14, autoAlpha: 0 },
          { scale: 1, x: 0, autoAlpha: 1, stagger: 0.055, duration: 0.42, ease: 'back.out(1.5)' },
        );
        gsap.fromTo(
          '.compare-dock-heading > span',
          { scale: 0.75 },
          { scale: 1, duration: 0.42, ease: 'back.out(1.7)' },
        );
      }
    },
    { scope: root, dependencies: [vehicleKey], revertOnUpdate: false },
  );

  return (
    <div
      className="compare-dock-shell"
      aria-hidden={vehicles.length === 0}
      aria-live="polite"
      data-visible={vehicles.length > 0}
      ref={root}
    >
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
