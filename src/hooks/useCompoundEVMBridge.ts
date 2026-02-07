'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAccount, useWriteContract, useConfig } from 'wagmi';
import { readContract, waitForTransactionReceipt, switchChain } from '@wagmi/core';
import { parseUnits } from 'viem';
import { mainnet, base } from 'wagmi/chains';
import { CONTRACTS, WORMHOLE_CHAIN_IDS } from '@/lib/contracts/addresses';
import { ERC20_ABI } from '@/lib/contracts/abis/erc20';
import { LOCKBOX_ABI } from '@/lib/contracts/abis/lockbox';
import { BRIDGE_ADAPTER_ABI } from '@/lib/contracts/abis/bridgeAdapter';
import { wagmiConfig } from '@/lib/chains/config';
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

  // Determine chain IDs and chain objects
  const sourceChainId = sourceChain === 'ethereum' ? 1 : 8453;
  const sourceChainObj = sourceChain === 'ethereum' ? mainnet : base;
  const destWormholeChainId = destChain === 'ethereum'
    ? WORMHOLE_CHAIN_IDS.Ethereum
    : WORMHOLE_CHAIN_IDS.Base;

  // Get contract addresses for source chain
  const getSourceContracts = useCallback(() => {
    if (sourceChain === 'ethereum') {
      return {
        wPOKT: CONTRACTS.ethereum.wPOKT,
        xPOKT: CONTRACTS.ethereum.xPOKT,
        lockbox: CONTRACTS.ethereum.lockbox,
        bridgeAdapter: CONTRACTS.ethereum.bridgeAdapter,
      };
    } else {
      // Base has no wPOKT or Lockbox
      return {
        wPOKT: null,
        xPOKT: CONTRACTS.base.xPOKT,
        lockbox: null,
        bridgeAdapter: CONTRACTS.base.bridgeAdapter,
      };
    }
  }, [sourceChain]);

  /**
   * Read both wPOKT and xPOKT balances for the connected wallet.
   * Note: wPOKT only exists on Ethereum.
   * readContract uses RPC directly — no wallet chain switch needed.
   */
  const getBalances = useCallback(async (): Promise<TokenBalances> => {
    if (!address) return { wpokt: 0n, xpokt: 0n };
    const contracts = getSourceContracts();

    // Read xPOKT balance (exists on both chains)
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
  }, [address, getSourceContracts, sourceChainId]);

  /**
   * Calculate how much wPOKT needs conversion vs direct xPOKT bridging.
   * Strategy: Use xPOKT first (saves gas), then convert wPOKT as needed.
   */
  const calculateAmounts = useCallback((
    requestedAmount: bigint,
    balances: TokenBalances
  ): { lockboxAmount: bigint; directAmount: bigint; needsConversion: boolean } => {
    // If we have enough xPOKT, no conversion needed
    if (balances.xpokt >= requestedAmount) {
      return {
        lockboxAmount: 0n,
        directAmount: requestedAmount,
        needsConversion: false,
      };
    }

    // Use all available xPOKT, convert remaining from wPOKT
    const directAmount = balances.xpokt;
    const lockboxAmount = requestedAmount - directAmount;

    // Verify we have enough wPOKT
    if (lockboxAmount > balances.wpokt) {
      throw new Error('Insufficient total POKT balance');
    }

    return {
      lockboxAmount,
      directAmount,
      needsConversion: lockboxAmount > 0n,
    };
  }, []);

  /**
   * Ensure the wallet is on the correct chain before sending transactions.
   * Uses wagmi/core switchChain which works with most wallets including Rabby.
   * If the wallet doesn't support switching, it will throw and we handle it gracefully.
   */
  const ensureCorrectChain = useCallback(async () => {
    if (currentChainId === sourceChainId) return;

    console.log(`[CompoundEVMBridge] Switching from chain ${currentChainId} to ${sourceChainId}`);
    setState(prev => ({ ...prev, step: 'switching-chain' }));

    try {
      await switchChain(config, { chainId: sourceChainId });
    } catch (error: any) {
      // If wallet doesn't support switching, inform the user
      throw new Error(
        `Please switch your wallet to ${sourceChain === 'ethereum' ? 'Ethereum' : 'Base'} network manually and try again.`
      );
    }
  }, [currentChainId, sourceChainId, sourceChain, config]);

  /**
   * Query the Bridge Adapter's bridgeCost() to get the exact relay fee.
   * The contract enforces msg.value == bridgeCost() (strict equality),
   * so we must pass the exact quote — no buffer.
   * Call this as close to the bridge() transaction as possible to minimize staleness.
   */
  const quoteRelayFee = useCallback(async (): Promise<bigint> => {
    const contracts = getSourceContracts();

    const cost = await readContract(wagmiConfig, {
      address: contracts.bridgeAdapter as `0x${string}`,
      abi: BRIDGE_ADAPTER_ABI,
      functionName: 'bridgeCost',
      args: [destWormholeChainId],
      chainId: sourceChainId,
    }) as bigint;

    console.log(`[CompoundEVMBridge] Relay fee quote: ${cost} wei`);

    return cost;
  }, [getSourceContracts, destWormholeChainId, sourceChainId]);

  /**
   * Execute the full EVM bridge flow with automatic Lockbox conversion if needed.
   *
   * Flow when user has wPOKT:
   * 1. Approve wPOKT to Lockbox
   * 2. Deposit wPOKT to Lockbox (receive xPOKT)
   * 3. Approve xPOKT to Bridge Adapter
   * 4. Call bridge() on Bridge Adapter (with dynamically quoted relay fee)
   * 5. Wait for auto-relay (~2-20 min)
   *
   * Flow when user has xPOKT:
   * 1. Approve xPOKT to Bridge Adapter
   * 2. Call bridge() on Bridge Adapter (with dynamically quoted relay fee)
   * 3. Wait for auto-relay (~2-20 min)
   */
  const bridge = useCallback(async (
    amount: string,
    recipient?: string // Defaults to connected address
  ) => {
    if (!address) throw new Error('Wallet not connected');

    const contracts = getSourceContracts();
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
        // 2a: Approve wPOKT to Lockbox
        setState(prev => ({ ...prev, step: 'approving-wpokt' }));

        const wpoktApproveTx = await writeContractAsync({
          address: contracts.wPOKT as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [contracts.lockbox as `0x${string}`, lockboxAmount],
          chain: sourceChainObj,
        });

        await waitForTransactionReceipt(wagmiConfig, {
          hash: wpoktApproveTx,
          chainId: sourceChainId,
        });

        setState(prev => ({
          ...prev,
          txHashes: { ...prev.txHashes, wpoktApprove: wpoktApproveTx }
        }));

        // 2b: Deposit to Lockbox (wPOKT -> xPOKT)
        setState(prev => ({ ...prev, step: 'converting-lockbox' }));

        const lockboxTx = await writeContractAsync({
          address: contracts.lockbox as `0x${string}`,
          abi: LOCKBOX_ABI,
          functionName: 'deposit',
          args: [lockboxAmount],
          chain: sourceChainObj,
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

      const xpoktApproveTx = await writeContractAsync({
        address: contracts.xPOKT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [contracts.bridgeAdapter as `0x${string}`, amountWei],
        chain: sourceChainObj,
      });

      await waitForTransactionReceipt(wagmiConfig, {
        hash: xpoktApproveTx,
        chainId: sourceChainId,
      });

      setState(prev => ({
        ...prev,
        txHashes: { ...prev.txHashes, xpoktApprove: xpoktApproveTx }
      }));

      // Step 4: Quote exact relay fee then call bridge() immediately
      // bridgeCost() enforces strict msg.value equality, so query right before sending
      setState(prev => ({ ...prev, step: 'bridging' }));
      const relayerFee = await quoteRelayFee();

      const bridgeTx = await writeContractAsync({
        address: contracts.bridgeAdapter as `0x${string}`,
        abi: BRIDGE_ADAPTER_ABI,
        functionName: 'bridge',
        args: [
          BigInt(destWormholeChainId), // uint256 dstChainId (contract casts to uint16 internally)
          amountWei,                   // uint256 amount
          recipientAddress as `0x${string}`, // address to
        ],
        chain: sourceChainObj,
        value: relayerFee,             // Exact relay fee from bridgeCost() (strict equality enforced)
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

      // Return bridge tx hash - user can track via Wormholescan
      // Auto-relay will complete in ~2-20 minutes
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
    getSourceContracts,
    sourceChainId,
    sourceChainObj,
    destWormholeChainId,
    getBalances,
    calculateAmounts,
    writeContractAsync,
    ensureCorrectChain,
    quoteRelayFee,
    state.txHashes,
  ]);

  /**
   * Preview what the bridge will do without executing.
   * Useful for showing the user how many transactions they'll need to sign.
   */
  const previewBridge = useCallback(async (amount: string): Promise<{
    needsConversion: boolean;
    lockboxAmount: string;
    directAmount: string;
    steps: string[];
    estimatedTxCount: number;
    estimatedGas: string;
  }> => {
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
    steps.push(`Bridge to ${destChain === 'ethereum' ? 'Ethereum' : 'Base'}`);
    steps.push('Wait for auto-relay (~2-20 min)');
    txCount += 2; // Approve + Bridge

    return {
      needsConversion,
      lockboxAmount: (lockboxAmount / BigInt(10 ** TOKEN_DECIMALS)).toString(),
      directAmount: (directAmount / BigInt(10 ** TOKEN_DECIMALS)).toString(),
      steps,
      estimatedTxCount: txCount,
      estimatedGas: needsConversion ? '~0.008 ETH' : '~0.005 ETH',
    };
  }, [getBalances, calculateAmounts, destChain]);

  /**
   * Mark bridge as complete (called when destination balance increases)
   */
  const markComplete = useCallback(() => {
    setState(prev => ({ ...prev, step: 'complete' }));
  }, []);

  /**
   * Reset the hook state
   */
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

    // Expose for UI
    sourceChain,
    destChain,
    supportsLockbox: sourceChain === 'ethereum', // Only Ethereum has Lockbox
  };
}
