
/** @type {import('next').NextConfig} */
const nextConfig = {
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
    NEXT_PUBLIC_GENKIT_CONFIGURED: 'false',
  },
  webpack: (config, { isServer }) => {
    // This is to prevent "Module not found: Can't resolve 'fs'" errors.
    // It happens when packages with server-side dependencies are bundled for the client.
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
      };
    }
    
    // This loader handles the 'handlebars' dependency issue with Genkit.
    config.module.rules.push({
      test: /node_modules\/handlebars\/.+\.js$/,
      loader: 'shebang-loader',
    });
    
    return config;
  },
};

module.exports = nextConfig;
