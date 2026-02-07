'use client';

import { useState, useCallback } from 'react';
import { useWormholeVAA } from './useWormholeVAA';

export type SolanaToEthBridgeStep =
  | 'idle'
  | 'initiating'
  | 'waiting-vaa'
  | 'completing'
  | 'complete'
  | 'error';

interface SolanaToEthBridgeState {
  step: SolanaToEthBridgeStep;
  initiateTxHash?: string;
  completeTxHash?: string;
  error: string | null;
}

export function useSolanaToEthBridge() {
  const vaaHook = useWormholeVAA();

  const [state, setState] = useState<SolanaToEthBridgeState>({
    step: 'idle',
    error: null,
  });

  const initiateTransfer = useCallback(async (
    amount: bigint,
    solanaSenderAddress: string,
    ethRecipientAddress: string,
  ) => {
    try {
      setState({ step: 'initiating', error: null });
      // Note: In production, this would use the Solana wallet adapter
      // to submit a burn transaction via the Wormhole Token Bridge program.
      // The implementation requires the Solana wallet signer.
      setState(prev => ({ ...prev, step: 'waiting-vaa' }));
      return { sourceTxHash: '', amount };
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error: error.message }));
      throw error;
    }
  }, []);

  const waitForVAA = useCallback(async (sourceTxHash: string) => {
    setState(prev => ({ ...prev, step: 'waiting-vaa' }));
    const vaa = await vaaHook.pollForVAA(sourceTxHash);
    if (!vaa) {
      setState(prev => ({ ...prev, step: 'error', error: 'VAA not found' }));
      return null;
    }
    return vaa;
  }, [vaaHook]);

  const completeTransfer = useCallback(async (vaaBytes: string) => {
    setState(prev => ({ ...prev, step: 'completing' }));
    // Note: In production, this would use the EVM wallet to submit
    // a completeTransfer transaction to the Wormhole Token Bridge on Ethereum.
    setState(prev => ({ ...prev, step: 'complete' }));
    return vaaBytes;
  }, []);

  const resumeFromVAA = useCallback(async (sourceTxHash: string, _sourceChain: string) => {
    setState(prev => ({ ...prev, step: 'waiting-vaa', initiateTxHash: sourceTxHash, error: null }));
    return waitForVAA(sourceTxHash);
  }, [waitForVAA]);

  const reset = useCallback(() => {
    setState({ step: 'idle', error: null });
    vaaHook.reset();
  }, [vaaHook]);

  return {
    state,
    vaaState: vaaHook,
    initiateTransfer,
    waitForVAA,
    completeTransfer,
    resumeFromVAA,
    reset,
  };
}
