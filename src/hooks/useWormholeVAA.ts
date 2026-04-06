'use client';

import { useState, useCallback, useRef } from 'react';
import { WORMHOLE_API_BASE, fetchVAABytes, fetchVAAFromOperations } from '@/lib/wormhole/client';

interface VAA {
  vaaBytes: string;
  emitterChain: number;
  emitterAddress: string;
  sequence: string;
}

interface VAAPollState {
  vaa: VAA | null;
  isPolling: boolean;
  error: string | null;
  attempts: number;
  maxAttempts: number;
}

// Emitter details become available from the indexer before the VAA is ready.
// Caching them lets us query the VAA store directly on subsequent poll iterations.
interface EmitterDetails {
  chain: number;
  address: string;
  sequence: string;
}

export function useWormholeVAA() {
  const [state, setState] = useState<VAAPollState>({
    vaa: null,
    isPolling: false,
    error: null,
    attempts: 0,
    maxAttempts: 240,
  });

  // Persists across poll iterations within a single pollForVAA call.
  // Reset at the start of each new call and on reset().
  const emitterRef = useRef<EmitterDetails | null>(null);

  const pollForVAA = useCallback(async (txHash: string): Promise<VAA | null> => {
    setState(prev => ({ ...prev, isPolling: true, error: null, attempts: 0 }));
    emitterRef.current = null;

    const maxAttempts = 240; // 240 × 30s = 2 hours
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        // Primary: /operations endpoint — works for BOTH EVM and Solana tx hashes.
        // The /transactions endpoint returns 404 for Solana tx hashes.
        // VAA bytes are returned as base64, converted to hex by fetchVAAFromOperations.
        const operationsPromise = fetchVAAFromOperations(txHash);

        // Secondary: /transactions endpoint — legacy path, only works for EVM hashes.
        // Kept as fallback in case /operations is temporarily unavailable.
        const txPromise = fetch(`${WORMHOLE_API_BASE}/transactions/${txHash}`)
          .then(async (res): Promise<VAA | null> => {
            if (!res.ok) return null;
            const data = await res.json();
            const tx = data.data;
            if (!tx) return null;

            // Cache emitter details for the tertiary path.
            if (tx.emitterChain && tx.emitterAddress && tx.sequence && !emitterRef.current) {
              emitterRef.current = {
                chain: tx.emitterChain,
                address: tx.emitterAddress,
                sequence: String(tx.sequence),
              };
            }

            if (!tx.vaa) return null;
            return {
              vaaBytes: tx.vaa,
              emitterChain: tx.emitterChain,
              emitterAddress: tx.emitterAddress,
              sequence: String(tx.sequence),
            };
          })
          .catch(() => null);

        // Tertiary: VAA store — direct query once emitter details are known.
        const emitterSnapshot = emitterRef.current;
        let vaaStorePromise: Promise<VAA | null>;
        if (emitterSnapshot !== null) {
          const { chain, address, sequence } = emitterSnapshot;
          vaaStorePromise = fetchVAABytes(chain, address, sequence).then(
            (vaaBytes): VAA | null => {
              if (!vaaBytes) return null;
              return { vaaBytes, emitterChain: chain, emitterAddress: address, sequence };
            },
          );
        } else {
          vaaStorePromise = Promise.resolve(null);
        }

        // Fire all in parallel; prefer operations, then tx, then VAA store.
        const [opsResult, txResult, vaaStoreResult] = await Promise.all([
          operationsPromise,
          txPromise,
          vaaStorePromise,
        ]);

        // Also cache emitter details from operations result for future iterations
        if (opsResult && !emitterRef.current) {
          emitterRef.current = {
            chain: opsResult.emitterChain,
            address: opsResult.emitterAddress,
            sequence: opsResult.sequence,
          };
        }

        const vaa = opsResult ?? txResult ?? vaaStoreResult;

        if (vaa) {
          setState(prev => ({ ...prev, vaa, isPolling: false }));
          return vaa;
        }
      } catch (e) {
        console.error('VAA polling error:', e);
      }

      // Increment and wait outside the try/catch so errors don't cause tight-loop retries.
      attempts++;
      setState(prev => ({ ...prev, attempts }));
      await new Promise(resolve => setTimeout(resolve, 30000));
    }

    setState(prev => ({
      ...prev,
      isPolling: false,
      error: 'VAA not found after 2 hours. Please check Wormholescan or try resuming later.',
    }));
    return null;
  }, []);

  const reset = useCallback(() => {
    setState({
      vaa: null,
      isPolling: false,
      error: null,
      attempts: 0,
      maxAttempts: 240,
    });
    emitterRef.current = null;
  }, []);

  return {
    ...state,
    pollForVAA,
    reset,
  };
}
