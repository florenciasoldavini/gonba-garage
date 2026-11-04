import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  getVehicleDisplayStatus,
  getVehicleStatusPresentation,
  RESERVATION_WINDOW_DAYS,
} from '@/features/vehicles/presentation/status';
import { pickSimilarVehicles } from '@/features/vehicles/domain/similar-vehicles';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-11-01T12:00:00Z');
const ago = days => new Date(now - days * DAY).toISOString();

describe('vehicle status', () => {
  // Mercado Libre paused reads as reserved inside the window, then as sold. Closed always reads as sold.
  it('reads paused as reserved inside the window, then as sold', () => {
    assert.equal(getVehicleDisplayStatus({ status: 'active', updatedAt: ago(400) }, now), 'active');
    assert.equal(getVehicleDisplayStatus({ status: 'paused', updatedAt: ago(1) }, now), 'paused');
    assert.equal(
      getVehicleDisplayStatus({ status: 'paused', updatedAt: ago(RESERVATION_WINDOW_DAYS - 0.01) }, now),
      'paused',
    );
    assert.equal(
      getVehicleDisplayStatus({ status: 'paused', updatedAt: ago(RESERVATION_WINDOW_DAYS + 0.01) }, now),
      'sold',
    );
    assert.equal(getVehicleDisplayStatus({ status: 'closed', updatedAt: ago(0) }, now), 'sold');
    assert.equal(getVehicleDisplayStatus({ status: 'sold', updatedAt: ago(0) }, now), 'sold');
  });

  it('maps each status to its label and Offer availability', () => {
    assert.deepEqual(getVehicleStatusPresentation({ status: 'active', updatedAt: ago(0) }, now), {
      status: 'active',
      label: 'Disponible',
      schemaAvailability: 'https://schema.org/InStock',
      isAvailable: true,
    });
    assert.deepEqual(getVehicleStatusPresentation({ status: 'paused', updatedAt: ago(2) }, now), {
      status: 'paused',
      label: 'Reservado',
      schemaAvailability: 'https://schema.org/Reserved',
      isAvailable: false,
    });
    for (const vehicle of [
      { status: 'closed', updatedAt: ago(2) },
      { status: 'paused', updatedAt: ago(60) },
    ]) {
      assert.deepEqual(getVehicleStatusPresentation(vehicle, now), {
        status: 'sold',
        label: 'Vendido',
        schemaAvailability: 'https://schema.org/SoldOut',
        isAvailable: false,
      });
    }
  });
});

describe('similar vehicles', () => {
  const car = (slug, overrides) => ({
    slug,
    make: 'Ford',
    model: 'Focus',
    year: 2018,
    body: 'Hatchback · 5 puertas',
    price: 20000,
    currency: 'USD',
    status: 'active',
    ...overrides,
  });
  const sold = car('bmw-330i-mla1', {
    make: 'BMW',
    model: '330i',
    body: 'Sedán · 4 puertas',
    year: 2021,
    price: 58900,
    status: 'closed',
  });
  const candidates = [
    car('ford-focus', { price: 58000 }),
    car('audi-a4', { make: 'Audi', model: 'A4', body: 'Sedán · 4 puertas', year: 2020, price: 50000 }),
    car('bmw-x1', { make: 'BMW', model: 'X1', body: 'SUV · 5 puertas', year: 2020, price: 45000 }),
    car('bmw-330i-relisted', { make: 'BMW', model: '330i', body: 'Sedán · 4 puertas', year: 2021, price: 61000 }),
    car('vw-vento', { make: 'Volkswagen', model: 'Vento', body: 'Sedán · 4 puertas', year: 2019, price: 30000 }),
    car('bmw-320i-paused', { make: 'BMW', model: '320i', body: 'Sedán · 4 puertas', status: 'paused' }),
    sold,
  ];

  // The same model first (often the same car relisted), then body type, make and age; closest price breaks ties.
  it('ranks the same model first, then body type, make and age', () => {
    assert.deepEqual(
      pickSimilarVehicles(sold, candidates).map(({ slug }) => slug),
      ['bmw-330i-relisted', 'audi-a4', 'vw-vento'],
    );
    assert.deepEqual(
      pickSimilarVehicles(sold, candidates, 5).map(({ slug }) => slug),
      ['bmw-330i-relisted', 'audi-a4', 'vw-vento', 'bmw-x1', 'ford-focus'],
    );
  });

  it('never suggests the car itself or another car that is not for sale', () => {
    assert.deepEqual(pickSimilarVehicles(sold, [sold, candidates[5]]), []);
  });

  it('suggests other available cars under an available car too', () => {
    const available = candidates[3];
    const picked = pickSimilarVehicles(available, candidates).map(({ slug }) => slug);
    assert.deepEqual(picked, ['audi-a4', 'vw-vento', 'bmw-x1']);
    assert.ok(!picked.includes(available.slug), 'never the car itself');
    assert.ok(!picked.includes('bmw-320i-paused') && !picked.includes(sold.slug), 'only available cars');
  });

  it('keeps the rail short', () => {
    assert.equal(pickSimilarVehicles(sold, candidates).length, 3);
    assert.equal(pickSimilarVehicles(sold, candidates, 2).length, 2);
    // Fewer candidates than the limit: all of them, no padding.
    assert.deepEqual(
      pickSimilarVehicles(sold, [candidates[0]]).map(({ slug }) => slug),
      ['ford-focus'],
    );
  });

  it('suggests nothing when no other car is available', () => {
    assert.deepEqual(pickSimilarVehicles(sold, []), []);
    const onlyCar = candidates[0];
    assert.deepEqual(pickSimilarVehicles(onlyCar, [onlyCar, candidates[5], sold]), []);
  });

  it('does not compare prices in another currency', () => {
    // Catalog order decides among equals.
    const pesos = [car('a', { currency: 'ARS', price: 1 }), car('b', { currency: 'ARS', price: 99_999_999 })];
    assert.deepEqual(
      pickSimilarVehicles(sold, pesos).map(({ slug }) => slug),
      ['a', 'b'],
    );
  });
});
