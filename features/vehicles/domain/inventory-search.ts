import type { Vehicle } from './vehicle';

/**
 * Shared by the catalog filters and saved search alerts, so an alert matches exactly the cars the
 * same search shows in the catalog. Empty text and null bounds mean "any". Prices are USD
 * comparison amounts (see catalog-pricing.ts).
 */
export type InventorySearchCriteria = {
  query: string;
  make: string;
  transmission: string;
  bodyType: string;
  fuel: string;
  minPrice: number | null;
  maxPrice: number | null;
  minMileage: number | null;
  maxMileage: number | null;
};

export type VehicleSearchFields = Pick<Vehicle, 'make' | 'model' | 'version' | 'year' | 'transmission' | 'body' | 'fuel' | 'mileageKm'>;

export function vehicleBodyType(vehicle: Pick<Vehicle, 'body'>) {
  return vehicle.body.split(' · ')[0];
}

export function vehicleTransmissionType(vehicle: Pick<Vehicle, 'transmission'>) {
  return vehicle.transmission.toLocaleLowerCase('es').startsWith('autom') ? 'automatic' : 'manual';
}

export function matchesSearchText(vehicle: Pick<Vehicle, 'make' | 'model' | 'version' | 'year'>, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  if (!normalizedQuery) return true;
  return `${vehicle.make} ${vehicle.model} ${vehicle.version} ${vehicle.year}`.toLocaleLowerCase('es').includes(normalizedQuery);
}

export function hasPriceBounds(criteria: Pick<InventorySearchCriteria, 'minPrice' | 'maxPrice'>) {
  return criteria.minPrice !== null || criteria.maxPrice !== null;
}

/**
 * `usdPrice` is the vehicle's comparison price. When the criteria have price bounds and it is
 * unknown (an ARS listing without a quote), the vehicle does not match: callers that must not miss
 * a match check `hasPriceBounds` first and get a quote.
 */
export function matchesInventorySearch(vehicle: VehicleSearchFields, criteria: InventorySearchCriteria, usdPrice: number | null) {
  if (!matchesSearchText(vehicle, criteria.query)) return false;
  if (criteria.make && vehicle.make !== criteria.make) return false;
  if (criteria.transmission && vehicleTransmissionType(vehicle) !== criteria.transmission) return false;
  if (criteria.bodyType && vehicleBodyType(vehicle) !== criteria.bodyType) return false;
  if (criteria.fuel && vehicle.fuel !== criteria.fuel) return false;
  if (criteria.minMileage !== null && vehicle.mileageKm < criteria.minMileage) return false;
  if (criteria.maxMileage !== null && vehicle.mileageKm > criteria.maxMileage) return false;
  if (!hasPriceBounds(criteria)) return true;
  if (usdPrice === null) return false;
  return (criteria.minPrice === null || usdPrice >= criteria.minPrice) && (criteria.maxPrice === null || usdPrice <= criteria.maxPrice);
}
