import { NextResponse } from 'next/server';
import { cronAuthorized, privateHeaders } from '@/lib/alerts/config';
import { isAlertsDatabaseConfigured } from '@/lib/alerts/database';
import { reconcileCatalog, runCatalogSyncWork } from '@/lib/integrations/mercado-libre/inventory-sync';
import { reportIntegrationFailure } from '@/lib/integrations/mercado-libre/failures';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Scheduled reconciliation: queues missed or stale items, then drains the queue. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401, headers: privateHeaders });
  if (!isAlertsDatabaseConfigured()) return NextResponse.json({ ok: false }, { status: 503, headers: privateHeaders });
  try {
    const reconciliation = await reconcileCatalog();
    const processed = await runCatalogSyncWork();
    return NextResponse.json({ ok: true, reconciliation, processed }, { headers: privateHeaders });
  } catch (error) {
    const incident = reportIntegrationFailure(error, 'catalog_sync');
    return NextResponse.json({ ok: false, incidentId: incident.incidentId }, { status: 503, headers: privateHeaders });
  }
}
