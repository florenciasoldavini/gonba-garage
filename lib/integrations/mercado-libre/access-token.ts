import 'server-only';
import { required, withRefreshToken } from './credentials';
import { refreshMercadoLibreToken } from './oauth';

// Ephemeral per-instance cache only. Neither access tokens nor inventory are persisted.
let current: { value: string; expiresAt: number } | undefined;
let pending: Promise<string> | undefined;

export async function catalogAccessToken() {
  if (current && current.expiresAt > Date.now()) return current.value;
  if (!pending) pending = withRefreshToken(async (refreshToken, save) => {
    const token = await refreshMercadoLibreToken(refreshToken);
    if (String(token.user_id) !== required('MERCADO_LIBRE_SELLER_ID') || !token.refresh_token) throw new Error('Unexpected token response');
    await save(token.refresh_token);
    current = { value: token.access_token, expiresAt: Date.now() + Math.max(0, token.expires_in - 60) * 1000 };
    return token.access_token;
  }).finally(() => { pending = undefined; });
  return pending;
}
