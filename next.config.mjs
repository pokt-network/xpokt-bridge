import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ---------------------------------------------------------------------------
  // Security Headers
  // ---------------------------------------------------------------------------
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Content-Security-Policy — restrict script/style/connect sources
          {
            key: 'Content-Security-Policy',
            value: [
              // Only allow scripts from same origin (Next.js bundles)
              "default-src 'self'",
              // Scripts: self + inline (Next.js requires inline for hydration)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Styles: self + inline (component styles) + Google Fonts
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fonts: self + Google Fonts CDN
              "font-src 'self' https://fonts.gstatic.com",
              // Images: self + data URIs + wallet icons + PNF assets
              "img-src 'self' data: blob: https://pocket.network https://*.walletconnect.com https://*.coinbase.com",
              // Connect: RPC endpoints + Wormholescan API + wallet providers
              "connect-src 'self' https://eth.api.pocket.network https://base.api.pocket.network https://solana.api.pocket.network https://solana-rpc.publicnode.com https://rpc.ankr.com https://arb1.arbitrum.io https://rpc.ankr.com https://api.wormholescan.io https://*.walletconnect.com wss://*.walletconnect.com https://*.coinbase.com",
              // Frames: deny embedding entirely (clickjacking protection)
              "frame-ancestors 'none'",
              // Forms: only allow submission to same origin
              "form-action 'self'",
              // Base URI: prevent <base> tag hijacking
              "base-uri 'self'",
            ].join('; '),
          },
          // Clickjacking protection (legacy browsers that don't support frame-ancestors)
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME-type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Enforce HTTPS (1 year, include subdomains)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Control referrer information leakage
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Restrict browser features the app doesn't need
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          // XSS protection for legacy browsers
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },

  // ---------------------------------------------------------------------------
  // Webpack Configuration
  // ---------------------------------------------------------------------------
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
    // Force all bn.js imports to resolve to v5 (the root copy).
    // Several transitive deps (elliptic, asn1.js) bundle bn.js v4 which
    // cannot handle JS bigint values — its _initArray asserts on the
    // missing .length property.  The Wormhole SDK passes bigint amounts
    // through Anchor → BN.js, so every copy must be v5+.
    config.resolve.alias = {
      ...config.resolve.alias,
      'bn.js': require.resolve('bn.js'),
    };
    // Handle optional peer dependencies that aren't installed
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      'pino-pretty',
      'encoding',
      // @metamask/sdk conditionally imports React Native AsyncStorage, which is
      // unavailable in a web build. Marking it external prevents the bundle error.
      '@react-native-async-storage/async-storage',
    ];
    return config;
  },
};

export default nextConfig;
