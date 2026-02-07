'use client';

import { useState, useCallback } from 'react';
import { WORMHOLE_API_BASE } from '@/lib/wormhole/client';

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

export function useWormholeVAA() {
  const [state, setState] = useState<VAAPollState>({
    vaa: null,
    isPolling: false,
    error: null,
    attempts: 0,
    maxAttempts: 60,
  });

  const pollForVAA = useCallback(async (txHash: string): Promise<VAA | null> => {
    setState(prev => ({ ...prev, isPolling: true, error: null, attempts: 0 }));

    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${WORMHOLE_API_BASE}/transactions/${txHash}`);

        if (response.ok) {
          const data = await response.json();

          if (data.data?.vaa) {
            const vaa: VAA = {
              vaaBytes: data.data.vaa,
              emitterChain: data.data.emitterChain,
              emitterAddress: data.data.emitterAddress,
              sequence: data.data.sequence,
            };
            setState(prev => ({ ...prev, vaa, isPolling: false }));
            return vaa;
          }
        }

        attempts++;
        setState(prev => ({ ...prev, attempts }));
        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (e) {
        console.error('VAA polling error:', e);
      }
    }

    setState(prev => ({
      ...prev,
      isPolling: false,
      error: 'VAA not found after 30 minutes. Please check Wormholescan.',
    }));
    return null;
  }, []);

  const reset = useCallback(() => {
    setState({
      vaa: null,
      isPolling: false,
      error: null,
      attempts: 0,
      maxAttempts: 60,
    });
  }, []);

  return {
    ...state,
    pollForVAA,
    reset,
  };
}
