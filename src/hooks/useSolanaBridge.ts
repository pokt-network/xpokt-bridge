'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { parseUnits } from 'viem';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { ERC20_ABI } from '@/lib/contracts/abis/erc20';
import { WORMHOLE_TOKEN_BRIDGE_ABI } from '@/lib/contracts/abis/wormholeTokenBridge';
import { wagmiConfig } from '@/lib/chains/config';
import { useWormholeVAA } from './useWormholeVAA';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

const TOKEN_DECIMALS = 6;

export type SolanaBridgeStep =
  | 'idle'
  | 'approving'
  | 'initiating'
  | 'waiting-vaa'
  | 'completing'
  | 'complete'
  | 'error';

interface SolanaBridgeState {
  step: SolanaBridgeStep;
  approveTxHash?: string;
  initiateTxHash?: string;
  completeTxHash?: string;
  error: string | null;
}

function solanaAddressToBytes32(solanaAddress: string): `0x${string}` {
  const pubkey = new PublicKey(solanaAddress);
  const bytes = pubkey.toBytes();
  const hex = Buffer.from(bytes).toString('hex').padStart(64, '0');
  return `0x${hex}` as `0x${string}`;
}

export function useSolanaBridge() {
  const { address: evmAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const vaaHook = useWormholeVAA();

  const [state, setState] = useState<SolanaBridgeState>({
    step: 'idle',
    error: null,
  });

  const initiateTransfer = useCallback(async (
    amount: string,
    evmSenderAddress: string,
    solanaRecipientAddress: string,
  ) => {
    if (!evmAddress) throw new Error('EVM wallet not connected');

    const amountWei = parseUnits(amount, TOKEN_DECIMALS);

    // CRITICAL: Wormhole Token Bridge on Solana delivers tokens to an Associated
    // Token Address (ATA), NOT a raw wallet address. We must derive the ATA from
    // the recipient wallet + POKT mint, then encode that as the bytes32 recipient.
    const recipientPubkey = new PublicKey(solanaRecipientAddress);
    const poktMint = new PublicKey(CONTRACTS.solana.poktMint);
    const recipientATA = await getAssociatedTokenAddress(poktMint, recipientPubkey);
    const recipientBytes32 = solanaAddressToBytes32(recipientATA.toBase58());

    try {
      // Approve xPOKT to Wormhole Token Bridge
      setState({ step: 'approving', error: null });
      const approveTx = await writeContractAsync({
        address: CONTRACTS.ethereum.xPOKT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.ethereum.wormholeTokenBridge as `0x${string}`, amountWei],
        chainId: 1,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: approveTx, chainId: 1 });
      setState(prev => ({ ...prev, approveTxHash: approveTx }));

      // Initiate transfer via Token Bridge
      setState(prev => ({ ...prev, step: 'initiating' }));
      const nonce = Math.floor(Math.random() * 4294967295);
      const initTx = await writeContractAsync({
        address: CONTRACTS.ethereum.wormholeTokenBridge as `0x${string}`,
        abi: WORMHOLE_TOKEN_BRIDGE_ABI,
        functionName: 'transferTokens',
        args: [
          CONTRACTS.ethereum.xPOKT as `0x${string}`,
          amountWei,
          1, // Solana Wormhole chain ID
          recipientBytes32,
          0n, // arbiterFee
          nonce,
        ],
        chainId: 1,
        value: 0n,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: initTx, chainId: 1 });

      setState(prev => ({ ...prev, step: 'waiting-vaa', initiateTxHash: initTx }));
      return { sourceTxHash: initTx, approveTxHash: approveTx };
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error: error.message }));
      throw error;
    }
  }, [evmAddress, writeContractAsync]);

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
    // Note: In production, this would use the Solana wallet to submit
    // the VAA redemption transaction. For now, store as complete.
    setState(prev => ({ ...prev, step: 'complete' }));
    return vaaBytes;
  }, []);

  const resumeFromVAA = useCallback(async (sourceTxHash: string) => {
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
