'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { parseUnits } from 'viem';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, type VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { wormhole, Wormhole } from '@wormhole-foundation/sdk';
import type {
  Network,
  Chain,
  SignAndSendSigner,
  UnsignedTransaction,
} from '@wormhole-foundation/sdk';
import type { SolanaUnsignedTransaction } from '@wormhole-foundation/sdk-solana';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { ERC20_ABI } from '@/lib/contracts/abis/erc20';
import { WORMHOLE_TOKEN_BRIDGE_ABI } from '@/lib/contracts/abis/wormholeTokenBridge';
import { wagmiConfig } from '@/lib/chains/config';
import { useWormholeVAA } from './useWormholeVAA';

const TOKEN_DECIMALS = 6;

function solanaAddressToBytes32(solanaAddress: string): `0x${string}` {
  const pubkey = new PublicKey(solanaAddress);
  const bytes = pubkey.toBytes();
  const hex = Buffer.from(bytes).toString('hex').padStart(64, '0');
  return `0x${hex}` as `0x${string}`;
}

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

/**
 * Adapter that wraps the Solana wallet adapter into a Wormhole SDK SignAndSendSigner.
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
      const solanaUtx = utx as unknown as SolanaUnsignedTransaction<N>;
      const solTx = solanaUtx.transaction;
      const tx = solTx.transaction as Transaction;

      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(this._address);

      if (solTx.signers?.length) {
        tx.partialSign(...solTx.signers);
      }

      const signed = await this._signTransaction(tx);
      const serialized = (signed as Transaction).serialize();
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

/** Lazily initialize and cache the Wormhole SDK context */
let whPromise: Promise<Wormhole<'Mainnet'>> | null = null;
async function getWormholeContext(): Promise<Wormhole<'Mainnet'>> {
  if (!whPromise) {
    whPromise = (async () => {
      const solana = (await import('@wormhole-foundation/sdk/solana')).default;
      const evm = (await import('@wormhole-foundation/sdk/evm')).default;
      return wormhole('Mainnet', [solana, evm]);
    })();
  }
  return whPromise;
}

export function useSolanaBridge() {
  const { address: evmAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { publicKey: solanaPublicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const vaaHook = useWormholeVAA();

  const [state, setState] = useState<SolanaBridgeState>({
    step: 'idle',
    error: null,
  });

  /**
   * ETH → Solana: Lock xPOKT on Ethereum via Wormhole Token Bridge.
   * This uses direct wagmi contract calls (no Wormhole SDK needed for EVM side).
   */
  const initiateTransfer = useCallback(async (
    amount: string,
    evmSenderAddress: string,
    solanaRecipientAddress: string,
  ) => {
    if (!evmAddress) throw new Error('EVM wallet not connected');

    const amountWei = parseUnits(amount, TOKEN_DECIMALS);

    // Derive the ATA for the recipient on Solana
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

  /**
   * Complete the ETH → Solana transfer by redeeming the VAA on Solana.
   * This mints the wrapped POKT SPL tokens to the recipient's ATA.
   *
   * Uses the Wormhole SDK to build the Solana redeem transaction,
   * then signs it with the user's Solana wallet.
   */
  const completeTransfer = useCallback(async (vaaBytes: string) => {
    if (!solanaPublicKey || !signTransaction) {
      throw new Error('Solana wallet not connected');
    }

    setState(prev => ({ ...prev, step: 'completing' }));

    try {
      const wh = await getWormholeContext();
      const solanaChain = wh.getChain('Solana');

      // Get the TokenBridge protocol for Solana
      const tb = await solanaChain.getTokenBridge();

      // Decode VAA bytes
      const vaaData = Uint8Array.from(
        Buffer.from(vaaBytes.startsWith('0x') ? vaaBytes.slice(2) : vaaBytes, 'hex')
      );

      // Parse the VAA using the SDK
      const { deserialize } = await import('@wormhole-foundation/sdk');
      const vaa = deserialize('TokenBridge:Transfer', vaaData);

      // Build the redeem transactions
      const senderAddress = Wormhole.parseAddress(
        'Solana',
        solanaPublicKey.toBase58(),
      );

      const redeemTxs = tb.redeem(senderAddress, vaa);

      // Create signer adapter
      const signer = new SolanaWalletSigner<'Mainnet', 'Solana'>(
        'Solana',
        solanaPublicKey.toBase58(),
        signTransaction,
        connection,
      );

      // Sign and send each transaction
      const txList: UnsignedTransaction<'Mainnet', 'Solana'>[] = [];
      for await (const tx of redeemTxs) {
        txList.push(tx);
      }

      const hashes = await signer.signAndSend(txList);
      const completeTxHash = hashes[hashes.length - 1] ?? '';

      setState(prev => ({ ...prev, step: 'complete', completeTxHash }));
      return completeTxHash;
    } catch (error: any) {
      setState(prev => ({ ...prev, step: 'error', error: error.message }));
      throw error;
    }
  }, [solanaPublicKey, signTransaction, connection]);

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
