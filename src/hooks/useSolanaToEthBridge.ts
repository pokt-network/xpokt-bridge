'use client';

import { useState, useCallback, useRef } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, type VersionedTransaction } from '@solana/web3.js';
import { Wormhole, type TokenTransfer } from '@wormhole-foundation/sdk';
import type {
  Network,
  Chain,
  SignAndSendSigner,
  UnsignedTransaction,
} from '@wormhole-foundation/sdk';
import type { SolanaUnsignedTransaction } from '@wormhole-foundation/sdk-solana';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { WORMHOLE_TOKEN_BRIDGE_ABI } from '@/lib/contracts/abis/wormholeTokenBridge';
import { wagmiConfig } from '@/lib/chains/config';
import { getWormholeContext } from '@/lib/wormhole/context';
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

/**
 * Adapter that wraps the Solana wallet adapter into a Wormhole SDK SignAndSendSigner.
 * This allows the Wormhole SDK to build Token Bridge transactions that the user signs
 * via their browser wallet (Phantom, Solflare, etc.).
 */
class SolanaWalletSigner<N extends Network, C extends Chain> implements SignAndSendSigner<N, C> {
  constructor(
    private _chain: C,
    private _address: string,
    private _signTransaction: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>,
    private _connection: { sendRawTransaction: (raw: Buffer | Uint8Array) => Promise<string>; confirmTransaction: (...args: any[]) => Promise<any>; getLatestBlockhash: () => Promise<{ blockhash: string; lastValidBlockHeight: number }> },
  ) {}

  chain(): C { return this._chain; }
  address(): string { return this._address; }

  async signAndSend(txs: UnsignedTransaction<N, C>[]): Promise<string[]> {
    const hashes: string[] = [];
    const { blockhash, lastValidBlockHeight } = await this._connection.getLatestBlockhash();

    for (const utx of txs) {
      // Extract the Solana Transaction from the Wormhole UnsignedTransaction wrapper
      const solanaUtx = utx as unknown as SolanaUnsignedTransaction<N>;
      const solTx = solanaUtx.transaction;
      const tx = solTx.transaction as Transaction;

      // Set blockhash and fee payer
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(this._address);

      // Sign with any additional signers (e.g., Wormhole message keypair)
      if (solTx.signers?.length) {
        tx.partialSign(...solTx.signers);
      }

      // Sign with user's wallet
      const signed = await this._signTransaction(tx);
      const serialized = (signed as Transaction).serialize();

      // Send and confirm
      const sig = await this._connection.sendRawTransaction(serialized);
      await this._connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      hashes.push(sig);
    }

    return hashes;
  }
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
      const wh = await getWormholeContext(connection.rpcEndpoint);

      // Build source (Solana) and destination (Ethereum) chain addresses
      const from = Wormhole.chainAddress('Solana', solanaSenderAddress);
      const to = Wormhole.chainAddress('Ethereum', ethRecipientAddress);

      // The POKT token on Solana (Wormhole-wrapped xPOKT)
      const token = Wormhole.chainAddress('Solana', CONTRACTS.solana.poktMint);

      // Create a TokenTransfer using the standard Token Bridge protocol
      const xfer = await wh.tokenTransfer(
        token,
        amount,
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

    // If we have a TokenTransfer object, use SDK's attestation fetching
    if (xferRef.current) {
      try {
        const attestIds = await xferRef.current.fetchAttestation(600_000); // 10 min timeout
        // The attestation is now cached on the TokenTransfer object
        return attestIds;
      } catch {
        // Fall back to manual VAA polling
      }
    }

    // Fallback: use the manual VAA polling hook
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
