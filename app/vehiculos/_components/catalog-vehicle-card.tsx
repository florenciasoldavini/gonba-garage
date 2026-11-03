'use client';

import Image from 'next/image';
import Link, { useLinkStatus } from 'next/link';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowUpRight, Check, Scale } from 'lucide-react';

import type { MepQuote } from '@/features/vehicles/domain/catalog-pricing';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import {
  formatVehicleImageAlt,
  formatVehicleMileage,
  formatVehiclePrice,
} from '@/features/vehicles/presentation/formatters';
import { getVehicleStatusPresentation } from '@/features/vehicles/presentation/status';
import { ApproximateUsdPrice } from './approximate-usd-price';
import './catalog-vehicle-card.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

/** The card's hit area. The detail page renders on demand, so it lights the card up until it arrives. */
function CardHitArea() {
  const { pending } = useLinkStatus();
  return <span className="catalog-card-hit" data-pending={pending || undefined} aria-hidden="true" />;
}

type CatalogVehicleCardProps = {
  compareDisabled?: boolean;
  isSelected?: boolean;
  /** Without it the card has no compare button. */
  onToggleComparison?: (vehicle: Vehicle) => void;
  /** Adds the approximate dollar line under a peso price. */
  quote?: MepQuote | null;
  vehicle: Vehicle;
};

export function CatalogVehicleCard({
  compareDisabled = false,
  isSelected = false,
  onToggleComparison,
  quote = null,
  vehicle,
}: CatalogVehicleCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const vehicleName = `${vehicle.make} ${vehicle.model}`;
  const href = `/vehiculos/${vehicle.slug}`;
  const status = getVehicleStatusPresentation(vehicle);

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
    <article
      className={`catalog-card glass-panel${isSelected ? ' catalog-card-selected' : ''}`}
      data-status={status.status}
      ref={cardRef}
    >
      <div className="catalog-card-image">
        <Image
          src={vehicle.image}
          alt={formatVehicleImageAlt(vehicle)}
          fill
          sizes="(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 38vw"
          className="cover-image"
        />
        <span className="catalog-card-status">{status.label}</span>
        {onToggleComparison && (
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
        )}
      </div>
      <div className="catalog-card-copy">
        <div className="catalog-card-title">
          <p>
            {vehicle.year} · {vehicle.body.split(' · ')[0]}
          </p>
          <h2>
            {/* Its hit area covers the whole card, so a tap anywhere but Comparar opens it. */}
            <Link href={href} aria-label={`${vehicleName} ${vehicle.year}`}>
              {vehicleName}
              <CardHitArea />
            </Link>
          </h2>
          <span>{vehicle.version}</span>
        </div>
        <span className="catalog-card-arrow" aria-hidden="true">
          <ArrowUpRight size={17} strokeWidth={1.8} />
        </span>
      </div>
      <div className="catalog-card-facts">
        <span>{formatVehicleMileage(vehicle.mileageKm)}</span>
        <span>{vehicle.transmission.split(',')[0]}</span>
        <div className="catalog-card-price">
          <strong>{formatVehiclePrice(vehicle.price, vehicle.currency)}</strong>
          <ApproximateUsdPrice quote={quote} vehicle={vehicle} />
        </div>
      </div>
    </article>
  );
}
