import { NextResponse } from 'next/server';
import { authorized } from '@/lib/integrations/mercado-libre/credentials';
import { findCatalogPublication, listActiveCatalogVehicles } from '@/lib/catalog/store';
import { reportIntegrationFailure } from '@/lib/integrations/mercado-libre/failures';

export const runtime = 'nodejs';
// Served from the synced database copy, never from Mercado Libre. Keep it out of shared HTTP caches.
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers });
  const id = new URL(request.url).searchParams.get('item');
  if (id && !/^MLA\d+$/.test(id)) return NextResponse.json({ message: 'Invalid item' }, { status: 400, headers });
  try {
    const result = id ? await findCatalogPublication(id) : { vehicles: await listActiveCatalogVehicles() };
    return NextResponse.json(result, { status: result ? 200 : 404, headers });
  } catch (error) {
    const incident = reportIntegrationFailure(error, 'catalog_query');
    return NextResponse.json({ message: 'Catálogo temporalmente no disponible. Revisá la conexión del servidor.', incidentId: incident.incidentId }, { status: 503, headers });
  }
}
