'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { wagmiConfig } from '@/lib/chains/config';
import { BridgeProvider } from '@/context/BridgeContext';

import '@solana/wallet-adapter-react-ui/styles.css';

const queryClient = new QueryClient();

/**
 * Ordered list of Solana RPC endpoints.
 * Pocket Network is primary. On error or >500ms latency, we advance to the next.
 * All endpoints are public and require no API key.
 */
const SOLANA_RPC_ENDPOINTS = [
  'https://solana.api.pocket.network',
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.rpc.extrnode.com',
  'https://solana.blockrazor.xyz',
];

/** Max acceptable latency before we consider an endpoint too slow */
const LATENCY_THRESHOLD_MS = 500;

/**
 * Probe a single RPC endpoint. Returns latency in ms on success, or -1 on failure.
 */
async function probeEndpoint(endpoint: string, timeoutMs: number): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

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

    if (!response.ok) return -1;

    const data = await response.json();
    if (typeof data?.result !== 'number') return -1;

    return performance.now() - start;
  } catch {
    clearTimeout(timer);
    return -1;
  }
}

/**
 * Hook to resolve the Solana RPC endpoint with automatic failover.
 *
 * Starts with Pocket Network. If the health-check fails or latency exceeds
 * 500ms, advances to the next endpoint in order. The active endpoint is
 * re-checked every 60s; if it degrades, we advance again.
 */
function useSolanaRpcEndpoint(): string {
  const override = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);

  // Keep ref in sync for use inside async callbacks
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const advanceEndpoint = useCallback((fromIndex: number) => {
    const next = fromIndex + 1;
    if (next < SOLANA_RPC_ENDPOINTS.length) {
      console.warn(
        `[SolanaRPC] Advancing from ${SOLANA_RPC_ENDPOINTS[fromIndex]} → ${SOLANA_RPC_ENDPOINTS[next]}`
      );
      setActiveIndex(next);
    } else {
      console.warn('[SolanaRPC] All endpoints exhausted, staying on last:', SOLANA_RPC_ENDPOINTS[fromIndex]);
    }
  }, []);

  // Initial probe + periodic re-check
  useEffect(() => {
    if (override) return;

    let cancelled = false;

    async function check() {
      const idx = activeIndexRef.current;
      const endpoint = SOLANA_RPC_ENDPOINTS[idx];
      const latency = await probeEndpoint(endpoint, 2000);

      if (cancelled) return;

      if (latency < 0) {
        console.warn(`[SolanaRPC] ${endpoint} — health check failed`);
        advanceEndpoint(idx);
      } else if (latency > LATENCY_THRESHOLD_MS) {
        console.warn(`[SolanaRPC] ${endpoint} — latency ${Math.round(latency)}ms exceeds ${LATENCY_THRESHOLD_MS}ms threshold`);
        advanceEndpoint(idx);
      } else {
        console.log(`[SolanaRPC] ${endpoint} — healthy (${Math.round(latency)}ms)`);
      }
    }

    check();
    const interval = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [override, activeIndex, advanceEndpoint]);

  if (override) return override;
  return SOLANA_RPC_ENDPOINTS[activeIndex];
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
