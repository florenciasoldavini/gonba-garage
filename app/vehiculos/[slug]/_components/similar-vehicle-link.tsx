import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import type { MepQuote } from '@/features/vehicles/domain/catalog-pricing';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { formatVehicleMileage, formatVehiclePrice } from '@/features/vehicles/presentation/formatters';
import { ApproximateUsdPrice } from '../../_components/approximate-usd-price';

type SimilarVehicleLinkProps = {
  index: number;
  quote: MepQuote | null;
  vehicle: Vehicle;
};

/**
 * One row of the other-cars index under a car page: the name set large like the page's own titles,
 * with a small photo that only comes into colour on hover, so the list reads as a way to keep
 * browsing rather than a second catalog competing with the car above it.
 */
export function SimilarVehicleLink({ index, quote, vehicle }: SimilarVehicleLinkProps) {
  return (
    <li>
      <Link className="detail-similar-link" href={`/vehiculos/${vehicle.slug}`}>
        <span className="detail-similar-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="detail-similar-name">
          <h3>
            {vehicle.make} {vehicle.model}
          </h3>
          <span>{vehicle.version}</span>
        </span>
        <span className="detail-similar-meta">
          {vehicle.year} · {formatVehicleMileage(vehicle.mileageKm)}
        </span>
        <span className="detail-similar-price">
          <strong>{formatVehiclePrice(vehicle.price, vehicle.currency)}</strong>
          <ApproximateUsdPrice quote={quote} vehicle={vehicle} />
        </span>
        <span className="detail-similar-photo">
          <Image src={vehicle.image} alt="" fill sizes="132px" className="cover-image" />
        </span>
        <ArrowUpRight className="detail-similar-arrow" aria-hidden="true" size={20} strokeWidth={1.8} />
      </Link>
    </li>
  );
}
