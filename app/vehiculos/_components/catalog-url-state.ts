// Catalog search, filters, sort and comparison live in the URL so Back from a vehicle page, a reload
// or a shared link restores the same view. Only non-default values are written.

import type { InventorySort } from './inventory-toolbar';

export type CatalogUrlState = {
  query: string;
  make: string;
  transmission: string;
  bodyType: string;
  fuel: string;
  minPrice: number;
  maxPrice: number;
  minMileage: number;
  maxMileage: number;
  sort: InventorySort;
  compare: string[];
};

export type CatalogUrlBounds = {
  makes: string[];
  bodyTypes: string[];
  fuelTypes: string[];
  priceCeiling: number;
  priceStep: number;
  priceEnabled: boolean;
  mileageCeiling: number;
  mileageStep: number;
  vehicleSlugs: string[];
  maxCompare: number;
};

type SearchParamsLike = { get(name: string): string | null };

const transmissionParams: Record<string, string> = { automatica: 'automatic', manual: 'manual' };
const sortParams: Record<string, InventorySort> = {
  recientes: 'newest',
  'menor-precio': 'price-asc',
  'mayor-precio': 'price-desc',
  'menor-km': 'mileage',
};

function findKey<T>(record: Record<string, T>, value: T) {
  return Object.keys(record).find((key) => record[key] === value);
}

function matchOption(value: string | null, options: string[]) {
  const normalized = value?.trim().toLocaleLowerCase('es');
  if (!normalized) return 'all';
  return options.find((option) => option.toLocaleLowerCase('es') === normalized) ?? 'all';
}

function parseRange(minValue: string | null, maxValue: string | null, ceiling: number, step: number) {
  const snap = (value: string | null, fallback: number) => {
    if (value === null || value.trim() === '') return fallback;
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(ceiling, Math.max(0, Math.round(number / step) * step));
  };
  const min = snap(minValue, 0);
  const max = snap(maxValue, ceiling);
  // The sliders keep at least one step between handles; an inverted range from a stale link resets.
  return max - min >= step ? { min, max } : { min: 0, max: ceiling };
}

export function parseCatalogUrlState(params: SearchParamsLike, bounds: CatalogUrlBounds): CatalogUrlState {
  const price = bounds.priceEnabled
    ? parseRange(params.get('precio_min'), params.get('precio_max'), bounds.priceCeiling, bounds.priceStep)
    : { min: 0, max: bounds.priceCeiling };
  const mileage = parseRange(params.get('km_min'), params.get('km_max'), bounds.mileageCeiling, bounds.mileageStep);
  const sort = sortParams[params.get('orden') ?? ''] ?? 'featured';
  const compare = [...new Set((params.get('comparar') ?? '').split(','))]
    .filter((slug) => bounds.vehicleSlugs.includes(slug))
    .slice(0, bounds.maxCompare);

  return {
    query: (params.get('q') ?? '').slice(0, 80),
    make: matchOption(params.get('marca'), bounds.makes),
    transmission: transmissionParams[params.get('transmision') ?? ''] ?? 'all',
    bodyType: matchOption(params.get('tipo'), bounds.bodyTypes),
    fuel: matchOption(params.get('combustible'), bounds.fuelTypes),
    minPrice: price.min,
    maxPrice: price.max,
    minMileage: mileage.min,
    maxMileage: mileage.max,
    sort: !bounds.priceEnabled && sort.startsWith('price-') ? 'featured' : sort,
    compare,
  };
}

export function serializeCatalogUrlState(state: CatalogUrlState, bounds: CatalogUrlBounds) {
  const params = new URLSearchParams();
  const query = state.query.trim();
  if (query) params.set('q', query);
  if (state.make !== 'all') params.set('marca', state.make);
  const transmission = findKey(transmissionParams, state.transmission);
  if (transmission) params.set('transmision', transmission);
  if (state.bodyType !== 'all') params.set('tipo', state.bodyType);
  if (state.fuel !== 'all') params.set('combustible', state.fuel);
  if (bounds.priceEnabled && state.minPrice !== 0) params.set('precio_min', String(state.minPrice));
  if (bounds.priceEnabled && state.maxPrice !== bounds.priceCeiling) params.set('precio_max', String(state.maxPrice));
  if (state.minMileage !== 0) params.set('km_min', String(state.minMileage));
  if (state.maxMileage !== bounds.mileageCeiling) params.set('km_max', String(state.maxMileage));
  const sort = findKey(sortParams, state.sort);
  if (sort && (bounds.priceEnabled || !state.sort.startsWith('price-'))) params.set('orden', sort);
  if (state.compare.length > 0) params.set('comparar', state.compare.join(','));
  // Keep the comparison list readable: commas are valid in a query string.
  return params.toString().replaceAll('%2C', ',');
}
