
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_GENKIT_CONFIGURED: (!!(
      process.env.GOOGLE_API_KEY &&
      process.env.GOOGLE_API_KEY.trim() !== '' &&
      !process.env.GOOGLE_API_KEY.includes('YOUR_GOOGLE_API_KEY_HERE')
    )).toString(),
  },
  webpack: (config, { isServer }) => {
    // This is to prevent "Module not found: Can't resolve 'fs'" errors.
    // It happens when packages with server-side dependencies are bundled for the client.
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
