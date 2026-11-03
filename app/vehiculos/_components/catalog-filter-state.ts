// The catalog's search, filters and sort as one state object. The reset, the URL, the alert criteria
// and the active filter count all derive from it, so a new filter only needs adding here.

import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import {
  matchesSearchText,
  vehicleBodyType,
  vehicleTransmissionType,
} from '@/features/vehicles/domain/inventory-search';
import type { CatalogUrlBounds, CatalogUrlState } from './catalog-url-state';
import type { InventoryAlertCriteria } from './inventory-alert';
import type { InventorySort } from './inventory-toolbar';

/** Everything in the catalog URL except the comparison, which holds vehicles, not criteria. */
export type CatalogFilterState = Omit<CatalogUrlState, 'compare'>;

export type CatalogFilterBounds = Pick<CatalogUrlBounds, 'priceCeiling' | 'mileageCeiling'>;

export type CatalogFilterAction =
  | { type: 'update'; changes: Partial<CatalogFilterState> }
  // The sort is a view preference, not a filter: reset keeps it.
  | { type: 'reset'; bounds: CatalogFilterBounds };

export const MIN_PRICE = 0;
export const MIN_MILEAGE = 0;

export function catalogFilterStateFromUrl(state: CatalogUrlState): CatalogFilterState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped from the copy
  const { compare, ...filters } = state;
  return filters;
}

function defaultCatalogFilters(bounds: CatalogFilterBounds): Omit<CatalogFilterState, 'sort'> {
  return {
    query: '',
    make: 'all',
    transmission: 'all',
    bodyType: 'all',
    fuel: 'all',
    minPrice: MIN_PRICE,
    maxPrice: bounds.priceCeiling,
    minMileage: MIN_MILEAGE,
    maxMileage: bounds.mileageCeiling,
  };
}

function mergeFilters(state: CatalogFilterState, changes: Partial<CatalogFilterState>) {
  const changed = (Object.keys(changes) as Array<keyof CatalogFilterState>).some(
    field => !Object.is(state[field], changes[field]),
  );
  // Returning the same object skips the render and the effects, as an unchanged useState value does.
  return changed ? { ...state, ...changes } : state;
}

export function catalogFilterReducer(state: CatalogFilterState, action: CatalogFilterAction): CatalogFilterState {
  switch (action.type) {
    case 'update':
      return mergeFilters(state, action.changes);
    case 'reset':
      return mergeFilters(state, defaultCatalogFilters(action.bounds));
  }
}

export function countActiveCatalogFilters(filters: CatalogFilterState, bounds: CatalogFilterBounds) {
  return [
    // Blank text is no search: the URL and the alert criteria trim it away too.
    filters.query.trim(),
    filters.make !== 'all',
    filters.transmission !== 'all',
    filters.bodyType !== 'all',
    filters.fuel !== 'all',
    filters.minPrice !== MIN_PRICE || filters.maxPrice !== bounds.priceCeiling,
    filters.minMileage !== MIN_MILEAGE || filters.maxMileage !== bounds.mileageCeiling,
  ].filter(Boolean).length;
}

export function catalogAlertCriteria(filters: CatalogFilterState, bounds: CatalogFilterBounds): InventoryAlertCriteria {
  return {
    query: filters.query.trim(),
    make: filters.make === 'all' ? '' : filters.make,
    transmission: filters.transmission === 'all' ? '' : filters.transmission,
    bodyType: filters.bodyType === 'all' ? '' : filters.bodyType,
    fuel: filters.fuel === 'all' ? '' : filters.fuel,
    minPrice: filters.minPrice === MIN_PRICE ? null : filters.minPrice,
    maxPrice: filters.maxPrice === bounds.priceCeiling ? null : filters.maxPrice,
    minMileage: filters.minMileage === MIN_MILEAGE ? null : filters.minMileage,
    maxMileage: filters.maxMileage === bounds.mileageCeiling ? null : filters.maxMileage,
  };
}

type CatalogVehicle = Pick<
  Vehicle,
  'slug' | 'make' | 'model' | 'version' | 'year' | 'transmission' | 'body' | 'fuel' | 'mileageKm'
>;

type CatalogPricing = {
  priceEnabled: boolean;
  // USD comparison price by slug (see catalog-pricing.ts).
  comparisonPrices: ReadonlyMap<string, number | null>;
};

function catalogSortComparator(sort: InventorySort, { priceEnabled, comparisonPrices }: CatalogPricing) {
  const price = (vehicle: CatalogVehicle) => comparisonPrices.get(vehicle.slug) ?? 0;

  if (sort === 'year') return (a: CatalogVehicle, b: CatalogVehicle) => b.year - a.year;
  if (priceEnabled && sort === 'price-asc') return (a: CatalogVehicle, b: CatalogVehicle) => price(a) - price(b);
  if (priceEnabled && sort === 'price-desc') return (a: CatalogVehicle, b: CatalogVehicle) => price(b) - price(a);
  if (sort === 'mileage') return (a: CatalogVehicle, b: CatalogVehicle) => a.mileageKm - b.mileageKm;
  return null;
}

/**
 * The vehicles that match the filters, in the chosen order. Filtering keeps the catalog's featured
 * order and sorting is stable, so the featured sort needs no sorting and ties keep that order.
 */
export function filterCatalogVehicles<CatalogItem extends CatalogVehicle>(
  vehicles: CatalogItem[],
  filters: CatalogFilterState,
  pricing: CatalogPricing,
) {
  const { query, make, transmission, bodyType, fuel, minPrice, maxPrice, minMileage, maxMileage } = filters;
  const price = (vehicle: CatalogVehicle) => pricing.comparisonPrices.get(vehicle.slug) ?? 0;

  // Same text, transmission and body rules as saved search alerts (inventory-search.ts).
  const result = vehicles.filter(vehicle => {
    return (
      matchesSearchText(vehicle, query) &&
      (make === 'all' || vehicle.make === make) &&
      (transmission === 'all' || vehicleTransmissionType(vehicle) === transmission) &&
      (bodyType === 'all' || vehicleBodyType(vehicle) === bodyType) &&
      (fuel === 'all' || vehicle.fuel === fuel) &&
      (!pricing.priceEnabled || (price(vehicle) >= minPrice && price(vehicle) <= maxPrice)) &&
      vehicle.mileageKm >= minMileage &&
      vehicle.mileageKm <= maxMileage
    );
  });

  const comparator = catalogSortComparator(filters.sort, pricing);
  return comparator ? result.toSorted(comparator) : result;
}
