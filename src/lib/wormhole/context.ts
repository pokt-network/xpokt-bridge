import { wormhole, type Wormhole } from '@wormhole-foundation/sdk';
import {
  SOLANA_PRIMARY_RPC,
  createSolanaConnection,
} from '@/lib/solana/rpc';

let cached: Promise<Wormhole<'Mainnet'>> | null = null;

/**
 * Lazily initialise and cache the Wormhole SDK context.
 *
 * The SDK builds its own `new Connection(rpc)` per chain with no failover, so a
 * 403/429/500 from the primary Solana gateway would throw mid-claim ("failed to
 * get recent blockhash") with no recovery. To fix that, we pre-seed the SDK's
 * memoized Solana chain with a failover-aware Connection (see lib/solana/rpc).
 * Every internal `wh.getChain('Solana')` — including those inside
 * tokenTransfer() and redeem() — then reads through the cascading endpoints,
 * with Pocket Network always primary.
 */
export async function getWormholeContext(): Promise<Wormhole<'Mainnet'>> {
  if (cached) return cached;

  cached = (async () => {
    const solana = (await import('@wormhole-foundation/sdk/solana')).default;
    const evm = (await import('@wormhole-foundation/sdk/evm')).default;
    const wh = await wormhole('Mainnet', [solana, evm], {
      chains: {
        // Nominal RPC for the SDK; the seeded failover Connection below is what
        // actually services Solana reads.
        Solana: { rpc: SOLANA_PRIMARY_RPC },
      },
    });

    try {
      const solanaChain = wh
        .getPlatform('Solana')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .getChain('Solana', createSolanaConnection() as any);
      (wh as unknown as { _chains: Map<string, unknown> })._chains.set(
        'Solana',
        solanaChain,
      );
    } catch (e) {
      // Non-fatal: fall back to the SDK's default single-endpoint connection.
      console.warn('[Wormhole] could not seed failover Solana connection:', e);
    }

    return wh;
  })();

  return cached;
}
