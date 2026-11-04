'use client';

import Link, { useLinkStatus } from 'next/link';
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowUpRight, Check, Scale } from 'lucide-react';

import { SkeletonImage } from '@/components/ui/skeleton-image';
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

/**
 * The photo's rendered width (see inventory-catalog.css): the full-width card on phones, two columns
 * up to 1000px, then two columns beside the 300px filters until the layout reaches its 1380px maximum.
 */
const CARD_IMAGE_SIZES =
  '(max-width: 700px) calc(100vw - 46px), (max-width: 1000px) calc(50vw - 53px), (max-width: 1428px) calc(50vw - 212px), 502px';

type CatalogVehicleCardProps = {
  compareDisabled?: boolean;
  /** Cards in the first row are on screen at load; the first photo is the page's largest paint on desktop. */
  imagePriority?: 'high' | 'eager';
  isSelected?: boolean;
  /** Without it the card has no compare button. */
  onToggleComparison?: (vehicle: Vehicle) => void;
  /** Adds the approximate dollar line under a peso price. */
  quote?: MepQuote | null;
  vehicle: Vehicle;
};

export function CatalogVehicleCard({
  compareDisabled = false,
  imagePriority,
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
        <SkeletonImage
          src={vehicle.image}
          alt={formatVehicleImageAlt(vehicle)}
          fill
          sizes={CARD_IMAGE_SIZES}
          loading={imagePriority ? 'eager' : 'lazy'}
          fetchPriority={imagePriority === 'high' ? 'high' : undefined}
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
