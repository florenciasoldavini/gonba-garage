import assert from 'node:assert/strict';
import { beforeEach, describe, it, vi } from 'vitest';
import { readMercadoLibreCategoryPath } from '@/lib/integrations/mercado-libre/api';
import {
  exchangeMercadoLibreAuthorizationCode,
  refreshMercadoLibreToken,
} from '@/lib/integrations/mercado-libre/oauth';

const incidentOf = async promise => {
  const error = await promise.then(
    () => assert.fail('Expected a failure'),
    error => error,
  );
  return { stage: error.incident.stage, code: error.incident.code, httpStatus: error.incident.httpStatus };
};
const respondWith = response => vi.stubGlobal('fetch', async () => response.clone());
const rejected = () => Response.json({ error: 'invalid_grant' }, { status: 400 });
const unreadable = () => new Response('not json', { status: 200 });

// Each call names the stage its failures report.
describe('Mercado Libre response stages', () => {
  beforeEach(() => {
    vi.stubEnv('MERCADO_LIBRE_CLIENT_ID', '1234');
    vi.stubEnv('MERCADO_LIBRE_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('MERCADO_LIBRE_REDIRECT_URI', 'https://example.test/api/mercado-libre/callback');
  });

  it('reports the token refresh, and its unreadable body as the token response', async () => {
    respondWith(rejected());
    assert.deepEqual(await incidentOf(refreshMercadoLibreToken('refresh')), {
      stage: 'token_refresh',
      code: 'http_error',
      httpStatus: 400,
    });
    respondWith(unreadable());
    assert.deepEqual(await incidentOf(refreshMercadoLibreToken('refresh')), {
      stage: 'token_response',
      code: 'invalid_response',
      httpStatus: undefined,
    });
  });

  it('reports the authorization-code exchange', async () => {
    respondWith(rejected());
    assert.deepEqual(await incidentOf(exchangeMercadoLibreAuthorizationCode('code', 'verifier')), {
      stage: 'authorization_exchange',
      code: 'http_error',
      httpStatus: 400,
    });
    respondWith(unreadable());
    assert.deepEqual(await incidentOf(exchangeMercadoLibreAuthorizationCode('code', 'verifier')), {
      stage: 'authorization_exchange',
      code: 'invalid_response',
      httpStatus: undefined,
    });
  });

  it('reports read API calls as the catalog query', async () => {
    respondWith(new Response(null, { status: 503 }));
    assert.deepEqual(await incidentOf(readMercadoLibreCategoryPath('MLA1744', 'access-token')), {
      stage: 'catalog_query',
      code: 'http_error',
      httpStatus: 503,
    });
    respondWith(unreadable());
    assert.deepEqual(await incidentOf(readMercadoLibreCategoryPath('MLA1744', 'access-token')), {
      stage: 'catalog_query',
      code: 'invalid_response',
      httpStatus: undefined,
    });
  });

  it('fails without the client configuration before calling Mercado Libre', async () => {
    vi.stubEnv('MERCADO_LIBRE_CLIENT_SECRET', undefined);
    vi.stubGlobal('fetch', async () => assert.fail('Mercado Libre must not be called'));
    assert.deepEqual(await incidentOf(refreshMercadoLibreToken('refresh')), {
      stage: 'configuration',
      code: 'missing_configuration',
      httpStatus: undefined,
    });
  });
});
