'use client';

import { useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import type { Connection } from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';

export class SolanaWalletSigner {
  private wallet: WalletContextState;
  private connection: Connection;

  constructor(wallet: WalletContextState, connection: Connection) {
    this.wallet = wallet;
    this.connection = connection;
  }

  chain(): string {
    return 'Solana';
  }

  address(): string {
    return this.wallet.publicKey?.toBase58() ?? '';
  }

  async signAndSend(txs: any[]): Promise<string[]> {
    const results: string[] = [];
    for (const tx of txs) {
      let signature: string;
      if (tx instanceof VersionedTransaction) {
        signature = await this.wallet.sendTransaction(tx, this.connection);
      } else if (tx instanceof Transaction) {
        signature = await this.wallet.sendTransaction(tx, this.connection);
      } else {
        // Handle raw transaction bytes or serialized transactions
        const transaction = VersionedTransaction.deserialize(
          typeof tx === 'string' ? Buffer.from(tx, 'base64') : tx
        );
        signature = await this.wallet.sendTransaction(transaction, this.connection);
      }

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');
      results.push(signature);
    }
    return results;
  }
}

export function useSolanaWormholeSigner(): SolanaWalletSigner | null {
  const wallet = useWallet();
  const { connection } = useConnection();

  return useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    return new SolanaWalletSigner(wallet, connection);
  }, [wallet, connection]);
}
