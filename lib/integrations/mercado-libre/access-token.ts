import 'server-only';
import { required, sharedAccessToken } from './credentials';
import { refreshMercadoLibreToken } from './oauth';
import { failure } from './failures';
import type { AccessToken } from './refresh-token-store';

// Per-instance first layer over the encrypted access token shared through the credential record.
let current: AccessToken | undefined;
let pending: Promise<AccessToken> | undefined;

export async function catalogAccessToken() {
  if (current && current.expiresAt > Date.now()) return current.value;
  pending ??= sharedAccessToken(async (refreshToken, save) => {
    const token = await refreshMercadoLibreToken(refreshToken);
    if (String(token.user_id) !== required('MERCADO_LIBRE_SELLER_ID')) throw failure('token_response', 'unexpected_seller');
    if (!token.refresh_token) throw failure('token_response', 'missing_refresh_token');
    if (!token.access_token || !Number.isFinite(token.expires_in) || token.expires_in <= 60) throw failure('token_response', 'invalid_response');
    const access = { value: token.access_token, expiresAt: Date.now() + (token.expires_in - 60) * 1000 };
    await save(token.refresh_token, access);
    return access;
  }).then(access => (current = access)).finally(() => { pending = undefined; });
  return (await pending).value;
}
