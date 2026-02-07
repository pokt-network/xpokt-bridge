'use client';

import React, { useMemo, useState, useEffect, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { wagmiConfig } from '@/lib/chains/config';
import { BridgeProvider } from '@/context/BridgeContext';

import '@solana/wallet-adapter-react-ui/styles.css';

const queryClient = new QueryClient();

// Solana RPC endpoints — priority order.
// Pocket Network is primary; Ankr is fallback if Pocket doesn't respond within 1000ms.
// Can be fully overridden via NEXT_PUBLIC_SOLANA_RPC_URL env var.
const SOLANA_RPC_PRIMARY = 'https://solana.api.pocket.network';
const SOLANA_RPC_FALLBACK = 'https://rpc.ankr.com/solana';
const RPC_HEALTH_TIMEOUT_MS = 1000;

/**
 * Check if a Solana RPC endpoint is responsive by sending a lightweight
 * getBlockHeight request with an AbortController timeout.
 */
async function checkRpcHealth(endpoint: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBlockHeight',
        params: [],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return false;

    const data = await response.json();
    // Valid response has a numeric result
    return typeof data?.result === 'number';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hook to resolve the best available Solana RPC endpoint.
 * Starts with the fallback immediately so providers are always available,
 * then upgrades to Pocket Network if the health check passes within 1000ms.
 */
function useSolanaRpcEndpoint(): string {
  const override = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;

  // Start with fallback so Solana providers render immediately.
  // If user set an override, use that from the start.
  const [endpoint, setEndpoint] = useState<string>(override || SOLANA_RPC_FALLBACK);

  useEffect(() => {
    // Skip health check if user provided an override
    if (override) return;

    let cancelled = false;

    async function resolve() {
      console.log('[SolanaRPC] Checking Pocket Network endpoint...');
      const pocketHealthy = await checkRpcHealth(SOLANA_RPC_PRIMARY, RPC_HEALTH_TIMEOUT_MS);

      if (cancelled) return;

      if (pocketHealthy) {
        console.log('[SolanaRPC] Using Pocket Network:', SOLANA_RPC_PRIMARY);
        setEndpoint(SOLANA_RPC_PRIMARY);
      } else {
        console.log('[SolanaRPC] Pocket Network unavailable, using Ankr:', SOLANA_RPC_FALLBACK);
        // Already set as initial state, no-op
      }
    }

    resolve();

    return () => { cancelled = true; };
  }, [override]);

  return endpoint;
}

interface WalletProvidersProps {
  children: ReactNode;
}

export function WalletProviders({ children }: WalletProvidersProps) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  const solanaRpcEndpoint = useSolanaRpcEndpoint();

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider endpoint={solanaRpcEndpoint}>
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
