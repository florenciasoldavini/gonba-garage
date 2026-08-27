import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { formatVehicleMileage, formatVehiclePrice } from './formatters';

export type VehicleSpecificationKey =
  | 'price'
  | 'year'
  | 'mileage'
  | 'transmission'
  | 'engine'
  | 'fuel'
  | 'traction'
  | 'body'
  | 'color'
  | 'location';

export const vehicleSpecificationLabels: Record<VehicleSpecificationKey, string> = {
  price: 'Precio',
  year: 'Año',
  mileage: 'Kilometraje',
  transmission: 'Transmisión',
  engine: 'Motor',
  fuel: 'Combustible',
  traction: 'Tracción',
  body: 'Carrocería',
  color: 'Color',
  location: 'Ubicación',
};

export function getVehicleSpecification(vehicle: Vehicle, key: VehicleSpecificationKey) {
  const values: Record<VehicleSpecificationKey, string> = {
    price: formatVehiclePrice(vehicle.price, vehicle.currency),
    year: String(vehicle.year),
    mileage: formatVehicleMileage(vehicle.mileageKm),
    transmission: vehicle.transmission,
    engine: vehicle.engine,
    fuel: vehicle.fuel,
    traction: vehicle.traction,
    body: vehicle.body,
    color: vehicle.color,
    location: vehicle.location,
  };

  return values[key];
}
