import { NextResponse } from 'next/server';
import { alertDeliveryEnabled, cronAuthorized, privateHeaders, requireAlertConfig } from '@/lib/alerts/config';
import { enqueueDailyPriceReview, runPriceAlertWork } from '@/lib/alerts/price-delivery';

export const runtime = 'nodejs';
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401, headers: privateHeaders });
  if (!alertDeliveryEnabled()) return NextResponse.json({ ok: true, enabled: false }, { headers: privateHeaders });
  try {
    requireAlertConfig();
    await enqueueDailyPriceReview();
    await runPriceAlertWork();
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch {
    console.error('price_alert_daily_failure');
    return NextResponse.json({ ok: false }, { status: 503, headers: privateHeaders });
  }
}
