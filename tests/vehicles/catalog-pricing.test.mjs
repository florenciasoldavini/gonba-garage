import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { comparableUsdPrice, formatMepQuoteUpdatedAt, MAX_QUOTE_AGE_MS, parseMepQuote } from '@/features/vehicles/domain/catalog-pricing';

const now = Date.parse('2026-10-28T18:00:00Z');
const payload = { moneda: 'USD', casa: 'bolsa', venta: 1566, compra: 1500, fechaActualizacion: '2026-10-28T17:57:00Z' };
const ars = Object.freeze({ price: 13_700_000, currency: 'ARS' });
const usd = Object.freeze({ price: 13_800, currency: 'USD' });

describe('MEP quote', () => {
  it('uses venta, never compra', () => {
    assert.equal(parseMepQuote(payload, now).arsPerUsd, 1566, 'Must use venta, never compra');
  });

  it.each([
    { venta: 0 }, { venta: -1 }, { venta: Infinity }, { venta: '1566' }, { casa: 'blue' }, { moneda: 'ARS' },
    { fechaActualizacion: 'invalid' }, { fechaActualizacion: new Date(now + 3_600_000).toISOString() },
    { fechaActualizacion: new Date(now - MAX_QUOTE_AGE_MS - 1).toISOString() },
  ])('rejects an invalid or stale quote: %o', patch => {
    assert.equal(parseMepQuote({ ...payload, ...patch }, now), null);
  });

  it('keeps a weekend quote usable with its original timestamp', () => {
    assert.ok(parseMepQuote({ ...payload, fechaActualizacion: new Date(now - 72 * 3_600_000).toISOString() }, now),
      'Weekend quote remains usable with its original timestamp');
  });

  // Formatted on the server with plain spaces, so the text matches what browsers render on hydration.
  it('formats the update time as browsers render it', () => {
    assert.equal(formatMepQuoteUpdatedAt('2026-10-31T17:57:00.000Z'), '31/10/26, 2:57 p. m.');
    assert.equal(formatMepQuoteUpdatedAt('2026-10-31T03:05:00.000Z'), '31/10/26, 12:05 a. m.');
  });
});

describe('comparable USD price', () => {
  const quote = parseMepQuote(payload, now);

  it('sorts and filters ARS and USD cars in USD without touching the card price', () => {
    assert.ok(comparableUsdPrice(ars, quote) < comparableUsdPrice(usd, quote));
    const cars = [usd, ars];
    assert.deepEqual(cars.toSorted((a, b) => comparableUsdPrice(a, quote) - comparableUsdPrice(b, quote)), [ars, usd]);
    assert.deepEqual(cars.filter(v => comparableUsdPrice(v, quote) <= 9000), [ars]);
    assert.equal(ars.price, 13_700_000, 'Original card price must remain untouched');
  });

  it('leaves ARS prices without a comparison during a quote outage', () => {
    assert.equal(comparableUsdPrice(ars, null), null);
    assert.equal(comparableUsdPrice(usd, null), 13_800);
  });
});
