import { NextResponse } from 'next/server';
import { alertEmailsConfigured, cronAuthorized, privateHeaders } from '@/lib/alerts/config';
import { runInventoryAlertWork } from '@/lib/alerts/inventory-delivery';
import { enqueueDailyPriceReview, runPriceAlertWork } from '@/lib/alerts/price-delivery';

export const runtime = 'nodejs';
export const maxDuration = 300;
/** Daily price review, plus any search-alert matching and emails still due. Needs the alert email configuration. */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401, headers: privateHeaders });
  if (!alertEmailsConfigured()) return NextResponse.json({ ok: true, enabled: false }, { headers: privateHeaders });
  // Side by side, each within its own time budget, so one failing does not hold back the other.
  const results = await Promise.allSettled([
    enqueueDailyPriceReview().then(runPriceAlertWork),
    runInventoryAlertWork(),
  ]);
  if (results.some(result => result.status === 'rejected')) {
    console.error('alert_daily_failure');
    return NextResponse.json({ ok: false }, { status: 503, headers: privateHeaders });
  }
  return NextResponse.json({ ok: true }, { headers: privateHeaders });
}
