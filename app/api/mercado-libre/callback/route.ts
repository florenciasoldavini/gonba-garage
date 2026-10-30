import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { saveAuthorization } from '@/lib/integrations/mercado-libre/credentials';
import { reportIntegrationFailure } from '@/lib/integrations/mercado-libre/failures';

import {
  exchangeMercadoLibreAuthorizationCode,
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
    if (!token.refresh_token) throw new Error('Missing refresh token');
    await saveAuthorization(token.user_id, token.refresh_token);

    return diagnosticResponse(
      {
        ok: true,
        message: 'Conexión guardada. Ya podés probar el catálogo desde localhost.',
        security: {
          refreshTokenEncrypted: true,
          tokensReturned: false,
        },
      },
      200,
    );
  } catch (error) {
    const incident = reportIntegrationFailure(error, 'authorization_exchange');
    return diagnosticResponse(
      {
        ok: false,
        message: 'La autorización llegó, pero no pudimos leer las publicaciones.',
        incidentId: incident.incidentId,
      },
      502,
    );
  }
}
