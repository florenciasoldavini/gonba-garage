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
        src: '/brand/gonba-garage-logo-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/brand/gonba-garage-logo-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
