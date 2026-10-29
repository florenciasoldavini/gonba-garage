import { getAlertsSql } from '@/lib/alerts/database';
import { parseCancellationToken } from '@/lib/alerts/cancellation';
import { privateHeaders } from '@/lib/alerts/config';

export const runtime = 'nodejs';
const headers = { ...privateHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" };
function page(title: string, content: string, status = 200) {
  return new Response(`<!doctype html><html lang="es-AR"><head><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Gonba's Garage</title></head><body style="background:#11150f;color:#f5f6ef;font-family:Arial,sans-serif;padding:40px 20px"><main style="max-width:520px;margin:auto"><h1>${title}</h1>${content}</main></body></html>`, { status, headers });
}
function readToken(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  try { return parseCancellationToken(token); } catch { return null; }
}
// Email security scanners may follow GET links. Only a deliberate POST changes the subscription.
export async function GET(request: Request) {
  if (!readToken(request)) return page('Enlace no válido', '<p>No pudimos validar este enlace de cancelación.</p>', 400);
  return page('Cancelar alerta de precio', '<p>Dejarás de recibir avisos de esta alerta. Tus otras alertas seguirán activas.</p><form method="post"><button style="padding:14px 20px;background:#dcff00;color:#11150f;border:0;border-radius:8px;font-weight:bold;cursor:pointer">Cancelar esta alerta</button></form>');
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
