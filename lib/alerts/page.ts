import 'server-only';
import { privateHeaders } from './config';

const headers = { ...privateHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" };

/** Minimal private page for emailed alert links: no-store, noindex, no scripts or external assets. */
export function alertPage(title: string, content: string, status = 200) {
  return new Response(`<!doctype html><html lang="es-AR"><head><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Gonba's Garage</title></head><body style="background:#11150f;color:#f5f6ef;font-family:Arial,sans-serif;padding:40px 20px"><main style="max-width:520px;margin:auto"><h1>${title}</h1>${content}</main></body></html>`, { status, headers });
}

export const alertPageButton = (label: string) => `<form method="post"><button style="padding:14px 20px;background:#dcff00;color:#11150f;border:0;border-radius:8px;font-weight:bold;cursor:pointer">${label}</button></form>`;
