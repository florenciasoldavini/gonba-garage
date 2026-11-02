import 'server-only';

import { failure, providerFailure } from './failures';

/** The JSON body of a Mercado Libre response, or the safe incident of its failure. */
export async function parseMercadoLibreResponse<T>(response: Response, operation: string) {
  const stage = operation === 'Mercado Libre token refresh' ? 'token_refresh'
    : operation === 'Mercado Libre authorization-code exchange' ? 'authorization_exchange' : 'catalog_query';
  if (!response.ok) {
    throw await providerFailure(response, stage);
  }

  return response.json().catch(() => { throw failure(stage === 'token_refresh' ? 'token_response' : stage, 'invalid_response'); }) as Promise<T>;
}
