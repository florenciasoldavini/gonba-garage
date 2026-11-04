import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { LinkPendingIcon, LinkPendingMarker } from '@/components/ui/link-pending';
import { SkeletonImage } from '@/components/ui/skeleton-image';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { formatVehicleImageAlt, formatVehicleMileage } from '@/features/vehicles/presentation/formatters';
import { getVehicleStatusPresentation } from '@/features/vehicles/presentation/status';

// Rendered widths from app/page.css. On desktop the card crops a 4:3 photo to a box 34vw tall (at most
// 470px), so the photo shows at that height × 4/3, wider than the card itself. The 600px cap (the
// photo reaches 627px) keeps 2x screens on the 1200w file instead of jumping to 1920w.
const VEHICLE_IMAGE_SIZES =
  '(max-width: 760px) 100vw, (max-width: 1100px) 50vw, (max-width: 1323px) calc(34vw * 4 / 3), 600px';

/** The short inventory grid shared by the homepage and the missing-vehicle page; styled in app/page.css. */
export function VehicleGrid({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <div className="vehicle-grid">
      {vehicles.map(vehicle => (
        <Link className="vehicle-card-link" href={`/vehiculos/${vehicle.slug}`} key={vehicle.slug}>
          <LinkPendingMarker />
          <article className="vehicle-card glass-panel" data-status={getVehicleStatusPresentation(vehicle).status}>
            <div className="vehicle-image">
              <SkeletonImage
                src={vehicle.image}
                alt={formatVehicleImageAlt(vehicle)}
                fill
                sizes={VEHICLE_IMAGE_SIZES}
                className="cover-image"
              />
              <span className="vehicle-status">{getVehicleStatusPresentation(vehicle).label}</span>
            </div>
            <div className="vehicle-copy">
              <div>
                <p>{vehicle.year}</p>
                <h3>
                  {vehicle.make} {vehicle.model}
                </h3>
              </div>
              <span className="vehicle-arrow">
                <LinkPendingIcon size={16}>
                  <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
                </LinkPendingIcon>
              </span>
            </div>
            <p className="vehicle-detail">
              {[vehicle.version, vehicle.transmission, vehicle.fuel, formatVehicleMileage(vehicle.mileageKm)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </article>
        </Link>
      ))}
    </div>
  );
}
