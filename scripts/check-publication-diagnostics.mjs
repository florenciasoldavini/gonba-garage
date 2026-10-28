import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/integrations/mercado-libre/publication-diagnostics.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { readPublicationDiagnostics: read } = exports;
const seller = '123';
const ids = Array.from({length: 1003}, (_,i) => `MLA${i+1}`);
const states = ['active','closed','paused','under_review','future_state'];
const attributes = Object.freeze([
  Object.freeze({ id: 'HAS_RAIN_SENSOR', name: 'Sensor de lluvia', value_name: 'No', value_type: 'boolean', values: [{ id: '242084', name: 'No', struct: null }] }),
  Object.freeze({ id: 'UNKNOWN_ATTRIBUTE', name: 'Atributo nuevo', value_name: null, values: [{ name: 'Primero' }, { name: 'Segundo' }], future_field: { original: true } }),
  Object.freeze({ id: 'ENGINE_DISPLACEMENT', name: 'Cilindrada', value_name: '2800 cc', values: [{ name: '2800 cc', struct: { number: 2800, unit: 'cc' } }] }),
]);
let page = 0;
let bulkCalls = 0;
const full = await read(seller, async path => {
  const url = new URL(path, 'https://api.mercadolibre.com');
  assert.equal(url.searchParams.has('status'), false, 'Diagnostics must not filter active-only');
  if(url.pathname.endsWith('/search')) {
    assert.equal(url.searchParams.get('search_type'), 'scan');
    assert.equal(url.searchParams.has('offset'), false);
    return {paging:{total:ids.length}, results:ids.slice(page*100, ++page*100), scroll_id:'cursor'};
  }
  bulkCalls++;
  assert.ok(url.searchParams.get('attributes').split(',').includes('body.attributes'), 'Bulk must request the complete attribute array');
  const batch=url.searchParams.get('ids').split(',');
  assert.ok(batch.length<=20);
  return batch.toReversed().map(id=>({id,status_code:200,body:{id,seller_id:123,title:id,status:states[(Number(id.slice(3))-1)%states.length],sub_status:['example'],attributes}}));
});
assert.equal(page,11);
assert.equal(bulkCalls,51);
assert.equal(full.complete,true);
assert.equal(full.totalRead,1003);
assert.equal(Object.values(full.countsByStatus).reduce((a,b)=>a+b,0),1003);
assert.equal(full.countsByStatus.active,201);
assert.equal(full.countsByStatus.closed,201);
assert.equal(full.countsByStatus.future_state,200);
assert.deepEqual(full.items[0].subStatuses,['example']);
assert.deepEqual(full.missingAttributes, []);
for (const state of states) {
  const item = full.items.find(item => item.status === state);
  assert.deepEqual(item.attributes, attributes, `Raw attributes must be kept for ${state}`);
  assert.equal(item.attributes, attributes, 'No filtering, mapping or mutation of raw attributes');
}
const partial = await read(seller, async path => path.includes('/search')
  ? {paging:{total:3},results:['MLA1','MLA2','MLA3']}
  : [{id:'MLA1',status_code:200,body:{id:'MLA1',seller_id:123,title:'One',status:'active'}},{id:'MLA2',status_code:404}]);
assert.equal(partial.complete,false);
assert.equal(partial.totalRead,1);
assert.deepEqual(partial.failures,[{id:'MLA2',code:404},{id:'MLA3',code:null}]);
const truncated = await read(seller, async path => path.includes('/search')
  ? {paging:{total:63},results:['MLA1']}
  : [{id:'MLA1',status_code:200,body:{id:'MLA1',seller_id:123,title:'One',status:'closed'}}]);
assert.equal(truncated.complete,false);
const empty = await read(seller, async () => ({paging:{total:0},results:null}));
assert.equal(empty.complete,true);
assert.equal(empty.totalRead,0);
const incompleteAttributes = await read(seller, async path => path.includes('/search')
  ? {paging:{total:3},results:['MLA1','MLA2','MLA3']}
  : [
    {status_code:200,body:{id:'MLA1',seller_id:123,title:'Empty',status:'closed',attributes:[]}},
    {status_code:200,body:{id:'MLA2',seller_id:123,title:'Omitted',status:'paused'}},
    {status_code:200,body:{id:'MLA3',seller_id:123,title:'Null',status:'closed',attributes:null}},
  ]);
assert.equal(incompleteAttributes.complete,false);
assert.equal(incompleteAttributes.totalRead,3);
assert.deepEqual(incompleteAttributes.missingAttributes,['MLA2','MLA3']);
assert.deepEqual(incompleteAttributes.items.map(item=>item.attributes),[[],null,null]);
const emptyAttributes = await read(seller, async path => path.includes('/search')
  ? {paging:{total:1},results:['MLA1']}
  : [{status_code:200,body:{id:'MLA1',seller_id:123,title:'Empty',status:'closed',attributes:[]}}]);
assert.equal(emptyAttributes.complete,true, 'An explicitly empty attribute array is a valid response');
const foreignSeller = await read(seller, async path => path.includes('/search')
  ? {paging:{total:1},results:['MLA1']}
  : [{status_code:200,body:{id:'MLA1',seller_id:456,title:'Other seller',status:'closed',attributes}}]);
assert.equal(foreignSeller.totalRead,0);
assert.equal(foreignSeller.complete,false);
assert.deepEqual(foreignSeller.items,[]);
await assert.rejects(read(seller, async () => {throw new Error('Provider unavailable');}));
console.log('Diagnostics: all states, full raw attributes, unknown fields, No values, units, empty vs missing attributes, seller isolation, pagination, partial results and provider failures passed.');
