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
  const batch=url.searchParams.get('ids').split(',');
  assert.ok(batch.length<=20);
  return batch.toReversed().map(id=>({id,status_code:200,body:{id,seller_id:123,title:id,status:states[(Number(id.slice(3))-1)%states.length],sub_status:['example']}}));
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
await assert.rejects(read(seller, async () => {throw new Error('Provider unavailable');}));
console.log('Diagnostics: scan beyond 1,000, all states, unordered bulk, missing/failed items, incomplete search, empty account and provider failures passed.');
