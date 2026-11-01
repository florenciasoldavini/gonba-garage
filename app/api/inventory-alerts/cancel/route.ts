import { parseSearchCancellationToken } from '@/lib/alerts/cancellation';
import { cancelInventoryAlert } from '@/lib/alerts/inventory-delivery';
import { alertPage as page, alertPageButton } from '@/lib/alerts/page';

export const runtime = 'nodejs';
function readToken(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  try { return parseSearchCancellationToken(token); } catch { return null; }
}
// Email security scanners may follow GET links. Only a deliberate POST changes the subscription,
// including the RFC 8058 one-click POST that mail apps send from the List-Unsubscribe header.
export async function GET(request: Request) {
  if (!readToken(request)) return page('Enlace no válido', '<p>No pudimos validar este enlace de cancelación.</p>', 400);
  return page('Cancelar alerta de búsqueda', `<p>Dejarás de recibir avisos de autos que coincidan con esta búsqueda. Tus otras alertas seguirán activas.</p>${alertPageButton('Cancelar esta alerta')}`);
}
export async function POST(request: Request) {
  const token = readToken(request);
  if (!token) return page('Enlace no válido', '<p>No pudimos validar este enlace de cancelación.</p>', 400);
  try {
    await cancelInventoryAlert(token.id, token.generation);
    return page('Alerta cancelada', '<p>No recibirás más avisos de esta búsqueda. Un correo que ya estaba saliendo podría llegar igualmente.</p>');
  } catch {
    return page('No pudimos cancelar la alerta', '<p>Volvé a intentarlo en unos minutos.</p>', 503);
  }
}
