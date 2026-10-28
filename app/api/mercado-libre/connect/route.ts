import { NextResponse } from 'next/server';
import { authorized } from '@/lib/integrations/mercado-libre/credentials';

import {
  buildMercadoLibreAuthorizationUrl,
  createMercadoLibreOAuthAttempt,
} from '@/lib/integrations/mercado-libre/oauth';

const OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization') ?? '';
  let password = '';
  if (auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    password = decoded.slice(decoded.indexOf(':') + 1);
  }
  const basicRequest = new Request(request.url, { headers: { Authorization: `Bearer ${password}` } });
  if (!authorized(request) && !authorized(basicRequest)) {
    return NextResponse.json({ message: 'Acceso privado' }, { status: 401, headers: {
      'WWW-Authenticate': 'Basic realm="Gonba Garage", charset="UTF-8"',
      'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow',
    } });
  }
  try {
    const attempt = createMercadoLibreOAuthAttempt();
    const authorizationUrl = buildMercadoLibreAuthorizationUrl(attempt.state, attempt.challenge);
    const response = NextResponse.redirect(authorizationUrl);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
    };

    response.cookies.set('meli_oauth_state', attempt.state, cookieOptions);
    response.cookies.set('meli_pkce_verifier', attempt.verifier, cookieOptions);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');

    return response;
  } catch (error) {
    console.error(
      'Unable to start Mercado Libre read test',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { message: 'Faltan credenciales de Mercado Libre en el servidor.' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      },
    );
  }
}
