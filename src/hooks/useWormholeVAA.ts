'use client';

import { useState, useCallback, useRef } from 'react';
import { WORMHOLE_API_BASE, fetchVAABytes } from '@/lib/wormhole/client';

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
        // Primary: tx indexer — resolves emitter details and VAA together.
        // Caches emitter details as soon as they appear, even before the VAA is ready.
        const primaryPromise = fetch(`${WORMHOLE_API_BASE}/transactions/${txHash}`)
          .then(async (res): Promise<VAA | null> => {
            if (!res.ok) return null;
            const data = await res.json();
            const tx = data.data;
            if (!tx) return null;

            // Cache emitter details for the fallback path on this and future iterations.
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

        // Fallback: VAA store — a separate backend from the tx indexer.
        // Responds faster when the indexer is lagging but guardians have already signed.
        // Only available once emitter details are known from a prior indexer response.
        const fallbackPromise: Promise<VAA | null> = emitterRef.current
          ? fetchVAABytes(
              emitterRef.current.chain,
              emitterRef.current.address,
              emitterRef.current.sequence,
            ).then((vaaBytes): VAA | null => {
              if (!vaaBytes || !emitterRef.current) return null;
              return {
                vaaBytes,
                emitterChain: emitterRef.current.chain,
                emitterAddress: emitterRef.current.address,
                sequence: emitterRef.current.sequence,
              };
            })
          : Promise.resolve(null);

        // Fire both in parallel; prefer primary, fall back to VAA store.
        const [primary, fallback] = await Promise.all([primaryPromise, fallbackPromise]);
        const vaa = primary ?? fallback;

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
