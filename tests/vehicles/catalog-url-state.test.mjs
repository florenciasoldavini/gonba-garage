import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { parseCatalogUrlState, serializeCatalogUrlState } from '@/app/vehiculos/_components/catalog-url-state';

const bounds = {
  makes: ['BMW', 'Mercedes-Benz', 'Porsche'],
  bodyTypes: ['Coupé', 'Sedán'],
  fuelTypes: ['Nafta'],
  priceCeiling: 120_000,
  priceStep: 5000,
  priceEnabled: true,
  mileageCeiling: 90_000,
  mileageStep: 5000,
  vehicleSlugs: ['a', 'b', 'c', 'd'],
  maxCompare: 3,
};
const parse = (query, overrides = {}) => parseCatalogUrlState(new URLSearchParams(query), { ...bounds, ...overrides });
const serialize = (state, overrides = {}) => serializeCatalogUrlState(state, { ...bounds, ...overrides });
const full = 'q=330i+m&marca=Mercedes-Benz&transmision=automatica&tipo=Coup%C3%A9&combustible=Nafta&precio_min=10000&precio_max=60000&km_min=5000&km_max=40000&orden=menor-precio&comparar=b,a';

describe('catalog URL state', () => {
  it('keeps a clean /vehiculos URL for the defaults', () => {
    const defaults = parse('');
    assert.deepEqual(defaults, {
      query: '', make: 'all', transmission: 'all', bodyType: 'all', fuel: 'all',
      minPrice: 0, maxPrice: 120_000, minMileage: 0, maxMileage: 90_000, sort: 'featured', compare: [],
    });
    assert.equal(serialize(defaults), '', 'Default catalog must keep a clean /vehiculos URL');
  });

  it('round-trips every filter, the sort and the comparison', () => {
    const state = parse(full);
    assert.equal(state.make, 'Mercedes-Benz');
    assert.equal(state.transmission, 'automatic');
    assert.equal(state.bodyType, 'Coupé');
    assert.equal(state.sort, 'price-asc');
    assert.deepEqual(state.compare, ['b', 'a'], 'Comparison keeps the selection order');
    assert.equal(serialize(state), full, 'Parse and serialize must round-trip');
  });

  it('matches options and limits the comparison', () => {
    assert.equal(parse('marca=bmw').make, 'BMW', 'Option matching ignores case');
    assert.equal(parse('marca=Ford').make, 'all', 'Unknown options fall back to all');
    assert.equal(parse('transmision=automatic').transmission, 'all', 'Only Spanish URL values are accepted');
    assert.equal(parse('orden=price-asc').sort, 'featured');
    assert.equal(parse('orden=recientes').sort, 'year', 'Links from before the year sort was renamed still work');
    assert.equal(serialize(parse('orden=recientes')), 'orden=anio');
    assert.deepEqual(parse('comparar=a,a,x,b,c,d').compare, ['a', 'b', 'c'], 'Comparison drops unknown and duplicate slugs and caps at the maximum');
  });

  it('snaps and clamps ranges', () => {
    const prices = parse('precio_min=12400&precio_max=999999');
    assert.equal(prices.minPrice, 10_000, 'Prices snap to the slider step');
    assert.equal(prices.maxPrice, 120_000, 'Prices clamp to the ceiling');
    const inverted = parse('km_min=50000&km_max=20000');
    assert.equal(inverted.minMileage, 0, 'An inverted range resets');
    assert.equal(inverted.maxMileage, 90_000);
    assert.equal(parse('precio_min=abc').minPrice, 0);
  });

  it('ignores price filters and sorting while the MEP quote is unavailable', () => {
    const noQuote = parse('precio_min=10000&orden=mayor-precio', { priceEnabled: false });
    assert.equal(noQuote.minPrice, 0, 'Price filters are ignored while the MEP quote is unavailable');
    assert.equal(noQuote.sort, 'featured', 'Price sorting is ignored while the MEP quote is unavailable');
    assert.equal(serialize({ ...parse(full), compare: [] }, { priceEnabled: false }).includes('precio'), false);
  });
});
