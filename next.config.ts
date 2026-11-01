import type { NextConfig } from 'next';

// Features the site never uses. Clipboard, fullscreen and Web Share keep their browser defaults.
const permissionsPolicy = [
  'accelerometer=()',
  'browsing-topics=()',
  'camera=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'usb=()',
].join(', ');

// Framing and object/base/form restrictions only: a script-src policy would need per-request nonces
// for Next's inline bootstrap, the JSON-LD blocks and PostHog.
const contentSecurityPolicy = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: 'http2.mlstatic.com' }] },
  // The vehicle social card and Apple icon read local images from disk; ship them with the function.
  outputFileTracingIncludes: {
    '/og/vehiculos/*': ['./public/*.{jpg,jpeg}', './public/brand/gonba-garage-logo-mark.png'],
    '/apple-icon': ['./public/brand/gonba-garage-apple-icon.png'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: permissionsPolicy },
        ],
      },
      {
        // Config headers are written before a route handler's own headers, and Next skips a handler
        // header whose name is already set. API routes keep their stricter CSP and Referrer-Policy.
        source: '/:path((?!api(?:/|$)).*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
