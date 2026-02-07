'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { useSolanaBridge } from './useSolanaBridge';
import { useSolanaToEthBridge } from './useSolanaToEthBridge';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { ERC20_ABI } from '@/lib/contracts/abis/erc20';
import { LOCKBOX_ABI } from '@/lib/contracts/abis/lockbox';
import { wagmiConfig } from '@/lib/chains/config';
import type { SolanaDirection, Chain } from '@/types/bridge';

export type UnifiedSolanaBridgeStep =
  | 'idle'
  | 'initiating'
  | 'waiting-vaa'
  | 'claiming'
  | 'approving-lockbox'
  | 'converting-lockbox'
  | 'complete'
  | 'error';

interface UnifiedSolanaBridgeState {
  step: UnifiedSolanaBridgeStep;
  sourceTxHash?: string;
  destTxHash?: string;
  conversionTxHash?: string;
  error: string | null;
}

interface UseUnifiedSolanaBridgeOptions {
  direction: SolanaDirection;
}

export function useUnifiedSolanaBridge({ direction }: UseUnifiedSolanaBridgeOptions) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const ethToSolana = useSolanaBridge();
  const solanaToEth = useSolanaToEthBridge();

  const [state, setState] = useState<UnifiedSolanaBridgeState>({
    step: 'idle',
    error: null,
  });

  const sourceChain: Chain = direction === 'toSolana' ? 'ethereum' : 'solana';
  const destChain: Chain = direction === 'toSolana' ? 'solana' : 'ethereum';
  const supportsDestTokenChoice = direction === 'fromSolana';

  const initiateTransfer = useCallback(async (
    amount: bigint,
    sourceAddress: string,
    destAddress: string
  ) => {
    setState(prev => ({ ...prev, step: 'initiating', error: null }));
    try {
      let result;
      if (direction === 'toSolana') {
        // Convert bigint to string amount for useSolanaBridge
        const wholePart = amount / BigInt(10 ** 6);
        const fracPart = (amount % BigInt(10 ** 6)).toString().padStart(6, '0');
        const amountStr = `${wholePart}.${fracPart}`;
        result = await ethToSolana.initiateTransfer(amountStr, sourceAddress, destAddress);
      } else {
        result = await solanaToEth.initiateTransfer(amount, sourceAddress, destAddress);
      }
      setState(prev => ({ ...prev, step: 'waiting-vaa', sourceTxHash: result.sourceTxHash }));
      return result;
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error: error.message }));
      throw error;
    }
  }, [direction, ethToSolana, solanaToEth]);

  const waitForVAA = useCallback(async (sourceTxHash: string) => {
    setState(prev => ({ ...prev, step: 'waiting-vaa' }));
    if (direction === 'toSolana') {
      return ethToSolana.waitForVAA(sourceTxHash);
    } else {
      return solanaToEth.waitForVAA(sourceTxHash);
    }
  }, [direction, ethToSolana, solanaToEth]);

  const completeTransfer = useCallback(async (vaaBytes: string) => {
    setState(prev => ({ ...prev, step: 'claiming' }));
    try {
      let destTxHash;
      if (direction === 'toSolana') {
        destTxHash = await ethToSolana.completeTransfer(vaaBytes);
      } else {
        destTxHash = await solanaToEth.completeTransfer(vaaBytes);
      }
      setState(prev => ({ ...prev, step: 'complete', destTxHash }));
      return destTxHash;
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error: error.message }));
      throw error;
    }
  }, [direction, ethToSolana, solanaToEth]);

  const completeTransferWithConversion = useCallback(async (
    vaaBytes: string,
    destToken: 'wpokt' | 'xpokt' = 'xpokt',
    claimedAmount?: bigint
  ): Promise<{ destTxHash: string; conversionTxHash?: string }> => {
    setState(prev => ({ ...prev, step: 'claiming' }));
    let destTxHash: string;

    try {
      if (direction === 'toSolana') {
        destTxHash = await ethToSolana.completeTransfer(vaaBytes);
      } else {
        destTxHash = await solanaToEth.completeTransfer(vaaBytes);
      }
      setState(prev => ({ ...prev, destTxHash }));
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error: error.message }));
      throw error;
    }

    if (direction === 'fromSolana' && destToken === 'wpokt' && claimedAmount) {
      if (!address) throw new Error('EVM wallet not connected for conversion');

      try {
        setState(prev => ({ ...prev, step: 'approving-lockbox' }));
        const approveTx = await writeContractAsync({
          address: CONTRACTS.ethereum.xPOKT as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACTS.ethereum.lockbox as `0x${string}`, claimedAmount],
          chainId: 1,
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveTx, chainId: 1 });

        setState(prev => ({ ...prev, step: 'converting-lockbox' }));
        const withdrawTx = await writeContractAsync({
          address: CONTRACTS.ethereum.lockbox as `0x${string}`,
          abi: LOCKBOX_ABI,
          functionName: 'withdraw',
          args: [claimedAmount],
          chainId: 1,
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: withdrawTx, chainId: 1 });

        setState(prev => ({ ...prev, step: 'complete', conversionTxHash: withdrawTx }));
        return { destTxHash, conversionTxHash: withdrawTx };
      } catch (error: any) {
        setState(prev => ({
          ...prev,
          step: 'error',
          error: `Claim succeeded but conversion failed: ${error.message}. You received xPOKT instead of wPOKT. Use the converter to manually convert.`,
        }));
        throw error;
      }
    }

    setState(prev => ({ ...prev, step: 'complete' }));
    return { destTxHash };
  }, [direction, address, ethToSolana, solanaToEth, writeContractAsync]);

  const resumeFromVAA = useCallback(async (sourceTxHash: string, sourceChainName: string) => {
    setState(prev => ({ ...prev, step: 'waiting-vaa', sourceTxHash, error: null }));
    if (direction === 'toSolana') {
      return ethToSolana.resumeFromVAA(sourceTxHash);
    } else {
      return solanaToEth.resumeFromVAA(sourceTxHash, sourceChainName);
    }
  }, [direction, ethToSolana, solanaToEth]);

  const reset = useCallback(() => {
    setState({ step: 'idle', error: null });
    ethToSolana.reset();
    solanaToEth.reset();
  }, [ethToSolana, solanaToEth]);

  const underlyingState = direction === 'toSolana' ? ethToSolana.state : solanaToEth.state;

  return {
    state,
    underlyingState,
    sourceChain,
    destChain,
    direction,
    supportsDestTokenChoice,
    initiateTransfer,
    waitForVAA,
    completeTransfer,
    completeTransferWithConversion,
    resumeFromVAA,
    reset,
  };
}
