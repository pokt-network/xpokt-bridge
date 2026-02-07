'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { parseUnits } from 'viem';
import { CONTRACTS, WORMHOLE_CHAIN_IDS } from '@/lib/contracts/addresses';
import { ERC20_ABI } from '@/lib/contracts/abis/erc20';
import { BRIDGE_ADAPTER_ABI } from '@/lib/contracts/abis/bridgeAdapter';
import { wagmiConfig } from '@/lib/chains/config';
import type { EvmChain } from '@/types/bridge';

const TOKEN_DECIMALS = 6;

export type EVMBridgeStep = 'idle' | 'approving' | 'bridging' | 'waiting-relay' | 'complete' | 'error';

interface EVMBridgeState {
  step: EVMBridgeStep;
  approveTxHash?: string;
  bridgeTxHash?: string;
  error: string | null;
}

interface UseEVMBridgeOptions {
  sourceChain: EvmChain;
  destChain: EvmChain;
}

export function useEVMBridge({ sourceChain, destChain }: UseEVMBridgeOptions) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<EVMBridgeState>({
    step: 'idle',
    error: null,
  });

  const sourceChainId = sourceChain === 'ethereum' ? 1 : 8453;
  const destWormholeChainId = destChain === 'ethereum'
    ? WORMHOLE_CHAIN_IDS.Ethereum
    : WORMHOLE_CHAIN_IDS.Base;

  const getSourceContracts = useCallback(() => {
    if (sourceChain === 'ethereum') {
      return {
        xPOKT: CONTRACTS.ethereum.xPOKT,
        bridgeAdapter: CONTRACTS.ethereum.bridgeAdapter,
      };
    }
    return {
      xPOKT: CONTRACTS.base.xPOKT,
      bridgeAdapter: CONTRACTS.base.bridgeAdapter,
    };
  }, [sourceChain]);

  const bridge = useCallback(async (amount: string, recipient?: string) => {
    if (!address) throw new Error('Wallet not connected');

    const contracts = getSourceContracts();
    const amountWei = parseUnits(amount, TOKEN_DECIMALS);
    const recipientAddress = recipient || address;

    try {
      // Approve xPOKT to Bridge Adapter
      setState({ step: 'approving', error: null });
      const approveTx = await writeContractAsync({
        address: contracts.xPOKT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [contracts.bridgeAdapter as `0x${string}`, amountWei],
        chainId: sourceChainId,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: approveTx, chainId: sourceChainId });
      setState(prev => ({ ...prev, approveTxHash: approveTx }));

      // Get exact relay fee from Bridge Adapter (contract enforces strict equality)
      setState(prev => ({ ...prev, step: 'bridging' }));
      const relayerFee = await readContract(wagmiConfig, {
        address: contracts.bridgeAdapter as `0x${string}`,
        abi: BRIDGE_ADAPTER_ABI,
        functionName: 'bridgeCost',
        args: [destWormholeChainId],
        chainId: sourceChainId,
      }) as bigint;

      // Call bridge() on Bridge Adapter with exact quoted fee
      const bridgeTx = await writeContractAsync({
        address: contracts.bridgeAdapter as `0x${string}`,
        abi: BRIDGE_ADAPTER_ABI,
        functionName: 'bridge',
        args: [BigInt(destWormholeChainId), amountWei, recipientAddress as `0x${string}`],
        chainId: sourceChainId,
        value: relayerFee,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: bridgeTx, chainId: sourceChainId });

      setState(prev => ({ ...prev, step: 'waiting-relay', bridgeTxHash: bridgeTx }));
      return { approveTxHash: approveTx, bridgeTxHash: bridgeTx };
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error: error.message || 'Bridge failed' }));
      throw error;
    }
  }, [address, getSourceContracts, sourceChainId, destWormholeChainId, writeContractAsync]);

  const markComplete = useCallback(() => {
    setState(prev => ({ ...prev, step: 'complete' }));
  }, []);

  const reset = useCallback(() => {
    setState({ step: 'idle', error: null });
  }, []);

  return {
    state,
    bridge,
    markComplete,
    reset,
    sourceChain,
    destChain,
  };
}
