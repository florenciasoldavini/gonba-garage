import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../features/vehicles/domain/catalog-pricing.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { parseMepQuote, comparableUsdPrice, MAX_QUOTE_AGE_MS } = exports;
const now = Date.parse('2026-10-28T18:00:00Z');
const payload = { moneda: 'USD', casa: 'bolsa', venta: 1566, compra: 1500, fechaActualizacion: '2026-10-28T17:57:00Z' };
const quote = parseMepQuote(payload, now);
assert.equal(quote.arsPerUsd, 1566, 'Must use venta, never compra');
const ars = Object.freeze({ price: 13_700_000, currency: 'ARS' });
const usd = Object.freeze({ price: 13_800, currency: 'USD' });
assert.ok(comparableUsdPrice(ars, quote) < comparableUsdPrice(usd, quote));
const cars = [usd, ars];
assert.deepEqual(cars.toSorted((a,b) => comparableUsdPrice(a,quote)-comparableUsdPrice(b,quote)), [ars,usd]);
assert.deepEqual(cars.filter(v => comparableUsdPrice(v,quote) <= 9000), [ars]);
assert.equal(ars.price, 13_700_000, 'Original card price must remain untouched');
assert.equal(comparableUsdPrice(ars, null), null);
assert.equal(comparableUsdPrice(usd, null), 13_800);
for (const patch of [{ venta: 0 }, { venta: -1 }, { venta: Infinity }, { venta: '1566' }, { casa: 'blue' }, { moneda: 'ARS' }, { fechaActualizacion: 'invalid' }, { fechaActualizacion: new Date(now + 3_600_000).toISOString() }, { fechaActualizacion: new Date(now - MAX_QUOTE_AGE_MS - 1).toISOString() }]) {
  assert.equal(parseMepQuote({ ...payload, ...patch }, now), null);
}
assert.ok(parseMepQuote({ ...payload, fechaActualizacion: new Date(now - 72*3_600_000).toISOString() }, now), 'Weekend quote remains usable with its original timestamp');
console.log('MEP venta: currency-aware sorting/filtering, immutable originals, stale/invalid quote rejection, and outage behavior passed.');
