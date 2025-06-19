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
  webpack: (config, { isServer, webpack }) => {
    // To suppress the "require.extensions is not supported" warning from Handlebars
    // This warning appears because Handlebars contains code that uses a Node.js-specific feature
    // not fully supported or emulated by webpack during the bundling process.
    // For the typical use of Handlebars in Genkit (compiling template strings),
    // this feature is usually not critical.
    if (!config.ignoreWarnings) {
      config.ignoreWarnings = [];
    }
    config.ignoreWarnings.push({
      module: /handlebars\/lib\/index\.js$/, // Regular expression to match the module path
      message: /require\.extensions is not supported by webpack/, // Regular expression to match the warning message
    });

    return config;
  },
};

module.exports = nextConfig;
