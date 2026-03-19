import { wormhole, type Wormhole } from '@wormhole-foundation/sdk';

/**
 * Cached Wormhole SDK context, keyed by Solana RPC URL.
 *
 * The SDK creates its own RPC connections internally. By default it uses
 * https://api.mainnet-beta.solana.com which is rate-limited and
 * CORS-restricted in browsers. We override this with the app's
 * Solana RPC endpoint (Pocket Network / Ankr fallback).
 */
let cached: { promise: Promise<Wormhole<'Mainnet'>>; rpcUrl: string } | null = null;

export async function getWormholeContext(solanaRpcUrl: string): Promise<Wormhole<'Mainnet'>> {
  // Re-create if the RPC URL changed (e.g., failover from Pocket to Ankr)
  if (cached && cached.rpcUrl === solanaRpcUrl) {
    return cached.promise;
  }

  const promise = (async () => {
    const solana = (await import('@wormhole-foundation/sdk/solana')).default;
    const evm = (await import('@wormhole-foundation/sdk/evm')).default;
    return wormhole('Mainnet', [solana, evm], {
      chains: {
        Solana: { rpc: solanaRpcUrl },
      },
    });
  })();

  cached = { promise, rpcUrl: solanaRpcUrl };
  return promise;
}
