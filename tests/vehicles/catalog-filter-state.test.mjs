import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  catalogAlertCriteria,
  catalogFilterReducer,
  catalogFilterStateFromUrl,
  countActiveCatalogFilters,
  filterCatalogVehicles,
} from '@/app/vehiculos/_components/catalog-filter-state';
import { parseCatalogUrlState, serializeCatalogUrlState } from '@/app/vehiculos/_components/catalog-url-state';

const bounds = {
  makes: ['BMW', 'Porsche'],
  bodyTypes: ['Coupé', 'Sedán'],
  fuelTypes: ['Diésel', 'Nafta'],
  priceCeiling: 120_000,
  priceStep: 5000,
  priceEnabled: true,
  mileageCeiling: 90_000,
  mileageStep: 5000,
  vehicleSlugs: ['a', 'b', 'c', 'd'],
  maxCompare: 3,
};
const defaults = catalogFilterStateFromUrl(parseCatalogUrlState(new URLSearchParams(''), bounds));

// Fixtures for the pure functions only; the app never imports them.
const vehicle = (slug, fields) => ({
  slug,
  make: 'BMW',
  model: 'Serie 3',
  version: '330i',
  year: 2020,
  transmission: 'Automática',
  body: 'Sedán · 4 puertas',
  fuel: 'Nafta',
  mileageKm: 40_000,
  ...fields,
});
const vehicles = [
  vehicle('a', { year: 2019, mileageKm: 60_000 }),
  vehicle('b', { make: 'Porsche', model: '911', version: 'Carrera', year: 2022, body: 'Coupé', mileageKm: 10_000 }),
  vehicle('c', { year: 2022, transmission: 'Manual', fuel: 'Diésel', mileageKm: 30_000 }),
  vehicle('d', { year: 2018, mileageKm: 85_000 }),
];
const pricing = {
  priceEnabled: true,
  comparisonPrices: new Map([
    ['a', 30_000],
    ['b', 110_000],
    ['c', 45_000],
    ['d', 30_000],
  ]),
};
const slugs = (filters, overrides = {}) =>
  filterCatalogVehicles(vehicles, { ...defaults, ...filters }, { ...pricing, ...overrides }).map(({ slug }) => slug);

describe('catalog filter state', () => {
  it('starts from the URL state without the comparison', () => {
    const state = catalogFilterStateFromUrl(
      parseCatalogUrlState(new URLSearchParams('marca=porsche&orden=menor-km&comparar=a,b'), bounds),
    );
    assert.equal(state.make, 'Porsche');
    assert.equal(state.sort, 'mileage');
    assert.equal('compare' in state, false);
  });

  it('updates fields and keeps the same object when nothing changes', () => {
    const updated = catalogFilterReducer(defaults, { type: 'update', changes: { make: 'BMW', minPrice: 10_000 } });
    assert.deepEqual(updated, { ...defaults, make: 'BMW', minPrice: 10_000 });
    assert.equal(
      catalogFilterReducer(updated, { type: 'update', changes: { make: 'BMW' } }),
      updated,
      'An unchanged value must not re-render or restart the URL and analytics timers',
    );
  });

  it('resets every filter but keeps the sort', () => {
    const filtered = {
      query: '911',
      make: 'Porsche',
      transmission: 'manual',
      bodyType: 'Coupé',
      fuel: 'Nafta',
      minPrice: 10_000,
      maxPrice: 60_000,
      minMileage: 5000,
      maxMileage: 40_000,
      sort: 'price-desc',
    };
    const reset = catalogFilterReducer(filtered, { type: 'reset', bounds });
    assert.deepEqual(reset, { ...defaults, sort: 'price-desc' });
    assert.equal(countActiveCatalogFilters(reset, bounds), 0);
    assert.equal(catalogFilterReducer(defaults, { type: 'reset', bounds }), defaults, 'Resetting defaults is a no-op');
  });

  it('serializes to the same URL as the separate fields did', () => {
    const state = parseCatalogUrlState(
      new URLSearchParams('q=911&marca=Porsche&km_max=40000&orden=anio&comparar=b'),
      bounds,
    );
    const filters = catalogFilterStateFromUrl(state);
    assert.equal(
      serializeCatalogUrlState({ ...filters, compare: state.compare }, bounds),
      'q=911&marca=Porsche&km_max=40000&orden=anio&comparar=b',
    );
  });

  it('counts each filter and each range once', () => {
    assert.equal(countActiveCatalogFilters(defaults, bounds), 0);
    assert.equal(countActiveCatalogFilters({ ...defaults, sort: 'year' }, bounds), 0, 'The sort is not a filter');
    assert.equal(countActiveCatalogFilters({ ...defaults, query: ' 911 ' }, bounds), 1, 'Typed text counts as typed');
    assert.equal(
      countActiveCatalogFilters(
        {
          ...defaults,
          make: 'BMW',
          transmission: 'automatic',
          bodyType: 'Sedán',
          fuel: 'Nafta',
          minPrice: 5000,
          maxPrice: 60_000,
          maxMileage: 40_000,
        },
        bounds,
      ),
      6,
    );
  });

  it('ignores a blank search, as the URL does', () => {
    const state = catalogFilterStateFromUrl(parseCatalogUrlState(new URLSearchParams('q=+'), bounds));
    assert.equal(state.query, ' ');
    assert.equal(countActiveCatalogFilters(state, bounds), 0);
    assert.equal(serializeCatalogUrlState({ ...state, compare: [] }, bounds), '');
    assert.equal(countActiveCatalogFilters({ ...defaults, query: ' \t ' }, bounds), 0);
  });

  it('turns the filters into alert criteria', () => {
    assert.deepEqual(catalogAlertCriteria(defaults, bounds), {
      query: '',
      make: '',
      transmission: '',
      bodyType: '',
      fuel: '',
      minPrice: null,
      maxPrice: null,
      minMileage: null,
      maxMileage: null,
    });
    assert.deepEqual(
      catalogAlertCriteria(
        { ...defaults, query: ' 330i ', make: 'BMW', transmission: 'manual', maxPrice: 60_000, minMileage: 5000 },
        bounds,
      ),
      {
        query: '330i',
        make: 'BMW',
        transmission: 'manual',
        bodyType: '',
        fuel: '',
        minPrice: null,
        maxPrice: 60_000,
        minMileage: 5000,
        maxMileage: null,
      },
    );
  });
});

describe('catalog filtering and sorting', () => {
  it('filters with the saved search rules', () => {
    assert.deepEqual(slugs({}), ['a', 'b', 'c', 'd']);
    assert.deepEqual(slugs({ query: 'carrera' }), ['b']);
    assert.deepEqual(slugs({ make: 'BMW', transmission: 'automatic' }), ['a', 'd']);
    assert.deepEqual(slugs({ bodyType: 'Sedán', fuel: 'Diésel' }), ['c']);
    assert.deepEqual(slugs({ minPrice: 30_000, maxPrice: 45_000 }), ['a', 'c', 'd'], 'Price bounds are inclusive');
    assert.deepEqual(slugs({ minMileage: 30_000, maxMileage: 60_000 }), ['a', 'c']);
    assert.deepEqual(slugs({ maxPrice: 5000 }, { priceEnabled: false }), ['a', 'b', 'c', 'd']);
  });

  it('sorts each option and keeps the featured order for ties', () => {
    assert.deepEqual(slugs({ sort: 'featured' }), ['a', 'b', 'c', 'd']);
    assert.deepEqual(slugs({ sort: 'year' }), ['b', 'c', 'a', 'd']);
    assert.deepEqual(slugs({ sort: 'price-asc' }), ['a', 'd', 'c', 'b']);
    assert.deepEqual(slugs({ sort: 'price-desc' }), ['b', 'c', 'a', 'd']);
    assert.deepEqual(slugs({ sort: 'mileage' }), ['b', 'c', 'a', 'd']);
    assert.deepEqual(slugs({ sort: 'price-asc' }, { priceEnabled: false }), ['a', 'b', 'c', 'd']);
  });

  it('matches the previous indexOf ordering on a large catalog', () => {
    const many = Array.from({ length: 2000 }, (_, index) =>
      vehicle(`v${index}`, { year: 2000 + (index % 7), mileageKm: (index * 7919) % 90_000 }),
    );
    const prices = new Map(many.map(({ slug }, index) => [slug, (index * 104_729) % 120_000]));
    for (const sort of ['featured', 'year', 'price-asc', 'price-desc', 'mileage']) {
      const expected = many.toSorted((a, b) => {
        if (sort === 'year') return b.year - a.year;
        if (sort === 'price-asc') return prices.get(a.slug) - prices.get(b.slug);
        if (sort === 'price-desc') return prices.get(b.slug) - prices.get(a.slug);
        if (sort === 'mileage') return a.mileageKm - b.mileageKm;
        return many.indexOf(a) - many.indexOf(b);
      });
      assert.deepEqual(
        filterCatalogVehicles(many, { ...defaults, sort }, { priceEnabled: true, comparisonPrices: prices }),
        expected,
        sort,
      );
    }
  });
});
