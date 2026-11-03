import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { formatVehicleMileage } from '@/features/vehicles/presentation/formatters';

/** The short inventory grid shared by the homepage and the missing-vehicle page. */
export function VehicleGrid({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <div className="vehicle-grid">
      {vehicles.map((vehicle, index) => (
        <Link className="vehicle-card-link" href={`/vehiculos/${vehicle.slug}`} key={vehicle.slug}>
          <article className="vehicle-card glass-panel">
            <div className="vehicle-image">
              <Image src={vehicle.image} alt={vehicle.imageAlt} fill sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" className="cover-image" />
              <span className="vehicle-index">0{index + 1}</span>
              {index === 0 && <span className="vehicle-status">Disponible</span>}
            </div>
            <div className="vehicle-copy">
              <div><p>{vehicle.year}</p><h3>{vehicle.make} {vehicle.model}</h3></div>
              <span className="vehicle-arrow"><ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} /></span>
            </div>
            <p className="vehicle-detail">{[vehicle.version, vehicle.transmission, vehicle.fuel, formatVehicleMileage(vehicle.mileageKm)].filter(Boolean).join(' · ')}</p>
          </article>
        </Link>
      ))}
    </div>
  );
}
