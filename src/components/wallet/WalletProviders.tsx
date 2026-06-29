'use client';

import React, { useMemo, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { wagmiConfig } from '@/lib/chains/config';
import { BridgeProvider } from '@/context/BridgeContext';
import { SOLANA_PRIMARY_RPC, SOLANA_CONNECTION_CONFIG } from '@/lib/solana/rpc';

import '@solana/wallet-adapter-react-ui/styles.css';

const queryClient = new QueryClient();

interface WalletProvidersProps {
  children: ReactNode;
}

export function WalletProviders({ children }: WalletProvidersProps) {
  // Phantom auto-registers as a Standard Wallet — no explicit adapter needed.
  // Solflare still requires its adapter.
  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);

  // The wallet-adapter Connection uses our failover fetch (Pocket Network
  // primary; cascades to public nodes on any HTTP/network error). This replaces
  // the old out-of-band health-probe hook — failover is now in-band per request
  // (see lib/solana/rpc). `endpoint` is the nominal primary; the failover fetch
  // in `config` drives the actual endpoint selection.
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider endpoint={SOLANA_PRIMARY_RPC} config={SOLANA_CONNECTION_CONFIG}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              <BridgeProvider>
                {children}
              </BridgeProvider>
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
