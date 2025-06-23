require('dotenv').config();

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
};

module.exports = nextConfig;