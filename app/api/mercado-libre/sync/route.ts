import { NextResponse } from 'next/server';
import { cronAuthorized, alertEmailsConfigured, privateHeaders } from '@/lib/alerts/config';
import { isAlertsDatabaseConfigured } from '@/lib/alerts/database';
import { runInventoryAlertWorkSafely } from '@/lib/alerts/inventory-delivery';
import { reconcileCatalog, runCatalogSyncWork } from '@/lib/integrations/mercado-libre/inventory-sync';
import { reportIntegrationFailure } from '@/lib/integrations/mercado-libre/failures';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Scheduled reconciliation: queues missed or stale items, then drains the queue. Cars it finds
 * newly available are matched against search alerts right away, with the time left.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401, headers: privateHeaders });
  if (!isAlertsDatabaseConfigured()) return NextResponse.json({ ok: false }, { status: 503, headers: privateHeaders });
  const deadline = Date.now() + 270_000;
  try {
    const reconciliation = await reconcileCatalog();
    const processed = await runCatalogSyncWork();
    if (alertEmailsConfigured()) await runInventoryAlertWorkSafely({ budgetMs: deadline - Date.now() });
    return NextResponse.json({ ok: true, reconciliation, processed }, { headers: privateHeaders });
  } catch (error) {
    const incident = reportIntegrationFailure(error, 'catalog_sync');
    return NextResponse.json({ ok: false, incidentId: incident.incidentId }, { status: 503, headers: privateHeaders });
  }
}
