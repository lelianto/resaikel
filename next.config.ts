import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['firebase-admin'],
  typedRoutes: false,
};

export default nextConfig;
