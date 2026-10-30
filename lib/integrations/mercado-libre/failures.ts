import { randomUUID } from 'node:crypto';

const stages = ['configuration', 'credential_read', 'credential_decrypt', 'credential_lock',
  'token_refresh', 'token_response', 'credential_save', 'credential_diagnostics_save',
  'authorization_exchange', 'catalog_query', 'publication_diagnostics', 'catalog_sync'] as const;
const codes = ['operation_failed', 'timeout', 'network_error', 'http_error', 'invalid_response',
  'missing_configuration', 'not_connected', 'renewal_in_progress', 'renewal_interrupted',
  'unexpected_seller', 'missing_refresh_token', 'replacement_not_saved'] as const;
const providerCodes = ['invalid_grant', 'invalid_client', 'invalid_request', 'unauthorized_client',
  'invalid_token', 'access_denied', 'forbidden', 'too_many_requests'] as const;
export type FailureStage = typeof stages[number];
type FailureCode = typeof codes[number];
type ProviderCode = typeof providerCodes[number];

export type IntegrationIncident = {
  incidentId: string;
  occurredAt: string;
  stage: FailureStage;
  code: FailureCode;
  httpStatus?: number;
  providerCode?: ProviderCode;
};

export class IntegrationFailure extends Error {
  constructor(readonly incident: IntegrationIncident) {
    super(`${incident.stage}: ${incident.code}`);
    this.name = 'IntegrationFailure';
  }
}

export function failure(stage: FailureStage, code: FailureCode, details: Partial<Pick<IntegrationIncident,
  'incidentId' | 'httpStatus' | 'providerCode'>> = {}) {
  return new IntegrationFailure({ incidentId: randomUUID(), occurredAt: new Date().toISOString(), stage, code, ...details });
}

/** Never copy raw messages, causes, request URLs, response bodies or headers into diagnostics. */
export function safeFailure(error: unknown, stage: FailureStage, incidentId?: string): IntegrationFailure {
  if (error instanceof IntegrationFailure) {
    const clean = readSafeIncident(error.incident);
    if (clean) return new IntegrationFailure({ ...clean, ...(incidentId ? { incidentId } : {}) });
  }
  const name = error instanceof Error ? error.name : '';
  const isProviderRequest = ['token_refresh', 'authorization_exchange', 'catalog_query', 'publication_diagnostics', 'catalog_sync'].includes(stage);
  const code = name === 'AbortError' || name === 'TimeoutError' ? 'timeout'
    : error instanceof TypeError && isProviderRequest ? 'network_error' : 'operation_failed';
  const status = error && typeof error === 'object'
    ? 'status' in error ? error.status : 'statusCode' in error ? error.statusCode : undefined : undefined;
  return failure(stage, code, {
    ...(incidentId ? { incidentId } : {}),
    ...(typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? { httpStatus: status } : {}),
  });
}

/** Validate persisted metadata too; unknown fields and arbitrary provider text are discarded. */
export function readSafeIncident(value: unknown): IntegrationIncident | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.incidentId !== 'string' || !/^[a-f0-9-]{36}$/.test(record.incidentId)
    || typeof record.occurredAt !== 'string' || !Number.isFinite(Date.parse(record.occurredAt))
    || !stages.includes(record.stage as FailureStage) || !codes.includes(record.code as FailureCode)) return null;
  return {
    incidentId: record.incidentId, occurredAt: new Date(record.occurredAt).toISOString(),
    stage: record.stage as FailureStage, code: record.code as FailureCode,
    ...(typeof record.httpStatus === 'number' && Number.isInteger(record.httpStatus)
      && record.httpStatus >= 100 && record.httpStatus <= 599 ? { httpStatus: record.httpStatus } : {}),
    ...(providerCodes.includes(record.providerCode as ProviderCode) ? { providerCode: record.providerCode as ProviderCode } : {}),
  };
}

export async function providerFailure(response: Response, stage: FailureStage) {
  let code: unknown;
  try { code = (await response.json() as { error?: unknown }).error; } catch { /* Only the HTTP status is available. */ }
  return failure(stage, 'http_error', {
    httpStatus: response.status,
    ...(providerCodes.includes(code as ProviderCode) ? { providerCode: code as ProviderCode } : {}),
  });
}

export function reportIntegrationFailure(error: unknown, stage: FailureStage) {
  const incident = safeFailure(error, stage).incident;
  console.error(JSON.stringify({ event: 'mercado_libre_failure', ...incident }));
  return incident;
}
