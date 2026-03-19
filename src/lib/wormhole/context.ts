import { wormhole, type Wormhole } from '@wormhole-foundation/sdk';

/**
 * Solana RPC endpoints for the Wormhole SDK.
 *
 * The SDK creates its own RPC connections for reading account data and
 * building transactions. It does NOT use the wallet adapter's connection.
 * We try the app's primary endpoint first, falling back to Ankr if it
 * fails. This is separate from the wallet adapter's failover because the
 * SDK caches its connection at init time.
 */
const SOLANA_RPC_PRIMARY = 'https://solana.api.pocket.network';
const SOLANA_RPC_FALLBACK = 'https://rpc.ankr.com/solana';

/** Quick health check — same pattern as WalletProviders */
async function checkRpcHealth(endpoint: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBlockHeight', params: [] }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = await res.json();
    return typeof data?.result === 'number';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let cached: Promise<Wormhole<'Mainnet'>> | null = null;

/**
 * Lazily initialise and cache the Wormhole SDK context.
 *
 * Picks the best available Solana RPC at init time (Pocket if healthy
 * within 2 s, otherwise Ankr). The result is cached for the session.
 */
export async function getWormholeContext(): Promise<Wormhole<'Mainnet'>> {
  if (cached) return cached;

  cached = (async () => {
    // Pick the best Solana RPC — same logic as WalletProviders but with
    // a tighter timeout since this blocks the bridge flow.
    let solanaRpc = SOLANA_RPC_FALLBACK;
    try {
      if (await checkRpcHealth(SOLANA_RPC_PRIMARY, 2000)) {
        solanaRpc = SOLANA_RPC_PRIMARY;
      }
    } catch {
      // Fall through to Ankr
    }

    const solana = (await import('@wormhole-foundation/sdk/solana')).default;
    const evm = (await import('@wormhole-foundation/sdk/evm')).default;
    return wormhole('Mainnet', [solana, evm], {
      chains: {
        Solana: { rpc: solanaRpc },
      },
    });
  })();

  return cached;
}
