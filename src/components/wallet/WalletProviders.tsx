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

// Pocket Network is the only Solana RPC. No third-party fallback.
// Can be fully overridden via NEXT_PUBLIC_SOLANA_RPC_URL env var.
const SOLANA_RPC = 'https://solana.api.pocket.network';

/**
 * Check if the Solana RPC endpoint is responsive. Retries up to
 * `maxRetries` times with exponential backoff before giving up.
 */
async function checkRpcHealthWithRetry(
  endpoint: string,
  timeoutMs: number,
  maxRetries: number,
): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (typeof data?.result === 'number') {
        return true;
      }
    } catch {
      clearTimeout(timer);
      if (attempt < maxRetries) {
        // Exponential backoff: 500ms, 1000ms, 2000ms
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }
  return false;
}

/**
 * Hook to resolve the Solana RPC endpoint.
 * Always uses Pocket Network. Retries the health check up to 3 times
 * before settling (the ConnectionProvider still works with a potentially
 * slow endpoint — it just means the first few RPC calls may be slow).
 */
function useSolanaRpcEndpoint(): string {
  const override = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  const endpoint = override || SOLANA_RPC;

  // Fire-and-forget health check with retries — purely for logging.
  // The endpoint is always Pocket; we don't swap to anything else.
  useEffect(() => {
    if (override) return;

    let cancelled = false;
    (async () => {
      const healthy = await checkRpcHealthWithRetry(endpoint, 2000, 2);
      if (cancelled) return;
      if (healthy) {
        console.log('[SolanaRPC] Pocket Network healthy:', endpoint);
      } else {
        console.warn('[SolanaRPC] Pocket Network health check failed after retries — proceeding anyway');
      }
    })();
    return () => { cancelled = true; };
  }, [override, endpoint]);

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
