import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: 'http2.mlstatic.com' }] },
  // The vehicle social card reads local catalog photos from disk; ship them with the function.
  outputFileTracingIncludes: { '/og/vehiculos/*': ['./public/*.{jpg,jpeg}'] },
};

export default nextConfig;
