'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWriteContract, useConfig } from 'wagmi';
import { readContract, waitForTransactionReceipt, switchChain } from '@wagmi/core';
import { parseUnits } from 'viem';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { ERC20_ABI } from '@/lib/contracts/abis/erc20';
import { LOCKBOX_ABI } from '@/lib/contracts/abis/lockbox';
import { BRIDGE_ADAPTER_ABI } from '@/lib/contracts/abis/bridgeAdapter';
import { wagmiConfig } from '@/lib/chains/config';
import { approveIfNeeded } from '@/lib/utils/approve';
import { getChainById, getEvmChainId, getWormholeChainId, getChainName } from '@/lib/chains/chainRegistry';
import type { EvmChain } from '@/types/bridge';

const TOKEN_DECIMALS = 6;

export type CompoundEVMBridgeStep =
  | 'idle'
  | 'switching-chain'
  | 'checking-balances'
  | 'approving-wpokt'
  | 'converting-lockbox'
  | 'approving-xpokt'
  | 'bridging'
  | 'waiting-relay'
  | 'complete'
  | 'error';

interface CompoundEVMBridgeState {
  step: CompoundEVMBridgeStep;
  needsLockboxConversion: boolean;
  lockboxAmount: bigint;
  directAmount: bigint;
  txHashes: {
    wpoktApprove?: string;
    lockboxDeposit?: string;
    xpoktApprove?: string;
    bridge?: string;
  };
  error: string | null;
}

interface TokenBalances {
  wpokt: bigint;
  xpokt: bigint;
}

interface UseCompoundEVMBridgeOptions {
  sourceChain: EvmChain;
  destChain: EvmChain;
}

/** Get contract addresses for any supported EVM chain, including optional Lockbox/wPOKT */
function getSourceContracts(chain: EvmChain) {
  const chainConfig = getChainById(chain);
  const contracts = CONTRACTS[chain];

  return {
    wPOKT: chainConfig?.hasWPOKT ? (CONTRACTS as any).ethereum.wPOKT : null,
    xPOKT: contracts.xPOKT,
    lockbox: chainConfig?.hasLockbox ? (CONTRACTS as any).ethereum.lockbox : null,
    bridgeAdapter: contracts.bridgeAdapter,
  };
}

export function useCompoundEVMBridge({ sourceChain, destChain }: UseCompoundEVMBridgeOptions) {
  const { address, chainId: currentChainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();

  const [state, setState] = useState<CompoundEVMBridgeState>({
    step: 'idle',
    needsLockboxConversion: false,
    lockboxAmount: 0n,
    directAmount: 0n,
    txHashes: {},
    error: null,
  });

  const sourceChainId = getEvmChainId(sourceChain);
  const destWormholeChainId = getWormholeChainId(destChain);
  const chainConfig = getChainById(sourceChain);

  /**
   * Read both wPOKT and xPOKT balances for the connected wallet.
   * Note: wPOKT only exists on Ethereum.
   * readContract uses RPC directly — no wallet chain switch needed.
   */
  const getBalances = useCallback(async (): Promise<TokenBalances> => {
    if (!address) return { wpokt: 0n, xpokt: 0n };
    const contracts = getSourceContracts(sourceChain);

    // Read xPOKT balance (exists on all EVM chains)
    const xpoktBalance = await readContract(wagmiConfig, {
      address: contracts.xPOKT as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
      chainId: sourceChainId,
    }) as bigint;

    // Read wPOKT balance (Ethereum only)
    let wpoktBalance = 0n;
    if (contracts.wPOKT) {
      wpoktBalance = await readContract(wagmiConfig, {
        address: contracts.wPOKT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
        chainId: sourceChainId,
      }) as bigint;
    }

    return { wpokt: wpoktBalance, xpokt: xpoktBalance };
  }, [address, sourceChain, sourceChainId]);

  /**
   * Calculate how much wPOKT needs conversion vs direct xPOKT bridging.
   * Strategy: Use xPOKT first (saves gas), then convert wPOKT as needed.
   */
  const calculateAmounts = useCallback((
    requestedAmount: bigint,
    balances: TokenBalances
  ): { lockboxAmount: bigint; directAmount: bigint; needsConversion: boolean } => {
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

  /**
   * Ensure the wallet is on the correct chain before sending transactions.
   */
  const ensureCorrectChain = useCallback(async () => {
    if (currentChainId === sourceChainId) return;

    setState(prev => ({ ...prev, step: 'switching-chain' }));

    try {
      await switchChain(config, { chainId: sourceChainId });
    } catch {
      throw new Error(
        `Please switch your wallet to ${getChainName(sourceChain)} network manually and try again.`
      );
    }
  }, [currentChainId, sourceChainId, sourceChain, config]);

  /**
   * Query the Bridge Adapter's bridgeCost() to get the exact relay fee.
   */
  const quoteRelayFee = useCallback(async (): Promise<bigint> => {
    const contracts = getSourceContracts(sourceChain);

    const cost = await readContract(wagmiConfig, {
      address: contracts.bridgeAdapter as `0x${string}`,
      abi: BRIDGE_ADAPTER_ABI,
      functionName: 'bridgeCost',
      args: [destWormholeChainId],
      chainId: sourceChainId,
    }) as bigint;

    return cost;
  }, [sourceChain, destWormholeChainId, sourceChainId]);

  /**
   * Execute the full EVM bridge flow with automatic Lockbox conversion if needed.
   */
  const bridge = useCallback(async (
    amount: string,
    recipient?: string
  ) => {
    if (!address) throw new Error('Wallet not connected');

    const contracts = getSourceContracts(sourceChain);
    const amountWei = parseUnits(amount, TOKEN_DECIMALS);
    const recipientAddress = recipient || address;

    try {
      // Step 1: Check balances (read-only, no chain switch needed)
      setState(prev => ({ ...prev, step: 'checking-balances', error: null, txHashes: {} }));
      const balances = await getBalances();
      const { lockboxAmount, needsConversion } = calculateAmounts(amountWei, balances);

      setState(prev => ({
        ...prev,
        needsLockboxConversion: needsConversion,
        lockboxAmount,
        directAmount: amountWei - lockboxAmount,
      }));

      // Step 1b: Ensure wallet is on the correct chain
      await ensureCorrectChain();

      // Step 2: Lockbox conversion if needed (Ethereum only)
      if (needsConversion && lockboxAmount > 0n && contracts.lockbox) {
        setState(prev => ({ ...prev, step: 'approving-wpokt' }));

        const wpoktApproval = await approveIfNeeded({
          token: contracts.wPOKT as `0x${string}`,
          spender: contracts.lockbox as `0x${string}`,
          amount: lockboxAmount,
          owner: address as `0x${string}`,
          chainId: sourceChainId,
          writeContractAsync,
        });

        if (wpoktApproval.txHash) {
          setState(prev => ({
            ...prev,
            txHashes: { ...prev.txHashes, wpoktApprove: wpoktApproval.txHash }
          }));
        }

        setState(prev => ({ ...prev, step: 'converting-lockbox' }));

        const lockboxTx = await writeContractAsync({
          address: contracts.lockbox as `0x${string}`,
          abi: LOCKBOX_ABI,
          functionName: 'deposit',
          args: [lockboxAmount],
          chainId: sourceChainId,
        });

        await waitForTransactionReceipt(wagmiConfig, {
          hash: lockboxTx,
          chainId: sourceChainId,
        });

        setState(prev => ({
          ...prev,
          txHashes: { ...prev.txHashes, lockboxDeposit: lockboxTx }
        }));
      }

      // Step 3: Approve xPOKT to Bridge Adapter
      setState(prev => ({ ...prev, step: 'approving-xpokt' }));

      const xpoktApproval = await approveIfNeeded({
        token: contracts.xPOKT as `0x${string}`,
        spender: contracts.bridgeAdapter as `0x${string}`,
        amount: amountWei,
        owner: address as `0x${string}`,
        chainId: sourceChainId,
        writeContractAsync,
      });

      if (xpoktApproval.txHash) {
        setState(prev => ({
          ...prev,
          txHashes: { ...prev.txHashes, xpoktApprove: xpoktApproval.txHash }
        }));
      }

      // Step 4: Quote exact relay fee then call bridge()
      setState(prev => ({ ...prev, step: 'bridging' }));
      const relayerFee = await quoteRelayFee();

      const bridgeTx = await writeContractAsync({
        address: contracts.bridgeAdapter as `0x${string}`,
        abi: BRIDGE_ADAPTER_ABI,
        functionName: 'bridge',
        args: [
          BigInt(destWormholeChainId),
          amountWei,
          recipientAddress as `0x${string}`,
        ],
        chainId: sourceChainId,
        value: relayerFee,
      });

      await waitForTransactionReceipt(wagmiConfig, {
        hash: bridgeTx,
        chainId: sourceChainId,
      });

      setState(prev => ({
        ...prev,
        step: 'waiting-relay',
        txHashes: { ...prev.txHashes, bridge: bridgeTx }
      }));

      return {
        bridgeTxHash: bridgeTx,
        usedLockbox: needsConversion,
        txHashes: {
          ...state.txHashes,
          bridge: bridgeTx,
        },
      };

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: error.shortMessage || error.message || 'Bridge failed'
      }));
      throw error;
    }
  }, [
    address,
    sourceChain,
    sourceChainId,
    destWormholeChainId,
    getBalances,
    calculateAmounts,
    writeContractAsync,
    ensureCorrectChain,
    quoteRelayFee,
    state.txHashes,
  ]);

  const previewBridge = useCallback(async (amount: string) => {
    const amountWei = parseUnits(amount, TOKEN_DECIMALS);
    const balances = await getBalances();
    const { lockboxAmount, directAmount, needsConversion } = calculateAmounts(amountWei, balances);

    const steps: string[] = [];
    let txCount = 0;

    if (needsConversion) {
      steps.push('Approve wPOKT for Lockbox');
      steps.push('Convert wPOKT -> xPOKT via Lockbox');
      txCount += 2;
    }

    steps.push('Approve xPOKT for Bridge Adapter');
    steps.push(`Bridge to ${getChainName(destChain)}`);
    steps.push('Wait for auto-relay (~2-20 min)');
    txCount += 2;

    return {
      needsConversion,
      lockboxAmount: (lockboxAmount / BigInt(10 ** TOKEN_DECIMALS)).toString(),
      directAmount: (directAmount / BigInt(10 ** TOKEN_DECIMALS)).toString(),
      steps,
      estimatedTxCount: txCount,
      estimatedGas: needsConversion ? '~0.008 ETH' : '~0.005 ETH',
    };
  }, [getBalances, calculateAmounts, destChain]);

  const markComplete = useCallback(() => {
    setState(prev => ({ ...prev, step: 'complete' }));
  }, []);

  const reset = useCallback(() => {
    setState({
      step: 'idle',
      needsLockboxConversion: false,
      lockboxAmount: 0n,
      directAmount: 0n,
      txHashes: {},
      error: null,
    });
  }, []);

  return {
    state,
    bridge,
    previewBridge,
    getBalances,
    quoteRelayFee,
    markComplete,
    reset,
    sourceChain,
    destChain,
    supportsLockbox: chainConfig?.hasLockbox ?? false,
  };
}
