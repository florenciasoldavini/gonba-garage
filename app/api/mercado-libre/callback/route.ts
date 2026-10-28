import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isLiveCatalog, setLocalCatalogSession } from '@/lib/integrations/mercado-libre/catalog';

import {
  exchangeMercadoLibreAuthorizationCode,
  readMercadoLibrePublications,
  securelyMatches,
} from '@/lib/integrations/mercado-libre/oauth';

const responseHeaders = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

function diagnosticResponse(body: object, status: number) {
  const response = NextResponse.json(body, { status, headers: responseHeaders });
  response.cookies.delete('meli_oauth_state');
  response.cookies.delete('meli_pkce_verifier');
  return response;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const authorizationError = searchParams.get('error');

  if (authorizationError) {
    return diagnosticResponse(
      {
        ok: false,
        message: 'Mercado Libre no autorizó la lectura.',
        error: authorizationError,
      },
      400,
    );
  }

  const code = searchParams.get('code');
  const returnedState = searchParams.get('state');
  const cookieStore = await cookies();
  const expectedState = cookieStore.get('meli_oauth_state')?.value;
  const verifier = cookieStore.get('meli_pkce_verifier')?.value;

  if (
    !code ||
    !returnedState ||
    !expectedState ||
    !verifier ||
    !securelyMatches(returnedState, expectedState)
  ) {
    return diagnosticResponse(
      {
        ok: false,
        message: 'La respuesta OAuth no superó la validación de seguridad. Iniciá una prueba nueva.',
      },
      400,
    );
  }

  try {
    const token = await exchangeMercadoLibreAuthorizationCode(code, verifier);
    if (process.env.NODE_ENV === 'development' && isLiveCatalog()) {
      setLocalCatalogSession(token.access_token, token.expires_in);
      const response = NextResponse.redirect(new URL('/vehiculos', request.url));
      response.cookies.delete('meli_oauth_state');
      response.cookies.delete('meli_pkce_verifier');
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
    const result = await readMercadoLibrePublications(token.access_token);

    return diagnosticResponse(
      {
        ok: true,
        message: 'Mercado Libre permitió leer las publicaciones correctamente.',
        ...result,
        security: {
          tokensStored: false,
          tokensReturned: false,
        },
      },
      200,
    );
  } catch (error) {
    console.error(
      'Mercado Libre read test failed',
      error instanceof Error ? error.message : error,
    );
    return diagnosticResponse(
      {
        ok: false,
        message: 'La autorización llegó, pero no pudimos leer las publicaciones.',
      },
      502,
    );
  }
}
