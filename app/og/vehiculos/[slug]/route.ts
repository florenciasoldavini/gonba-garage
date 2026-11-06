import { readFile } from 'node:fs/promises';
import { extname, join, sep } from 'node:path';
import { createElement } from 'react';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';

import { BUSINESS_AREA_LABEL } from '@/constants/contact';
import { findCatalogVehicle } from '@/lib/integrations/mercado-libre/catalog';
import { mercadoLibreJpegUrl } from '@/lib/integrations/mercado-libre/pictures';
import { formatVehiclePrice } from '@/features/vehicles/presentation/formatters';
import { getVehicleStatusPresentation } from '@/features/vehicles/presentation/status';

type VehicleSocialImageRouteProps = {
  params: Promise<{ slug: string }>;
};

const publicDirectory = join(process.cwd(), 'public');
const logoMarkPath = join(publicDirectory, 'brand', 'gonba-garage-logo-mark.png');
// ImageResponse can't read the site's woff2 variable fonts, so these are static woff cuts of the same Geist.
const fontsDirectory = join(process.cwd(), 'app', 'fonts');
const [geistRegular, geistBold, geistMonoSemiBold] = await Promise.all(
  ['geist-sans-latin-400.woff', 'geist-sans-latin-700.woff', 'geist-mono-latin-600.woff'].map(file =>
    readFile(join(fontsDirectory, file)),
  ),
);
// The same badge the site shows for each status.
const statusBadgeStyles = {
  active: { background: '#dcff00', color: '#151a00' },
  paused: { background: 'rgba(6,8,6,0.77)', border: '1px solid rgba(220,255,0,0.7)', color: '#dcff00' },
  sold: { background: '#f5f6f2', color: '#080a09' },
};
const localImageContentTypes: Record<string, string> = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
};

// ImageResponse refuses to fetch private addresses (SSRF protection), which includes this
// app's own origin during local runs. Local photos are embedded from public/ instead.
async function resolveVehicleImageSource(image: string, requestUrl: string) {
  const contentType = localImageContentTypes[extname(image).toLowerCase()];
  const filePath = join(publicDirectory, image);
  const isLocalPublicFile =
    image.startsWith('/') && !image.startsWith('//') && filePath.startsWith(`${publicDirectory}${sep}`);

  if (!contentType || !isLocalPublicFile) return new URL(image, requestUrl).toString();

  const bytes = await readFile(filePath);
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

export async function GET(request: Request, { params }: VehicleSocialImageRouteProps) {
  const { slug } = await params;
  const vehicle = await findCatalogVehicle(slug);

  if (!vehicle) return new Response('Vehicle not found', { status: 404 });

  const status = getVehicleStatusPresentation(vehicle);
  // A sold car's last price is not current, so the card leaves it out.
  const isSold = status.status === 'sold';
  const imageUrl = await resolveVehicleImageSource(mercadoLibreJpegUrl(vehicle.image) ?? vehicle.image, request.url);
  const logoSource = `data:image/png;base64,${(await readFile(logoMarkPath)).toString('base64')}`;

  const image = createElement(
    'div',
    {
      style: {
        background: '#080a09',
        color: '#f5f6f2',
        display: 'flex',
        fontFamily: 'Geist',
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
        borderRadius: 26,
        height: 574,
        objectFit: 'cover',
        position: 'absolute',
        right: 28,
        top: 28,
        width: 680,
        ...(status.isAvailable ? {} : { filter: 'grayscale(1) brightness(0.72)' }),
      },
    }),
    createElement(
      'div',
      {
        style: {
          alignItems: 'center',
          borderRadius: 7,
          display: 'flex',
          fontFamily: 'Geist Mono',
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: '0.04em',
          padding: '9px 14px',
          position: 'absolute',
          right: 48,
          textTransform: 'uppercase',
          top: 48,
          ...statusBadgeStyles[status.status],
        },
      },
      status.label,
    ),
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'space-between',
          left: 0,
          padding: '54px 30px 54px 52px',
          position: 'absolute',
          top: 0,
          width: 480,
        },
      },
      createElement('img', {
        alt: "Gonba's Garage",
        src: logoSource,
        height: 46,
        width: 63,
        style: { height: 46, width: 63 },
      }),
      createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },
        createElement(
          'div',
          {
            style: {
              color: '#dcff00',
              display: 'flex',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '0.12em',
              lineHeight: 1.3,
              marginBottom: 16,
              textTransform: 'uppercase',
            },
          },
          `${vehicle.year} · ${vehicle.version}`,
        ),
        createElement(
          'div',
          { style: { display: 'flex', fontSize: 60, fontWeight: 700, letterSpacing: '-0.075em', lineHeight: 0.95 } },
          `${vehicle.make} ${vehicle.model}`,
        ),
        isSold
          ? null
          : createElement(
              'div',
              { style: { display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 22 } },
              formatVehiclePrice(vehicle.price, vehicle.currency),
            ),
        createElement(
          'div',
          { style: { color: 'rgba(245,246,242,0.76)', display: 'flex', fontSize: 18, marginTop: isSold ? 22 : 8 } },
          BUSINESS_AREA_LABEL,
        ),
      ),
    ),
  );

  const card = new ImageResponse(image, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Geist', data: geistRegular, style: 'normal', weight: 400 },
      { name: 'Geist', data: geistBold, style: 'normal', weight: 700 },
      { name: 'Geist Mono', data: geistMonoSemiBold, style: 'normal', weight: 600 },
    ],
  });

  // A photo card as PNG runs near 1 MB, and WhatsApp is reported to skip previews above about 300 KB.
  const jpeg = await sharp(Buffer.from(await card.arrayBuffer()))
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(jpeg), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
