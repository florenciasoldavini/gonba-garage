import 'server-only';
import { createHash } from 'node:crypto';
import { privateHeaders } from './config';

const policy = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'";

/**
 * Minimal private page for emailed alert links: no-store, noindex, no external assets. An optional
 * inline script is allowed by its hash only, so the CSP still blocks any other script.
 */
export function alertPage(title: string, content: string, status = 200, script?: string) {
  const csp = script ? `${policy}; script-src 'sha256-${createHash('sha256').update(script).digest('base64')}'` : policy;
  const headers = { ...privateHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp };
  return new Response(`<!doctype html><html lang="es-AR"><head><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Gonba's Garage</title></head><body style="background:#11150f;color:#f5f6ef;font-family:Arial,sans-serif;padding:40px 20px"><main style="max-width:520px;margin:auto"><h1>${title}</h1>${content}</main>${script ? `<script>${script}</script>` : ''}</body></html>`, { status, headers });
}

const button = (label: string) => `<button style="padding:14px 20px;background:#dcff00;color:#11150f;border:0;border-radius:8px;font-weight:bold;cursor:pointer">${label}</button>`;

export const alertPageButton = (label: string) => `<form method="post">${button(label)}</form>`;

/**
 * A form that the browser submits on load. Link scanners fetch the page without running scripts,
 * so they never send the POST. The button appears only when JavaScript is disabled.
 */
export const alertPageAutoSubmit = (label: string) => `<form method="post"><noscript>${button(label)}</noscript></form>`;
export const autoSubmitScript = 'document.forms[0].submit()';
