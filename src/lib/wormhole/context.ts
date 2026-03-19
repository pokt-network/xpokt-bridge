import { wormhole, type Wormhole } from '@wormhole-foundation/sdk';

/**
 * Pocket Network is the only Solana RPC for the Wormhole SDK.
 * The SDK creates its own RPC connection for reading account data
 * and building transactions.
 */
const SOLANA_RPC = 'https://solana.api.pocket.network';

let cached: Promise<Wormhole<'Mainnet'>> | null = null;

/**
 * Lazily initialise and cache the Wormhole SDK context.
 * Uses Pocket Network as the Solana RPC — no third-party fallback.
 */
export async function getWormholeContext(): Promise<Wormhole<'Mainnet'>> {
  if (cached) return cached;

  cached = (async () => {
    const solana = (await import('@wormhole-foundation/sdk/solana')).default;
    const evm = (await import('@wormhole-foundation/sdk/evm')).default;
    return wormhole('Mainnet', [solana, evm], {
      chains: {
        Solana: { rpc: SOLANA_RPC },
      },
    });
  })();

  return cached;
}
