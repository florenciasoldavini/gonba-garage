import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('exports', compiled)(exports);
  return exports;
}

const { RESERVATION_WINDOW_DAYS, getVehicleDisplayStatus, getVehicleStatusPresentation } = load('../features/vehicles/presentation/status.ts');
const { pickSimilarVehicles } = load('../features/vehicles/domain/similar-vehicles.ts');

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-11-01T12:00:00Z');
const ago = (days) => new Date(now - days * DAY).toISOString();

// Mercado Libre paused reads as reserved inside the window, then as sold. Closed always reads as sold.
assert.equal(getVehicleDisplayStatus({ status: 'active', updatedAt: ago(400) }, now), 'active');
assert.equal(getVehicleDisplayStatus({ status: 'paused', updatedAt: ago(1) }, now), 'paused');
assert.equal(getVehicleDisplayStatus({ status: 'paused', updatedAt: ago(RESERVATION_WINDOW_DAYS - 0.01) }, now), 'paused');
assert.equal(getVehicleDisplayStatus({ status: 'paused', updatedAt: ago(RESERVATION_WINDOW_DAYS + 0.01) }, now), 'sold');
assert.equal(getVehicleDisplayStatus({ status: 'closed', updatedAt: ago(0) }, now), 'sold');
assert.equal(getVehicleDisplayStatus({ status: 'sold', updatedAt: ago(0) }, now), 'sold');

assert.deepEqual(getVehicleStatusPresentation({ status: 'active', updatedAt: ago(0) }, now), {
  status: 'active', label: 'Disponible', schemaAvailability: 'https://schema.org/InStock', isAvailable: true,
});
assert.deepEqual(getVehicleStatusPresentation({ status: 'paused', updatedAt: ago(2) }, now), {
  status: 'paused', label: 'Reservado', schemaAvailability: 'https://schema.org/Reserved', isAvailable: false,
});
for (const vehicle of [{ status: 'closed', updatedAt: ago(2) }, { status: 'paused', updatedAt: ago(60) }]) {
  assert.deepEqual(getVehicleStatusPresentation(vehicle, now), {
    status: 'sold', label: 'Vendido', schemaAvailability: 'https://schema.org/SoldOut', isAvailable: false,
  });
}

const car = (slug, overrides) => ({
  slug, make: 'Ford', model: 'Focus', year: 2018, body: 'Hatchback · 5 puertas',
  price: 20000, currency: 'USD', status: 'active', ...overrides,
});
const sold = car('bmw-330i-mla1', { make: 'BMW', model: '330i', body: 'Sedán · 4 puertas', year: 2021, price: 58900, status: 'closed' });
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
assert.deepEqual(pickSimilarVehicles(sold, candidates).map(({ slug }) => slug), ['bmw-330i-relisted', 'audi-a4', 'vw-vento']);
assert.deepEqual(pickSimilarVehicles(sold, candidates, 5).map(({ slug }) => slug), ['bmw-330i-relisted', 'audi-a4', 'vw-vento', 'bmw-x1', 'ford-focus']);
// Never the car itself or another car that is not for sale.
assert.deepEqual(pickSimilarVehicles(sold, [sold, candidates[5]]), []);
// Prices in another currency do not compare: catalog order decides among equals.
const pesos = [car('a', { currency: 'ARS', price: 1 }), car('b', { currency: 'ARS', price: 99_999_999 })];
assert.deepEqual(pickSimilarVehicles(sold, pesos).map(({ slug }) => slug), ['a', 'b']);

console.log('Vehicle lifecycle presentation and similar-vehicle ranking passed.');
