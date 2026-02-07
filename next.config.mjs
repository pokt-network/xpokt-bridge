/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    // Handle optional peer dependencies that aren't installed
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      'pino-pretty',
      'encoding',
    ];
    return config;
  },
};

export default nextConfig;
