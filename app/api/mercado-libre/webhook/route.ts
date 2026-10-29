import { after, NextResponse } from 'next/server';
import { alertDeliveryEnabled, privateHeaders, requireAlertConfig } from '@/lib/alerts/config';
import { enqueuePriceItem, runPriceAlertWorkSafely } from '@/lib/alerts/price-delivery';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  let notification: Record<string, unknown>;
  try {
    if (Number(request.headers.get('content-length')) > 16_384) throw new Error('Oversized notification');
    const text = await request.text();
    if (text.length > 16_384) throw new Error('Oversized notification');
    notification = JSON.parse(text);
    if (!notification || typeof notification !== 'object' || Array.isArray(notification)) throw new Error('Invalid notification');
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: privateHeaders });
  }
  const match = typeof notification.resource === 'string' ? notification.resource.match(/^\/items\/(MLA\d+)(?:\/prices)?$/) : null;
  if (!match || !['items', 'items_prices'].includes(String(notification.topic))
    || !process.env.MERCADO_LIBRE_SELLER_ID || String(notification.user_id) !== process.env.MERCADO_LIBRE_SELLER_ID
    || !process.env.MERCADO_LIBRE_CLIENT_ID || String(notification.application_id) !== process.env.MERCADO_LIBRE_CLIENT_ID) {
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  }
  if (!alertDeliveryEnabled()) return NextResponse.json({ ok: true }, { headers: privateHeaders });
  try {
    requireAlertConfig();
    await enqueuePriceItem(match[1]);
  } catch {
    // Never acknowledge a relevant event before it is durable. Mercado Libre can retry.
    console.error('price_alert_webhook_enqueue_failed');
    return NextResponse.json({ ok: false }, { status: 503, headers: privateHeaders });
  }
  after(runPriceAlertWorkSafely);
  return NextResponse.json({ ok: true }, { headers: privateHeaders });
}
