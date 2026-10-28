import { NextResponse } from 'next/server';
import { authorized, required, readConnectionDiagnostics } from '@/lib/integrations/mercado-libre/credentials';
import { catalogAccessToken } from '@/lib/integrations/mercado-libre/access-token';
import { readPublicationDiagnostics } from '@/lib/integrations/mercado-libre/publication-diagnostics';
import { providerFailure, reportIntegrationFailure, safeFailure } from '@/lib/integrations/mercado-libre/failures';

export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers });
  try {
    if (new URL(request.url).searchParams.get('connection') === '1') {
      return NextResponse.json(await readConnectionDiagnostics(), { headers });
    }
    const deadline = AbortSignal.timeout(50_000);
    const token = await catalogAccessToken();
    const result = await readPublicationDiagnostics(required('MERCADO_LIBRE_SELLER_ID'), async <T,>(path: string): Promise<T> => {
      const response = await fetch(`https://api.mercadolibre.com${path}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: deadline,
      }).catch(error => { throw safeFailure(error, 'publication_diagnostics'); });
      if (!response.ok) throw await providerFailure(response, 'publication_diagnostics');
      return response.json() as Promise<T>;
    });
    return NextResponse.json(result, { status: result.complete ? 200 : 206, headers });
  } catch (error) {
    const incident = reportIntegrationFailure(error, 'publication_diagnostics');
    return NextResponse.json({ message: 'No se pudo completar la consulta de publicaciones. Volvé a intentar.', incidentId: incident.incidentId }, { status: 503, headers });
  }
}
