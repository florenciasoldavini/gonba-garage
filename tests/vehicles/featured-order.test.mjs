import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { orderFeaturedVehicles } from '@/features/vehicles/domain/featured-order';

const car = (id, make, year, mileageKm, image = `https://http2.mlstatic.com/D_${id}-F.jpg`) => ({ id, make, year, mileageKm, image });
const ids = (vehicles) => orderFeaturedVehicles(vehicles, 2026).map(({ id }) => id);

describe('featured catalog order', () => {
  it('opens with the newest, least driven cars of different makes, then keeps the listing order', () => {
    // Newest listing first, as the catalog copy returns them.
    const stock = [
      car('old-high-km', 'Renault', 2008, 178_000),
      car('small', 'Fiat', 2014, 83_000),
      car('hatch', 'Mercedes-Benz', 2021, 105_000),
      car('suv-used', 'Toyota', 2023, 58_000),
      car('older-classic', 'BMW', 2010, 124_000),
      car('suv', 'Audi', 2021, 85_000),
      car('pickup', 'Toyota', 2021, 63_000),
      car('suv-new', 'Toyota', 2023, 40_000),
    ];
    assert.deepEqual(ids(stock), [
      'suv-new', 'suv', 'hatch',
      'small', 'suv-used', 'pickup',
      'old-high-km', 'older-classic',
    ]);
  });

  it('repeats a make only when there are not enough makes', () => {
    const stock = [car('a', 'Toyota', 2020, 50_000), car('b', 'Toyota', 2023, 30_000), car('c', 'Ford', 2019, 60_000), car('d', 'Toyota', 2022, 40_000)];
    assert.deepEqual(ids(stock), ['b', 'c', 'd', 'a']);
  });

  it('never picks cars with missing data or no photos', () => {
    const stock = [
      car('no-year', 'Audi', 0, 20_000),
      car('no-km', 'BMW', 2022, 0),
      car('no-photo', 'Ford', 2024, 10_000, '/vehicle-photo-placeholder.jpg'),
      car('new', 'Kia', 2026, 0),
      car('ok', 'Fiat', 2018, 90_000),
    ];
    assert.deepEqual(ids(stock), ['new', 'ok', 'no-year', 'no-km', 'no-photo']);
  });

  it('fills the picks from the rest of the stock when few cars qualify', () => {
    assert.deepEqual(ids([car('a', 'Renault', 2008, 178_000), car('b', 'Fiat', 2016, 70_000)]), ['b', 'a']);
    assert.deepEqual(ids([]), []);
  });
});
