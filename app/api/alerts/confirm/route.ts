import { after } from 'next/server';

import { parseConfirmationToken } from '@/lib/alerts/confirmation';
import { alertPage as page, alertPageButton } from '@/lib/alerts/page';
import { confirmPriceAlert, runPriceAlertWorkSafely } from '@/lib/alerts/price-delivery';
import { confirmInventorySubscription } from '@/lib/alerts/subscriptions';

export const runtime = 'nodejs';
const invalid = () => page('Enlace no válido', '<p>No pudimos validar este enlace de confirmación.</p>', 400);
const expired = () => page('El enlace venció', '<p>Volvé a crear la alerta desde el sitio y te enviaremos un enlace nuevo.</p>', 410);
function readToken(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  try { return parseConfirmationToken(token); } catch { return null; }
}
// Email security scanners may follow GET links. Only a deliberate POST activates the alert.
export async function GET(request: Request) {
  const token = readToken(request);
  if (!token) return invalid();
  if (token.expired) return expired();
  const detail = token.scope === 'price' ? 'Te avisaremos cuando baje el precio de este vehículo.' : 'Te avisaremos cuando ingresen vehículos que coincidan con tu búsqueda.';
  return page('Confirmar alerta', `<p>${detail}</p>${alertPageButton('Confirmar esta alerta')}`);
}
export async function POST(request: Request) {
  const token = readToken(request);
  if (!token) return invalid();
  if (token.expired) return expired();
  try {
    const active = token.scope === 'price'
      ? await confirmPriceAlert(token.id, token.generation)
      : await confirmInventorySubscription(token.id, token.generation);
    // A cancelled or re-created subscription has another generation, so this link no longer applies.
    if (!active) return page('Este enlace ya no es válido', '<p>La alerta fue cancelada o reemplazada. Podés crearla de nuevo desde el sitio.</p>', 410);
    if (token.scope === 'price') after(runPriceAlertWorkSafely);
    return page('Alerta confirmada', '<p>Listo, tu alerta está activa.</p>');
  } catch {
    return page('No pudimos confirmar la alerta', '<p>Volvé a intentarlo en unos minutos.</p>', 503);
  }
}
