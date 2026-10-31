/**
 * JSON requests from public forms. Failures come back as copy that can be shown as is: messages from
 * `fetch` or the JSON parser ("Failed to fetch", "Unexpected token '<'…") never reach the UI. Only a
 * `message` from one of our own JSON error responses is shown verbatim.
 */
export type RequestFailure = {
  /** connection: no response at all. server: a response we cannot use. api: our JSON error. */
  kind: 'connection' | 'server' | 'api';
  title: string;
  detail?: string;
  /** Sending the same request again may work. */
  retryable: boolean;
  /** Field the API rejected, when the error is about one. */
  field?: string;
};

export type JsonResult<T> = { ok: true; data: T } | { ok: false; failure: RequestFailure };

// A function that never answers would otherwise leave the form "Enviando…" until the browser gives up.
const requestTimeoutMs = 15_000;

const connectionFailure: RequestFailure = {
  kind: 'connection',
  title: 'No pudimos conectar.',
  detail: 'Revisá tu conexión y probá de nuevo.',
  retryable: true,
};

const serverFailure: RequestFailure = {
  kind: 'server',
  title: 'Tuvimos un problema de nuestro lado.',
  detail: 'Probá de nuevo en unos minutos.',
  retryable: true,
};

function isJsonResponse(response: Response) {
  return response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() === 'application/json';
}

/** Reads a response without throwing. HTML error pages, empty bodies and unreadable JSON become `server`. */
export async function readJsonResponse<T>(response: Response): Promise<JsonResult<T>> {
  let body: unknown = null;
  if (isJsonResponse(response)) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }

  if (response.ok) return body === null ? { ok: false, failure: serverFailure } : { ok: true, data: body as T };

  const { message, field } = (body && typeof body === 'object' ? body : {}) as { message?: unknown; field?: unknown };
  if (typeof message !== 'string' || !message.trim() || message.length > 300) return { ok: false, failure: serverFailure };

  return {
    ok: false,
    failure: {
      kind: 'api',
      title: message.trim(),
      // 4xx needs a different request; 503 means alerts are off, so retrying right away will not help.
      retryable: response.status >= 500 && response.status !== 503,
      ...(typeof field === 'string' ? { field } : {}),
    },
  };
}

/** POSTs JSON and never throws: offline, DNS errors and timeouts become `connection`. */
export async function postJson<T>(url: string, payload: unknown): Promise<JsonResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch {
    return { ok: false, failure: connectionFailure };
  }
  return readJsonResponse<T>(response);
}
