import { after, NextResponse } from 'next/server';
import { alertEmailsConfigured, privateHeaders, requireAlertConfig } from '@/lib/alerts/config';
import { isDatabaseConfigured } from '@/lib/database';
import { mercadoLibreEnv } from '@/lib/env';
import { runInventoryAlertWorkSafely } from '@/lib/alerts/inventory-delivery';
import { enqueuePriceItem, runPriceAlertWorkSafely } from '@/lib/alerts/price-delivery';
import { enqueueCatalogSync, runCatalogSyncWorkSafely } from '@/lib/integrations/mercado-libre/inventory-sync';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Whether the notification comes from an address in MERCADO_LIBRE_WEBHOOK_IPS (comma-separated,
 * from Mercado Libre's published list). Unset, as locally and in tests, every source counts as
 * listed. Vercel sets x-vercel-forwarded-for to the connecting address itself; the first
 * x-forwarded-for entry is not used.
 */
function fromListedAddress(request: Request) {
  const listed = mercadoLibreEnv.webhookIps();
  if (!listed.length) return true;
  const address = request.headers.get('x-vercel-forwarded-for')?.trim().replace(/^::ffff:/, '') ?? '';
  if (listed.includes(address)) return true;
  // The address shows whether Mercado Libre started using one that is missing from the list.
  console.warn(JSON.stringify({ event: 'mercado_libre_webhook_unlisted_address', address: address.slice(0, 64) }));
  return false;
}

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
  const sellerId = mercadoLibreEnv.sellerId(), clientId = mercadoLibreEnv.clientId();
  if (!match || !['items', 'items_prices'].includes(String(notification.topic))
    || !sellerId || String(notification.user_id) !== sellerId || !clientId || String(notification.application_id) !== clientId) {
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  }
  const catalogSync = isDatabaseConfigured();
  const priceAlerts = alertEmailsConfigured();
  if (!catalogSync && !priceAlerts) return NextResponse.json({ ok: true }, { headers: privateHeaders });
  // An unlisted address is still queued, so an outdated list delays a genuine notification until the
  // daily crons but never loses it. It just starts no work here.
  const verified = fromListedAddress(request);
  let drainCatalog = false, drainPrices = false;
  try {
    // The payload is only a hint: both queues read the item again from Mercado Libre.
    if (catalogSync) drainCatalog = await enqueueCatalogSync(match[1], { verified });
    if (priceAlerts) {
      requireAlertConfig();
      drainPrices = await enqueuePriceItem(match[1]) && verified;
    }
  } catch {
    // Never acknowledge a relevant event before it is durable. Mercado Libre can retry.
    console.error('mercado_libre_webhook_enqueue_failed');
    return NextResponse.json({ ok: false }, { status: 503, headers: privateHeaders });
  }
  // A duplicate of work already queued (Mercado Libre sends many) needs no drain of its own.
  if (!drainCatalog && !drainPrices) return NextResponse.json({ ok: true }, { headers: privateHeaders });
  // Search alerts match what the sync just saved, so they run after it, within the same function.
  const searchAlerts = catalogSync && alertEmailsConfigured();
  const deadline = Date.now() + 270_000;
  after(() => Promise.all([
    drainCatalog && runCatalogSyncWorkSafely()
      .then(() => searchAlerts ? runInventoryAlertWorkSafely({ budgetMs: deadline - Date.now() }) : undefined),
    drainPrices && runPriceAlertWorkSafely(),
  ]));
  return NextResponse.json({ ok: true }, { headers: privateHeaders });
}
