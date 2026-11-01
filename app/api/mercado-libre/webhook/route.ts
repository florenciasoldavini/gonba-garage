import { after, NextResponse } from 'next/server';
import { alertEmailsConfigured, privateHeaders, requireAlertConfig } from '@/lib/alerts/config';
import { isAlertsDatabaseConfigured } from '@/lib/alerts/database';
import { runInventoryAlertWorkSafely } from '@/lib/alerts/inventory-delivery';
import { enqueuePriceItem, runPriceAlertWorkSafely } from '@/lib/alerts/price-delivery';
import { enqueueCatalogSync, runCatalogSyncWorkSafely } from '@/lib/integrations/mercado-libre/inventory-sync';

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
  const catalogSync = isAlertsDatabaseConfigured();
  const priceAlerts = alertEmailsConfigured();
  if (!catalogSync && !priceAlerts) return NextResponse.json({ ok: true }, { headers: privateHeaders });
  try {
    // The payload is only a hint: both queues read the item again from Mercado Libre.
    if (catalogSync) await enqueueCatalogSync(match[1]);
    if (priceAlerts) {
      requireAlertConfig();
      await enqueuePriceItem(match[1]);
    }
  } catch {
    // Never acknowledge a relevant event before it is durable. Mercado Libre can retry.
    console.error('mercado_libre_webhook_enqueue_failed');
    return NextResponse.json({ ok: false }, { status: 503, headers: privateHeaders });
  }
  // Search alerts match what the sync just saved, so they run after it, within the same function.
  const searchAlerts = catalogSync && alertEmailsConfigured();
  const deadline = Date.now() + 270_000;
  after(() => Promise.all([
    catalogSync && runCatalogSyncWorkSafely()
      .then(() => searchAlerts ? runInventoryAlertWorkSafely({ budgetMs: deadline - Date.now() }) : undefined),
    priceAlerts && runPriceAlertWorkSafely(),
  ]));
  return NextResponse.json({ ok: true }, { headers: privateHeaders });
}
