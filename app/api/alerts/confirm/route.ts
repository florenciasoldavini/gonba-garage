import { after } from 'next/server';

import { privateHeaders } from '@/lib/alerts/config';
import { parseConfirmationToken } from '@/lib/alerts/confirmation';
import { alertPage as page, alertPageAutoSubmit, autoSubmitScript } from '@/lib/alerts/page';
import { confirmPriceAlert, runPriceAlertWorkSafely } from '@/lib/alerts/price-delivery';
import { confirmInventorySubscription } from '@/lib/alerts/subscriptions';

export const runtime = 'nodejs';
type Outcome = 'confirmada' | 'vencido' | 'no-valido' | 'error';
/**
 * Every outcome ends on the site's result page. The relative Location never depends on request
 * hosts, and the query carries no token or email: only the outcome, alert type and public slug.
 */
function result(estado: Outcome, details: Record<string, string> = {}) {
  const query = new URLSearchParams({ estado, ...details });
  return new Response(null, { status: 303, headers: { ...privateHeaders, Location: `/alertas/confirmacion?${query}` } });
}
function readToken(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  try { return parseConfirmationToken(token); } catch { return null; }
}
// Email security scanners follow GET links, so GET never activates anything. In a browser the page
// posts itself immediately, so one click on the email link ends on the confirmation result.
export async function GET(request: Request) {
  const token = readToken(request);
  if (!token) return result('no-valido');
  if (token.expired) return result('vencido');
  return page('Confirmando tu alerta', `<p>Un momento…</p>${alertPageAutoSubmit('Confirmar esta alerta')}`, 200, autoSubmitScript);
}
export async function POST(request: Request) {
  const token = readToken(request);
  if (!token) return result('no-valido');
  if (token.expired) return result('vencido');
  try {
    if (token.scope === 'inventory') {
      return await confirmInventorySubscription(token.id, token.generation) ? result('confirmada', { tipo: 'busqueda' }) : result('no-valido');
    }
    const vehicleSlug = await confirmPriceAlert(token.id, token.generation);
    // A cancelled or re-created subscription has another generation, so this link no longer applies.
    if (!vehicleSlug) return result('no-valido');
    after(runPriceAlertWorkSafely);
    return result('confirmada', { tipo: 'precio', vehiculo: vehicleSlug });
  } catch {
    return result('error');
  }
}
