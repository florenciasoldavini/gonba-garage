import 'server-only';
import { alertOrigin } from './config';
import { cancellationUrl } from './cancellation';

export type AlertEmail = {
  id: string; generation: string; email: string; kind: 'welcome' | 'drop';
  title: string; vehicle_slug: string; price: number; previous_price: number; currency: string;
};
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (price: number, currency: string) => `${currency === 'USD' ? 'USD' : 'ARS'} ${Number(price).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

/** Shared by the worker and the sample sender. No tracking pixels or external assets. */
export function buildAlertEmail(input: AlertEmail) {
  const welcome = input.kind === 'welcome';
  const title = input.title || 'El vehículo que seguís';
  const subject = welcome ? 'Tu alerta de precio está activa' : `Bajó de precio: ${title}`;
  const price = money(input.price, input.currency);
  const detail = welcome
    ? `Te vamos a avisar cuando ${title} baje de ${price}. Después de cada aviso, seguiremos atentos a nuevas bajas.`
    : `${title} bajó de ${money(input.previous_price, input.currency)} a ${price}. Tu alerta sigue activa para futuras bajas.`;
  const url = `${alertOrigin()}/vehiculos/${encodeURIComponent(input.vehicle_slug)}`;
  const cancel = cancellationUrl(input.id, input.generation);
  const footer = welcome ? '¿No solicitaste esta alerta? Podés cancelarla acá.' : 'Podés dejar de recibir esta alerta cuando quieras.';
  const text = `GONBA'S GARAGE\n\n${subject}\n\n${detail}\n\nVer vehículo: ${url}\n\n${footer}\nCancelar alerta: ${cancel}`;
  const html = `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head><body style="margin:0;background:#f4f5f0;color:#171a16;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="560" style="width:100%;max-width:560px" cellspacing="0" cellpadding="0"><tr><td style="padding:28px;background:#11150f;color:#ffffff;font-size:20px;font-weight:bold">GONBA'S <span style="color:#dcff00">GARAGE</span></td></tr><tr><td style="padding:32px;background:#ffffff"><h1 style="margin:0 0 20px;font-size:26px;line-height:1.25">${escape(subject)}</h1><p style="font-size:16px;line-height:1.7">${escape(detail)}</p><p style="margin:28px 0"><a href="${escape(url)}" style="display:inline-block;padding:15px 22px;background:#dcff00;color:#171a16;font-weight:bold;text-decoration:none;border-radius:8px">Ver vehículo</a></p><p style="font-size:14px;line-height:1.6;color:#4a5145">${escape(footer)} <a href="${escape(cancel)}" style="color:#171a16">Cancelar alerta</a></p></td></tr></table></td></tr></table></body></html>`;
  return { from: process.env.ALERTS_EMAIL_FROM || '', to: [input.email], subject, html, text,
    headers: { 'List-Unsubscribe': `<${cancel}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
}

export class EmailFailure extends Error {
  constructor(public code: string, public retryable: boolean) { super(code); }
}
export async function sendAlertEmail(payload: ReturnType<typeof buildAlertEmail>, key: string) {
  const allowlist = process.env.ALERTS_TEST_RECIPIENT;
  if (allowlist && payload.to.some(email => email !== allowlist)) throw new EmailFailure('test_recipient_blocked', false);
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000),
    });
  } catch { throw new EmailFailure('provider_network', true); }
  if (!response.ok) throw new EmailFailure(`provider_http_${response.status}`, response.status === 429 || response.status >= 500 || response.status === 409);
  const result = await response.json() as { id?: unknown };
  if (typeof result.id !== 'string') throw new EmailFailure('provider_invalid_response', true);
  return result.id;
}
