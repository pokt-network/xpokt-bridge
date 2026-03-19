'use client';

import { useState, useCallback, useRef } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Wormhole, type TokenTransfer } from '@wormhole-foundation/sdk';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { WORMHOLE_TOKEN_BRIDGE_ABI } from '@/lib/contracts/abis/wormholeTokenBridge';
import { wagmiConfig } from '@/lib/chains/config';
import { getWormholeContext } from '@/lib/wormhole/context';
import { SolanaWalletSigner } from '@/lib/wormhole/solanaSigner';
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
  const { address: evmAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { publicKey: solanaPublicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  // Store the TokenTransfer object for use across initiate → fetchAttestation → complete
  const xferRef = useRef<TokenTransfer<'Mainnet'> | null>(null);

  const [state, setState] = useState<SolanaToEthBridgeState>({
    step: 'idle',
    error: null,
  });

  /**
   * Initiate the Solana → ETH bridge by burning POKT SPL tokens on Solana
   * via the Wormhole Token Bridge.
   */
  const initiateTransfer = useCallback(async (
    amount: bigint,
    solanaSenderAddress: string,
    ethRecipientAddress: string,
  ) => {
    if (!solanaPublicKey || !signTransaction) {
      throw new Error('Solana wallet not connected');
    }

    try {
      setState({ step: 'initiating', error: null });

      // Initialize Wormhole SDK with the app's Solana RPC endpoint
      const wh = await getWormholeContext();

      // Build source (Solana) and destination (Ethereum) chain addresses
      const from = Wormhole.chainAddress('Solana', solanaSenderAddress);
      const to = Wormhole.chainAddress('Ethereum', ethRecipientAddress);

      // POKT on Solana is a Wormhole-wrapped version of xPOKT from Ethereum.
      // We must reference the ORIGINAL Ethereum token so the SDK knows to
      // burn the wrapped asset on Solana (not attempt a native lock).
      const token = Wormhole.chainAddress('Ethereum', CONTRACTS.ethereum.xPOKT);

      // Create a TokenTransfer using the standard Token Bridge protocol.
      // Wormhole SDK types require `bigint` but the underlying Solana Token Bridge
      // serialisation goes through Anchor → BN.js v4 which chokes on native BigInt.
      // Passing the value as a string at runtime avoids BN.js while satisfying types via cast.
      const xfer = await wh.tokenTransfer(
        token,
        amount.toString() as unknown as bigint,
        from,
        to,
        'TokenBridge',
      );
      xferRef.current = xfer;

      // Create the signer adapter for Solana wallet
      const signer = new SolanaWalletSigner<'Mainnet', 'Solana'>(
        'Solana',
        solanaSenderAddress,
        signTransaction,
        connection,
      );

      // Initiate the transfer — this will prompt the user to sign the Solana transaction
      const txids = await xfer.initiateTransfer(signer);

      if (!txids || txids.length === 0) {
        throw new Error('No transaction was submitted. The Solana wallet may have rejected the request.');
      }

      const sourceTxHash = txids[txids.length - 1]!;

      setState(prev => ({
        ...prev,
        step: 'waiting-vaa',
        initiateTxHash: sourceTxHash,
      }));

      return { sourceTxHash, amount };
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error: error.message }));
      throw error;
    }
  }, [solanaPublicKey, signTransaction, connection]);

  /**
   * Wait for the Wormhole guardians to sign the VAA attestation.
   * Uses the Wormhole SDK's built-in polling.
   */
  const waitForVAA = useCallback(async (sourceTxHash: string) => {
    setState(prev => ({ ...prev, step: 'waiting-vaa' }));

    const vaa = await vaaHook.pollForVAA(sourceTxHash);
    if (!vaa) {
      setState(prev => ({ ...prev, step: 'error', error: 'VAA not found' }));
      return null;
    }
    return vaa;
  }, [vaaHook]);

  /**
   * Complete the transfer by calling completeTransfer on the Ethereum Token Bridge.
   * This redeems the VAA and unlocks xPOKT on Ethereum.
   *
   * Accepts either:
   * - VAA bytes as a hex string (from manual polling)
   * - Or relies on the cached TokenTransfer object (from SDK flow)
   */
  const completeTransfer = useCallback(async (vaaBytes: string) => {
    if (!evmAddress) throw new Error('EVM wallet not connected');

    setState(prev => ({ ...prev, step: 'completing' }));

    try {
      // Convert the VAA hex string to bytes for the contract call
      const vaaData = vaaBytes.startsWith('0x') ? vaaBytes : `0x${vaaBytes}`;

      const completeTx = await writeContractAsync({
        address: CONTRACTS.ethereum.wormholeTokenBridge as `0x${string}`,
        abi: WORMHOLE_TOKEN_BRIDGE_ABI,
        functionName: 'completeTransfer',
        args: [vaaData as `0x${string}`],
        chainId: 1,
      });

      await waitForTransactionReceipt(wagmiConfig, {
        hash: completeTx,
        chainId: 1,
      });

      setState(prev => ({ ...prev, step: 'complete', completeTxHash: completeTx }));
      return completeTx;
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error: error.message }));
      throw error;
    }
  }, [evmAddress, writeContractAsync]);

  const resumeFromVAA = useCallback(async (sourceTxHash: string, _sourceChain: string) => {
    setState(prev => ({
      ...prev,
      step: 'waiting-vaa',
      initiateTxHash: sourceTxHash,
      error: null,
    }));
    return waitForVAA(sourceTxHash);
  }, [waitForVAA]);

  const reset = useCallback(() => {
    setState({ step: 'idle', error: null });
    xferRef.current = null;
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
