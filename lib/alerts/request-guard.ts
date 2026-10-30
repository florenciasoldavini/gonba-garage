import 'server-only';
import { NextResponse } from 'next/server';

// The host the browser actually addressed. `request.url` is not reliable for this: `next start`
// builds it from its own hostname and port, while proxies (Vercel, previews) forward the public host.
function requestHost(request: Request) {
  const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  return (forwarded || request.headers.get('host') || new URL(request.url).host).toLowerCase();
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin !== null) {
    try {
      return new URL(origin).host === requestHost(request);
    } catch {
      return false; // Includes the opaque `Origin: null`.
    }
  }
  // Browsers that omit Origin still label cross-site requests; non-browser clients send neither.
  return request.headers.get('sec-fetch-site') !== 'cross-site';
}

/**
 * Public signup endpoints only accept same-origin JSON. Requiring `application/json` forces a CORS
 * preflight, so other sites cannot auto-submit `text/plain` forms whose body happens to be JSON.
 */
export function rejectCrossSiteJson(request: Request) {
  const mediaType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return NextResponse.json({ message: 'La solicitud debe enviarse en formato JSON.' }, { status: 415 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: 'No pudimos verificar el origen de la solicitud.' }, { status: 403 });
  }
  return null;
}
