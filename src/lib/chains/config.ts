import { http, createConfig } from 'wagmi';
import { mainnet, base } from 'wagmi/chains';
import { injected, coinbaseWallet } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [mainnet, base],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: 'POKT Bridge',
      appLogoUrl: 'https://pocket.network/wp-content/uploads/2025/01/favicon.png',
    }),
  ],
  transports: {
    // Explicit public RPCs that support CORS from any origin.
    // The default wagmi RPCs (e.g. eth.merkle.io) may block CORS during
    // local development, causing balance reads to silently fail.
    [mainnet.id]: http('https://eth.llamarpc.com'),
    [base.id]: http('https://mainnet.base.org'),
  },
});
