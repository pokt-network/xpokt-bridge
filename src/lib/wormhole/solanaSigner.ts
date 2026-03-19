import { PublicKey, Transaction, type VersionedTransaction, type Connection } from '@solana/web3.js';
import type {
  Network,
  Chain,
  SignAndSendSigner,
  UnsignedTransaction,
} from '@wormhole-foundation/sdk';
import type { SolanaUnsignedTransaction } from '@wormhole-foundation/sdk-solana';
import { createPriorityFeeInstructions } from '@wormhole-foundation/sdk-solana';

/**
 * Adapter that wraps the Solana wallet adapter into a Wormhole SDK
 * SignAndSendSigner. Handles blockhash freshness, priority fees, and
 * retry-friendly send options so transactions land on-chain before
 * their blockhash expires.
 */
export class SolanaWalletSigner<N extends Network, C extends Chain>
  implements SignAndSendSigner<N, C>
{
  constructor(
    private _chain: C,
    private _address: string,
    private _signTransaction: (
      tx: Transaction | VersionedTransaction,
    ) => Promise<Transaction | VersionedTransaction>,
    private _connection: Connection,
  ) {}

  chain(): C {
    return this._chain;
  }
  address(): string {
    return this._address;
  }

  async signAndSend(txs: UnsignedTransaction<N, C>[]): Promise<string[]> {
    const hashes: string[] = [];

    for (const utx of txs) {
      const solanaUtx = utx as unknown as SolanaUnsignedTransaction<N>;
      const solTx = solanaUtx.transaction;
      const tx = solTx.transaction as Transaction;

      // Fresh blockhash PER transaction — avoids expiry if the user
      // takes a few seconds to approve in their wallet.
      const { blockhash, lastValidBlockHeight } =
        await this._connection.getLatestBlockhash('confirmed');

      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(this._address);

      // Add priority fee instructions so the transaction is competitive
      // on a congested network. Uses the SDK helper that queries recent
      // fee percentiles and emits SetComputeUnitLimit + SetComputeUnitPrice.
      try {
        const priorityIxs = await createPriorityFeeInstructions(
          this._connection,
          tx,
          75,   // 75th percentile of recent fees
          1.2,  // 1.2x multiplier
          1_000,    // min 1,000 microlamports
          500_000,  // max 500,000 microlamports
        );
        // Prepend priority instructions (must come before program instructions)
        if (priorityIxs.length > 0) {
          tx.instructions = [...priorityIxs, ...tx.instructions];
        }
      } catch {
        // Non-fatal — transaction can still land without priority fees
      }

      // Sign with any additional signers the SDK attached (e.g., the
      // Wormhole message keypair). Must happen AFTER blockhash is set
      // because partialSign commits to the blockhash.
      if (solTx.signers?.length) {
        tx.partialSign(...solTx.signers);
      }

      // Prompt the user's wallet
      const signed = await this._signTransaction(tx);
      const serialized = (signed as Transaction).serialize();

      // Send with skipPreflight to avoid the extra simulation round-trip.
      // maxRetries lets the RPC node retry forwarding to leaders.
      const sig = await this._connection.sendRawTransaction(serialized, {
        skipPreflight: true,
        maxRetries: 5,
      });

      // Wait for confirmation
      await this._connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      hashes.push(sig);
    }

    return hashes;
  }
}
