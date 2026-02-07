'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWriteContract, useConfig } from 'wagmi';
import { waitForTransactionReceipt, switchChain } from '@wagmi/core';
import { mainnet } from 'wagmi/chains';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { ERC20_ABI } from '@/lib/contracts/abis/erc20';
import { LOCKBOX_ABI } from '@/lib/contracts/abis/lockbox';
import { wagmiConfig } from '@/lib/chains/config';
import { approveIfNeeded } from '@/lib/utils/approve';

/**
 * waitForTransactionReceipt with retry on transient HTTP/network errors.
 */
async function waitForReceiptWithRetry(
  hash: `0x${string}`,
  chainId: 1 | 8453,
  retries = 3
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await waitForTransactionReceipt(wagmiConfig, { hash, chainId });
    } catch (err: any) {
      const msg = err?.message || '';
      const isTransient = msg.includes('HTTP request failed') || msg.includes('fetch') || msg.includes('network');
      if (isTransient && attempt < retries) {
        console.warn(`[Lockbox] Receipt fetch attempt ${attempt} failed, retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw err;
    }
  }
}

export type LockboxStep = 'idle' | 'switching-chain' | 'approving' | 'converting' | 'complete' | 'error';

interface LockboxState {
  step: LockboxStep;
  txHash?: string;
  approveTxHash?: string;
  error: string | null;
}

export function useLockbox() {
  const { address, chainId: currentChainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();
  const [state, setState] = useState<LockboxState>({
    step: 'idle',
    error: null,
  });

  /**
   * Ensure wallet is on Ethereum mainnet (Lockbox only exists there).
   */
  const ensureEthereum = useCallback(async () => {
    if (currentChainId === 1) return;

    setState(prev => ({ ...prev, step: 'switching-chain' }));
    try {
      await switchChain(config, { chainId: 1 });
    } catch {
      throw new Error('Please switch your wallet to Ethereum mainnet and try again.');
    }
  }, [currentChainId, config]);

  // wPOKT -> xPOKT (deposit)
  const deposit = useCallback(async (amount: bigint) => {
    if (!address) throw new Error('Wallet not connected');

    try {
      await ensureEthereum();

      // Approve wPOKT to Lockbox (skip if sufficient allowance exists)
      setState({ step: 'approving', error: null });
      const approval = await approveIfNeeded({
        token: CONTRACTS.ethereum.wPOKT as `0x${string}`,
        spender: CONTRACTS.ethereum.lockbox as `0x${string}`,
        amount,
        owner: address as `0x${string}`,
        chainId: 1,
        writeContractAsync,
        chain: mainnet,
      });

      // Deposit to Lockbox
      setState(prev => ({ ...prev, step: 'converting', approveTxHash: approval.txHash }));
      const depositTx = await writeContractAsync({
        address: CONTRACTS.ethereum.lockbox as `0x${string}`,
        abi: LOCKBOX_ABI,
        functionName: 'deposit',
        args: [amount],
        chain: mainnet,
      });
      await waitForReceiptWithRetry(depositTx, 1);

      setState({ step: 'complete', txHash: depositTx, approveTxHash: approval.txHash, error: null });
      return { approveTxHash: approval.txHash, depositTxHash: depositTx };
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error: error.shortMessage || error.message || 'Deposit failed' }));
      throw error;
    }
  }, [address, writeContractAsync, ensureEthereum]);

  // xPOKT -> wPOKT (withdraw)
  const withdraw = useCallback(async (amount: bigint) => {
    if (!address) throw new Error('Wallet not connected');

    try {
      await ensureEthereum();

      // Approve xPOKT to Lockbox (skip if sufficient allowance exists)
      setState({ step: 'approving', error: null });
      const approval = await approveIfNeeded({
        token: CONTRACTS.ethereum.xPOKT as `0x${string}`,
        spender: CONTRACTS.ethereum.lockbox as `0x${string}`,
        amount,
        owner: address as `0x${string}`,
        chainId: 1,
        writeContractAsync,
        chain: mainnet,
      });

      // Withdraw from Lockbox
      setState(prev => ({ ...prev, step: 'converting', approveTxHash: approval.txHash }));
      const withdrawTx = await writeContractAsync({
        address: CONTRACTS.ethereum.lockbox as `0x${string}`,
        abi: LOCKBOX_ABI,
        functionName: 'withdraw',
        args: [amount],
        chain: mainnet,
      });
      await waitForReceiptWithRetry(withdrawTx, 1);

      setState({ step: 'complete', txHash: withdrawTx, approveTxHash: approval.txHash, error: null });
      return { approveTxHash: approval.txHash, withdrawTxHash: withdrawTx };
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error: error.shortMessage || error.message || 'Withdraw failed' }));
      throw error;
    }
  }, [address, writeContractAsync, ensureEthereum]);

  const reset = useCallback(() => {
    setState({ step: 'idle', error: null });
  }, []);

  return {
    state,
    deposit,
    withdraw,
    reset,
    isDepositing: state.step === 'approving' || state.step === 'converting',
    isWithdrawing: state.step === 'approving' || state.step === 'converting',
  };
}
