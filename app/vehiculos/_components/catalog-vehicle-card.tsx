'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowUpRight, Check, Scale } from 'lucide-react';

import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { formatVehicleMileage, formatVehiclePrice } from '@/features/vehicles/presentation/formatters';
import { getVehicleStatusPresentation } from '@/features/vehicles/presentation/status';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

type CatalogVehicleCardProps = {
  compareDisabled: boolean;
  index: number;
  isSelected: boolean;
  onToggleComparison: (vehicle: Vehicle) => void;
  vehicle: Vehicle;
};

export function CatalogVehicleCard({
  compareDisabled,
  index,
  isSelected,
  onToggleComparison,
  vehicle,
}: CatalogVehicleCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const vehicleName = `${vehicle.make} ${vehicle.model}`;
  const href = `/vehiculos/${vehicle.slug}`;
  const status = getVehicleStatusPresentation(vehicle.status);

  useGSAP(
    () => {
      if (!isSelected || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const icon = cardRef.current?.querySelector('.catalog-card-compare svg');
      if (!icon) return;

      gsap.fromTo(
        icon,
        { scale: 0.35, rotation: -80 },
        { scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(1.8)' },
      );
    },
    { scope: cardRef, dependencies: [isSelected], revertOnUpdate: true },
  );

  return (
    <article className={`catalog-card glass-panel${isSelected ? ' catalog-card-selected' : ''}`} ref={cardRef}>
      <div className="catalog-card-image">
        <Link className="catalog-card-image-link" href={href} aria-label={`Ver ${vehicleName}`}>
          <Image
            src={vehicle.image}
            alt={vehicle.imageAlt}
            fill
            sizes="(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 38vw"
            className="cover-image"
          />
        </Link>
        <span className="catalog-card-index">{String(index + 1).padStart(2, '0')}</span>
        <span className="catalog-card-status">{status.label}</span>
        <button
          className="catalog-card-compare"
          type="button"
          aria-pressed={isSelected}
          disabled={compareDisabled}
          onClick={() => onToggleComparison(vehicle)}
        >
          {isSelected ? <Check aria-hidden="true" size={14} /> : <Scale aria-hidden="true" size={14} />}
          {isSelected ? 'Seleccionado' : 'Comparar'}
        </button>
      </div>
      <div className="catalog-card-copy">
        <div className="catalog-card-title">
          <p>{vehicle.year} · {vehicle.body.split(' · ')[0]}</p>
          <h2><Link href={href}>{vehicleName}</Link></h2>
          <span>{vehicle.version}</span>
        </div>
        <Link className="catalog-card-arrow" href={href} aria-label={`Ver detalle de ${vehicleName}`}>
          <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.8} />
        </Link>
      </div>
      <div className="catalog-card-facts">
        <span>{formatVehicleMileage(vehicle.mileageKm)}</span>
        <span>{vehicle.transmission.split(',')[0]}</span>
        <strong>{formatVehiclePrice(vehicle.price, vehicle.currency)}</strong>
      </div>
    </article>
  );
}
