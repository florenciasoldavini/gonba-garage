import { NextResponse } from 'next/server';
import { authorized, required } from '@/lib/integrations/mercado-libre/credentials';
import { catalogAccessToken } from '@/lib/integrations/mercado-libre/access-token';
import { readMercadoLibrePublications, readMercadoLibrePublication } from '@/lib/integrations/mercado-libre/oauth';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers });
  const id = new URL(request.url).searchParams.get('item');
  if (id && !/^MLA\d+$/.test(id)) return NextResponse.json({ message: 'Invalid item' }, { status: 400, headers });
  try {
    const accessToken = await catalogAccessToken();
    const result = await (async () => {
      if (!id) {
        const catalog = await readMercadoLibrePublications(accessToken);
        return { vehicles: catalog.publications.items.map(({ vehicle }) => vehicle) };
      }
      const publication = await readMercadoLibrePublication(id, accessToken);
      if (String(publication.source.seller_id) !== required('MERCADO_LIBRE_SELLER_ID') || publication.vehicle.status !== 'active') return null;
      // Send only public listing presentation data. Never proxy private seller/account fields.
      return { vehicle: publication.vehicle, description: publication.description, source: {
        id: publication.source.id, title: publication.source.title,
        pictures: publication.source.pictures, attributes: publication.source.attributes,
        permalink: publication.source.permalink,
      } };
    })();
    return NextResponse.json(result, { status: result ? 200 : 404, headers });
  } catch {
    return NextResponse.json({ message: 'Catálogo temporalmente no disponible. Revisá la conexión del servidor.' }, { status: 503, headers });
  }
}
