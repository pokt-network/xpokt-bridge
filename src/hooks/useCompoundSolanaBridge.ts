'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { parseUnits } from 'viem';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { ERC20_ABI } from '@/lib/contracts/abis/erc20';
import { LOCKBOX_ABI } from '@/lib/contracts/abis/lockbox';
import { wagmiConfig } from '@/lib/chains/config';
import { useSolanaBridge } from './useSolanaBridge';

const TOKEN_DECIMALS = 6;

export type CompoundSolanaBridgeStep =
  | 'idle'
  | 'checking-balances'
  | 'approving-wpokt'
  | 'converting-lockbox'
  | 'initiating-bridge'
  | 'waiting-vaa'
  | 'completing'
  | 'complete'
  | 'error';

interface CompoundSolanaBridgeState {
  step: CompoundSolanaBridgeStep;
  needsLockboxConversion: boolean;
  lockboxAmount: bigint;
  directAmount: bigint;
  txHashes: {
    wpoktApprove?: string;
    lockboxDeposit?: string;
    bridgeInitiate?: string;
    bridgeComplete?: string;
  };
  error: string | null;
}

interface TokenBalances {
  wpokt: bigint;
  xpokt: bigint;
}

export function useCompoundSolanaBridge() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const solanaBridge = useSolanaBridge();

  const [state, setState] = useState<CompoundSolanaBridgeState>({
    step: 'idle',
    needsLockboxConversion: false,
    lockboxAmount: 0n,
    directAmount: 0n,
    txHashes: {},
    error: null,
  });

  const getBalances = useCallback(async (): Promise<TokenBalances> => {
    if (!address) return { wpokt: 0n, xpokt: 0n };
    const [wpoktBalance, xpoktBalance] = await Promise.all([
      readContract(wagmiConfig, {
        address: CONTRACTS.ethereum.wPOKT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
        chainId: 1,
      }),
      readContract(wagmiConfig, {
        address: CONTRACTS.ethereum.xPOKT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
        chainId: 1,
      }),
    ]);
    return { wpokt: wpoktBalance as bigint, xpokt: xpoktBalance as bigint };
  }, [address]);

  const calculateAmounts = useCallback((
    requestedAmount: bigint,
    balances: TokenBalances
  ) => {
    if (balances.xpokt >= requestedAmount) {
      return { lockboxAmount: 0n, directAmount: requestedAmount, needsConversion: false };
    }
    const directAmount = balances.xpokt;
    const lockboxAmount = requestedAmount - directAmount;
    if (lockboxAmount > balances.wpokt) {
      throw new Error('Insufficient total POKT balance');
    }
    return { lockboxAmount, directAmount, needsConversion: lockboxAmount > 0n };
  }, []);

  const bridge = useCallback(async (amount: string, solanaAddress: string) => {
    if (!address) throw new Error('EVM wallet not connected');
    const amountWei = parseUnits(amount, TOKEN_DECIMALS);

    try {
      setState(prev => ({ ...prev, step: 'checking-balances', error: null }));
      const balances = await getBalances();
      const { lockboxAmount, needsConversion } = calculateAmounts(amountWei, balances);

      setState(prev => ({
        ...prev,
        needsLockboxConversion: needsConversion,
        lockboxAmount,
        directAmount: amountWei - lockboxAmount,
      }));

      if (needsConversion && lockboxAmount > 0n) {
        setState(prev => ({ ...prev, step: 'approving-wpokt' }));
        const wpoktApproveTx = await writeContractAsync({
          address: CONTRACTS.ethereum.wPOKT as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACTS.ethereum.lockbox as `0x${string}`, lockboxAmount],
          chainId: 1,
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: wpoktApproveTx, chainId: 1 });
        setState(prev => ({ ...prev, txHashes: { ...prev.txHashes, wpoktApprove: wpoktApproveTx } }));

        setState(prev => ({ ...prev, step: 'converting-lockbox' }));
        const lockboxTx = await writeContractAsync({
          address: CONTRACTS.ethereum.lockbox as `0x${string}`,
          abi: LOCKBOX_ABI,
          functionName: 'deposit',
          args: [lockboxAmount],
          chainId: 1,
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: lockboxTx, chainId: 1 });
        setState(prev => ({ ...prev, txHashes: { ...prev.txHashes, lockboxDeposit: lockboxTx } }));
      }

      setState(prev => ({ ...prev, step: 'initiating-bridge' }));
      const result = await solanaBridge.initiateTransfer(amount, address, solanaAddress);
      setState(prev => ({
        ...prev,
        step: 'waiting-vaa',
        txHashes: { ...prev.txHashes, bridgeInitiate: result.sourceTxHash },
      }));

      return { ...result, usedLockbox: needsConversion, txHashes: state.txHashes };
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error: error.message }));
      throw error;
    }
  }, [address, getBalances, calculateAmounts, writeContractAsync, solanaBridge, state.txHashes]);

  const completeTransfer = useCallback(async (vaaBytes: string) => {
    setState(prev => ({ ...prev, step: 'completing' }));
    try {
      const destTxHash = await solanaBridge.completeTransfer(vaaBytes);
      setState(prev => ({
        ...prev,
        step: 'complete',
        txHashes: { ...prev.txHashes, bridgeComplete: destTxHash },
      }));
      return destTxHash;
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error: error.message }));
      throw error;
    }
  }, [solanaBridge]);

  const previewBridge = useCallback(async (amount: string) => {
    const amountWei = parseUnits(amount, TOKEN_DECIMALS);
    const balances = await getBalances();
    const { lockboxAmount, directAmount, needsConversion } = calculateAmounts(amountWei, balances);

    const steps: string[] = [];
    let txCount = 0;
    if (needsConversion) {
      steps.push('Approve wPOKT for Lockbox');
      steps.push('Convert wPOKT \u2192 xPOKT via Lockbox');
      txCount += 2;
    }
    steps.push('Approve xPOKT for Wormhole Token Bridge');
    steps.push('Lock xPOKT on Ethereum');
    steps.push('Wait for Wormhole guardians (~15-25 min)');
    steps.push('Claim POKT on Solana');
    txCount += 3;

    return {
      needsConversion,
      lockboxAmount: (lockboxAmount / BigInt(10 ** TOKEN_DECIMALS)).toString(),
      directAmount: (directAmount / BigInt(10 ** TOKEN_DECIMALS)).toString(),
      steps,
      estimatedTxCount: txCount,
    };
  }, [getBalances, calculateAmounts]);

  const resumeFromVAA = useCallback(async (sourceTxHash: string) => {
    setState(prev => ({ ...prev, step: 'waiting-vaa', txHashes: { ...prev.txHashes, bridgeInitiate: sourceTxHash }, error: null }));
    return solanaBridge.resumeFromVAA(sourceTxHash);
  }, [solanaBridge]);

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      needsLockboxConversion: false,
      lockboxAmount: 0n,
      directAmount: 0n,
      txHashes: {},
      error: null,
    });
    solanaBridge.reset();
  }, [solanaBridge]);

  return {
    state,
    solanaBridgeState: solanaBridge.state,
    bridge,
    completeTransfer,
    previewBridge,
    getBalances,
    resumeFromVAA,
    reset,
  };
}
