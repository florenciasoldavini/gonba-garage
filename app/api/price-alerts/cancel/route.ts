import { getAlertsSql } from '@/lib/alerts/database';
import { parseCancellationToken } from '@/lib/alerts/cancellation';
import { alertPage as page, alertPageButton } from '@/lib/alerts/page';

export const runtime = 'nodejs';
function readToken(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  try { return parseCancellationToken(token); } catch { return null; }
}
// Email security scanners may follow GET links. Only a deliberate POST changes the subscription.
export async function GET(request: Request) {
  if (!readToken(request)) return page('Enlace no válido', '<p>No pudimos validar este enlace de cancelación.</p>', 400);
  return page('Cancelar alerta de precio', `<p>Dejarás de recibir avisos de esta alerta. Tus otras alertas seguirán activas.</p>${alertPageButton('Cancelar esta alerta')}`);
}
export async function POST(request: Request) {
  const token = readToken(request);
  if (!token) return page('Enlace no válido', '<p>No pudimos validar este enlace de cancelación.</p>', 400);
  try {
    const sql = getAlertsSql();
    await sql`UPDATE public.vehicle_price_alerts SET status = 'cancelled', updated_at = now()
      WHERE id = ${token.id} AND generation = ${token.generation}`;
    await sql`UPDATE public.price_alert_deliveries SET state = 'cancelled'
      WHERE alert_id = ${token.id} AND generation = ${token.generation} AND state = 'pending'`;
    return page('Alerta cancelada', '<p>No recibirás más avisos de esta alerta. Un correo que ya estaba saliendo podría llegar igualmente.</p>');
  } catch {
    return page('No pudimos cancelar la alerta', '<p>Volvé a intentarlo en unos minutos.</p>', 503);
  }
}
