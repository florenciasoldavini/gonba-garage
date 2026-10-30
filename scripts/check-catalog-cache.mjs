import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const apiKey = 'catalog-api-key-never-cache';
const token = 'access-token-never-cache';
process.env.MERCADO_LIBRE_SELLER_ID = '123';

// Mirrors unstable_cache: key from key parts and JSON arguments, JSON values, TTL, no cached errors.
let now = 0;
const entries = new Map(), cacheOptions = [];
function unstable_cache(fn, keyParts, options) {
  cacheOptions.push(options);
  return async (...args) => {
    const key = `${keyParts.join(',')}-${JSON.stringify(args)}`;
    const hit = entries.get(key);
    if (hit && now - hit.at < options.revalidate * 1000) return JSON.parse(hit.value);
    const value = JSON.stringify(await fn(...args));
    entries.set(key, { at: now, value });
    return JSON.parse(value);
  };
}

const vehicle = (id, status = 'active') => ({ slug: `ford-ka-${id.toLowerCase()}`, mercadoLibreId: id, status, price: 100 });
const item = (id, seller = 123) => ({ id, seller_id: seller, title: id, pictures: [{ url: 'https://http2.mlstatic.com/a.jpg' }],
  attributes: [], permalink: `https://auto.mercadolibre.com.ar/${id}`, seller_contact: 'PRIVATE_FIELD', price: 100 });
let listing = ['MLA1', 'MLA2'], listFails = false;
const calls = { list: 0, item: [] };
const overrides = {
  'next/cache': { unstable_cache },
  'next/server': { NextResponse: { json: (value, init) => Response.json(value, init) } },
  './access-token': { catalogAccessToken: async () => token },
  './credentials': { required: name => process.env[name] },
  '@/lib/integrations/mercado-libre/credentials': { authorized: request => request.headers.get('authorization') === `Bearer ${apiKey}` },
  './oauth': {
    async readMercadoLibrePublications(accessToken) {
      assert.equal(accessToken, token);
      calls.list++;
      if (listFails) throw Error('Provider unavailable');
      return { seller: { id: 123, nickname: 'PRIVATE_FIELD' },
        publications: { items: listing.map(id => ({ vehicle: vehicle(id), source: item(id) })) } };
    },
    async readMercadoLibrePublication(id, accessToken) {
      assert.equal(accessToken, token);
      calls.item.push(id);
      return { vehicle: vehicle(id), source: item(id, id === 'MLA2' ? 999 : 123), description: { plain_text: 'Desc' } };
    },
  },
};
const modules = new Map();
function load(file) {
  const path = resolve(file);
  if (modules.has(path)) return modules.get(path);
  const result = {};
  modules.set(path, result);
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'require', compiled)(result, id => {
    if (id === 'server-only') return {};
    if (id in overrides) return overrides[id];
    if (id.startsWith('node:')) return require(id);
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
    if (id.startsWith('.')) return load(resolve(dirname(path), id) + '.ts');
    throw Error('Unexpected import ' + id);
  });
  return result;
}
const { GET } = load('app/api/mercado-libre/catalog/route.ts');
const request = (query = '', key = apiKey) => GET(new Request(`https://backend.test/api/mercado-libre/catalog${query}`,
  { headers: { Authorization: `Bearer ${key}` } }));
const previousLog = console.error;
console.error = () => {};

try {
  for (const options of cacheOptions) {
    assert.ok(options.revalidate >= 60 && options.revalidate <= 600, 'Catalog cache window must stay short');
    assert.deepEqual(options.tags, ['mercado-libre-catalog']);
  }

  assert.equal((await request('', 'wrong')).status, 401);
  assert.equal((await request('?item=mla1')).status, 400);
  assert.equal(calls.list, 0);

  // Page views share one Mercado Libre catalog read per window.
  for (let i = 0; i < 5; i++) {
    const response = await request();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual((await response.json()).vehicles.map(({ mercadoLibreId }) => mercadoLibreId), ['MLA1', 'MLA2']);
  }
  assert.equal(calls.list, 1);

  // Arbitrary IDs are rejected from the cached active set without item or description reads.
  for (const id of ['MLA999', 'MLA123456789', 'MLA0']) assert.equal((await request(`?item=${id}`)).status, 404);
  assert.deepEqual(calls.item, []);

  for (let i = 0; i < 3; i++) {
    const response = await request('?item=MLA1');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body.source).sort(), ['attributes', 'id', 'permalink', 'pictures', 'title']);
    assert.equal(body.description.plain_text, 'Desc');
  }
  assert.deepEqual(calls.item, ['MLA1']);

  // A listed item that fails the seller check is a cached 404, not a repeated lookup.
  assert.equal((await request('?item=MLA2')).status, 404);
  assert.equal((await request('?item=MLA2')).status, 404);
  assert.deepEqual(calls.item, ['MLA1', 'MLA2']);

  // Listing changes appear after the window.
  listing = ['MLA1', 'MLA3'];
  assert.equal((await request('?item=MLA3')).status, 404);
  now += 301_000;
  assert.deepEqual((await (await request()).json()).vehicles.map(({ mercadoLibreId }) => mercadoLibreId), ['MLA1', 'MLA3']);
  assert.equal((await request('?item=MLA3')).status, 200);
  assert.equal(calls.list, 2);

  // Provider failures are not cached: the next request retries.
  now += 301_000;
  listFails = true;
  assert.equal((await request()).status, 503);
  listFails = false;
  assert.equal((await request()).status, 200);
  assert.equal(calls.list, 4);

  for (const [key, { value }] of entries) {
    for (const secret of [token, apiKey, 'PRIVATE_FIELD', 'seller_id']) {
      assert.equal(key.includes(secret), false, `Cache key must not contain ${secret}`);
      assert.equal(value.includes(secret), false, `Cached value must not contain ${secret}`);
    }
  }

  // Price alerts read Mercado Libre directly for authoritative, seller-checked prices.
  for (const file of ['lib/integrations/mercado-libre/oauth.ts', 'lib/alerts/price-delivery.ts', 'app/api/price-alerts/route.ts']) {
    const source = readFileSync(file, 'utf8');
    assert.equal(/next\/cache|public-catalog/.test(source), false, `${file} must stay uncached`);
  }
} finally {
  console.error = previousLog;
}
console.log('Catalog cache checks passed.');
