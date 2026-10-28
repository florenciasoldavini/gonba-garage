type ScanPage = { paging: { total: number }; results: string[] | null; scroll_id?: string };
type PublicationAttribute = Record<string, unknown>;
type StatusItem = { id: string; seller_id: number; title: string; status: string; sub_status?: string[]; attributes?: PublicationAttribute[] | null };
type BulkEntry = { id?: string; status_code: number; body?: StatusItem };
type GetJson = <T>(path: string) => Promise<T>;

/** Separate from the active-only catalog. No filtering by status and no inventory writes. */
export async function readPublicationDiagnostics(sellerId: string, getJson: GetJson) {
  if (!/^\d+$/.test(sellerId)) throw new Error('Invalid seller');
  const ids = new Set<string>();
  let totalReported = 0;
  let scrollId: string | undefined;
  let scanComplete = false;
  for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
    const query = new URLSearchParams({ search_type: 'scan', limit: '100' });
    if (scrollId) query.set('scroll_id', scrollId);
    const page = await getJson<ScanPage>(`/users/${sellerId}/items/search?${query}`);
    if (pageNumber === 0) totalReported = page.paging.total;
    if (!Number.isSafeInteger(totalReported) || totalReported < 0) throw new Error('Invalid search total');
    const previousSize = ids.size;
    for (const id of page.results ?? []) ids.add(id);
    if (ids.size >= totalReported) { scanComplete = true; break; }
    if (!page.results?.length || previousSize === ids.size || !page.scroll_id) break;
    scrollId = page.scroll_id;
  }

  const requested = [...ids];
  const items: Array<{ id: string; title: string; status: string; subStatuses: string[]; attributes: PublicationAttribute[] | null }> = [];
  const missingAttributes: string[] = [];
  const failures: Array<{ id: string; code: number | null }> = [];
  // Bound concurrency and keep provider errors explicit rather than inventing states.
  for (let offset = 0; offset < requested.length; offset += 20) {
    const batch = requested.slice(offset, offset + 20);
    const response = await getJson<BulkEntry[]>(`/items/bulk?ids=${batch.map(encodeURIComponent).join(',')}&attributes=body.id,body.seller_id,body.title,body.status,body.sub_status,body.attributes`);
    const byId = new Map(response.map(entry => [entry.body?.id ?? entry.id, entry]));
    for (const id of batch) {
      const entry = byId.get(id);
      const item = entry?.body;
      if (entry?.status_code !== 200 || !item || String(item.seller_id) !== sellerId || !item.status) {
        failures.push({ id, code: entry?.status_code ?? null });
        continue;
      }
      // Keep the provider's full attribute objects, including unknown IDs, values and units.
      // An omitted array is not the same as an explicitly empty one.
      const attributes = Array.isArray(item.attributes) ? item.attributes : null;
      if (attributes === null) missingAttributes.push(id);
      items.push({ id, title: item.title, status: item.status, subStatuses: item.sub_status ?? [], attributes });
    }
  }
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  return {
    sellerId,
    checkedAt: new Date().toISOString(),
    totalReported,
    totalFound: requested.length,
    totalRead: items.length,
    complete: scanComplete && failures.length === 0 && missingAttributes.length === 0 && items.length === totalReported,
    countsByStatus: Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))),
    items,
    failures,
    missingAttributes,
  };
}
