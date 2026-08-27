import { createElement } from 'react';
import { ImageResponse } from 'next/og';

import { findMockVehicle } from '@/features/vehicles/data/mock-vehicles';
import { formatVehiclePrice } from '@/features/vehicles/presentation/formatters';
import { getVehicleStatusPresentation } from '@/features/vehicles/presentation/status';

type VehicleSocialImageRouteProps = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: VehicleSocialImageRouteProps) {
  const { slug } = await params;
  const vehicle = findMockVehicle(slug);

  if (!vehicle) return new Response('Vehicle not found', { status: 404 });

  const status = getVehicleStatusPresentation(vehicle.status);
  const imageUrl = new URL(vehicle.image, request.url).toString();

  const image = createElement(
    'div',
    {
      style: {
        background: '#080a09',
        color: '#f5f6f2',
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      },
    },
    createElement('img', {
      alt: '',
      src: imageUrl,
      style: {
        height: '100%',
        left: 0,
        objectFit: 'cover',
        position: 'absolute',
        top: 0,
        width: '100%',
      },
    }),
    createElement('div', {
      style: {
        background: 'linear-gradient(90deg, rgba(8,10,9,0.98) 0%, rgba(8,10,9,0.88) 44%, rgba(8,10,9,0.12) 78%, rgba(8,10,9,0.28) 100%)',
        display: 'flex',
        height: '100%',
        left: 0,
        position: 'absolute',
        top: 0,
        width: '100%',
      },
    }),
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'space-between',
          padding: '58px 64px',
          position: 'relative',
          width: '100%',
        },
      },
      createElement(
        'div',
        { style: { alignItems: 'center', display: 'flex', justifyContent: 'space-between' } },
        createElement(
          'div',
          { style: { display: 'flex', fontSize: 30, fontWeight: 900, letterSpacing: '-1.5px' } },
          "GONBA'S ",
          createElement('span', { style: { color: '#dcff00', marginLeft: 8 } }, 'GARAGE'),
        ),
        createElement(
          'div',
          {
            style: {
              alignItems: 'center',
              background: 'rgba(8,10,9,0.72)',
              border: '1px solid rgba(220,255,0,0.55)',
              borderRadius: 999,
              display: 'flex',
              fontSize: 18,
              letterSpacing: '1px',
              padding: '12px 20px',
              textTransform: 'uppercase',
            },
          },
          status.label,
        ),
      ),
      createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', maxWidth: 720 } },
        createElement(
          'div',
          { style: { color: '#dcff00', display: 'flex', fontSize: 22, letterSpacing: '2px', marginBottom: 14, textTransform: 'uppercase' } },
          `${vehicle.year} · ${vehicle.version}`,
        ),
        createElement(
          'div',
          { style: { display: 'flex', fontSize: 76, fontWeight: 800, letterSpacing: '-4px', lineHeight: 0.95 } },
          `${vehicle.make} ${vehicle.model}`,
        ),
        createElement(
          'div',
          { style: { alignItems: 'center', display: 'flex', marginTop: 30 } },
          createElement(
            'div',
            { style: { borderTop: '5px solid #dcff00', display: 'flex', fontSize: 30, fontWeight: 700, paddingTop: 16 } },
            formatVehiclePrice(vehicle.price, vehicle.currency),
          ),
          createElement(
            'div',
            { style: { color: 'rgba(245,246,242,0.76)', display: 'flex', fontSize: 18, marginLeft: 28, paddingTop: 16 } },
            vehicle.location,
          ),
        ),
      ),
    ),
  );

  return new ImageResponse(image, {
    width: 1200,
    height: 630,
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
