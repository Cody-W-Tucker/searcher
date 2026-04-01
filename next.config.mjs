import pkg from './package.json' with { type: 'json' };

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    prerenderEarlyExit: false,
    staticGenerationRetryCount: 0,
    staticGenerationMaxConcurrency: 1,
  },
  images: {
    remotePatterns: [
      {
        hostname: 's2.googleusercontent.com',
      },
    ],
  },
  serverExternalPackages: ['pdf-parse'],
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/@napi-rs/canvas/**',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**',
      './node_modules/@napi-rs/canvas-linux-x64-musl/**',
    ],
  },
  env: {
    NEXT_PUBLIC_VERSION: pkg.version,
  },
};

export default nextConfig;
