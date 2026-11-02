import 'server-only';

import { failure, providerFailure, type FailureStage } from './failures';

/**
 * The JSON body of a Mercado Libre response, or the safe incident of its failure: an error status
 * fails at `stage`, an unreadable body at `invalidResponseStage` (the token refresh reports that as
 * `token_response`).
 */
export async function parseMercadoLibreResponse<T>(response: Response, stage: FailureStage, invalidResponseStage = stage) {
  if (!response.ok) {
    throw await providerFailure(response, stage);
  }

  return response.json().catch(() => { throw failure(invalidResponseStage, 'invalid_response'); }) as Promise<T>;
}
