import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gonba's Garage",
    short_name: "Gonba's Garage",
    description: 'Autos usados seleccionados en Buenos Aires.',
    start_url: '/',
    display: 'standalone',
    background_color: '#080a09',
    theme_color: '#080a09',
    lang: 'es-AR',
    categories: ['automotive', 'business', 'shopping'],
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/brand/gonba-garage-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/brand/gonba-garage-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        // Full-bleed background with the GG inside Android's circular safe zone.
        src: '/brand/gonba-garage-icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
