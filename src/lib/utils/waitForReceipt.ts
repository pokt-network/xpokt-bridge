import { waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '@/lib/chains/config';

/**
 * waitForTransactionReceipt with retry logic for transient failures.
 *
 * The default viem behaviour can error with "Transaction receipt … could not
 * be found" when a tx hasn't propagated to the RPC node yet, or when a
 * transient HTTP/network error interrupts polling.  This wrapper retries up
 * to `retries` times with a delay, and also bumps the polling interval so
 * slow-to-mine bridge transactions aren't abandoned prematurely.
 */
export async function waitForReceiptWithRetry(
  hash: `0x${string}`,
  chainId: 1 | 8453 | 42161,
  { retries = 4, delayMs = 4000 }: { retries?: number; delayMs?: number } = {}
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await waitForTransactionReceipt(wagmiConfig, {
        hash,
        chainId,
        // Give the tx more time — default can be too aggressive for bridge txs
        timeout: 120_000,
        pollingInterval: 4_000,
      });
    } catch (err: any) {
      const msg = err?.message || err?.shortMessage || '';
      const isTransient =
        msg.includes('could not be found') ||
        msg.includes('not be processed on a block yet') ||
        msg.includes('HTTP request failed') ||
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('timeout');

      if (isTransient && attempt < retries) {
        console.warn(
          `[waitForReceipt] Attempt ${attempt}/${retries} failed for ${hash.slice(0, 10)}…, retrying in ${delayMs / 1000}s`
        );
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  // Unreachable, but satisfies TS
  throw new Error('waitForReceiptWithRetry: exhausted retries');
}
