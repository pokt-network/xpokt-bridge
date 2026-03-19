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

      // Wait for confirmation. If the blockhash expires before we get
      // confirmation, the tx may still have landed — check explicitly
      // before treating it as a failure.
      try {
        await this._connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          'confirmed',
        );
      } catch (confirmError: any) {
        const isExpired =
          confirmError?.message?.includes('block height exceeded') ||
          confirmError?.message?.includes('expired');

        if (isExpired) {
          // The blockhash expired before we got confirmation, but the
          // tx may have landed anyway. Poll getSignatureStatuses to check.
          const confirmed = await this.checkTxLanded(sig);
          if (!confirmed) {
            throw new Error(
              `Transaction ${sig} was submitted but could not be confirmed. ` +
              `It may still land — check Solscan before retrying.`
            );
          }
          // tx DID land — continue normally
        } else {
          throw confirmError;
        }
      }

      hashes.push(sig);
    }

    return hashes;
  }

  /**
   * Poll getSignatureStatuses to check whether a transaction actually
   * confirmed on-chain, even though confirmTransaction timed out.
   * Retries a few times with short delays since the RPC may lag behind.
   */
  private async checkTxLanded(sig: string): Promise<boolean> {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const { value } = await this._connection.getSignatureStatuses([sig]);
        const status = value?.[0];
        if (status) {
          if (status.err) {
            // Transaction landed but failed on-chain
            throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
          }
          if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
            return true;
          }
        }
      } catch (e: any) {
        // If it's our own "failed on-chain" error, rethrow
        if (e.message?.startsWith('Transaction failed on-chain')) throw e;
        // Otherwise, RPC error — retry
      }
      // Wait 2 seconds between checks
      await new Promise(r => setTimeout(r, 2000));
    }
    return false;
  }
}
