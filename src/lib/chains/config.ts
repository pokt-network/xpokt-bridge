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
    // Pocket Network public RPC endpoints (CORS-friendly, no API key required).
    [mainnet.id]: http('https://eth.api.pocket.network'),
    [base.id]: http('https://base.api.pocket.network'),
  },
});
