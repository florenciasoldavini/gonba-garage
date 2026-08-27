import 'server-only';

import { NextResponse } from 'next/server';

import {
  ARG_AUTOS_CACHE_SECONDS,
  fetchVehicleCatalog,
  type CatalogResource,
} from '@/lib/integrations/arg-autos/catalog';

const isPositiveInteger = (value: string | null) =>
  value !== null && /^\d+$/.test(value) && Number(value) > 0;

function getCatalogQuery(searchParams: URLSearchParams) {
  const resource = searchParams.get('resource') as CatalogResource | null;

  if (resource === 'brands') return { resource };

  if (resource === 'models') {
    const brandId = searchParams.get('brandId');
    return isPositiveInteger(brandId) ? { resource, parentId: brandId } : null;
  }

  if (resource === 'versions') {
    const modelId = searchParams.get('modelId');
    return isPositiveInteger(modelId) ? { resource, parentId: modelId } : null;
  }

  return null;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const query = getCatalogQuery(searchParams);

  if (!query) {
    return NextResponse.json({ message: 'La consulta del catálogo no es válida.' }, { status: 400 });
  }

  try {
    const options = await fetchVehicleCatalog(query.resource, query.parentId ?? undefined);
    return NextResponse.json(
      { options },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${ARG_AUTOS_CACHE_SECONDS}, stale-while-revalidate=${ARG_AUTOS_CACHE_SECONDS * 7}`,
        },
      },
    );
  } catch (error) {
    console.error('Unable to load Arg Autos catalog', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { message: 'No pudimos cargar el catálogo de vehículos.' },
      { status: 503 },
    );
  }
}
