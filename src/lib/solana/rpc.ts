import { Connection, type ConnectionConfig } from '@solana/web3.js';

/**
 * Solana RPC failover.
 *
 * Pocket Network is ALWAYS the primary endpoint (overridable via
 * NEXT_PUBLIC_SOLANA_RPC_URL). On ANY error from the current endpoint —
 * HTTP 4xx/5xx (notably 429 rate-limit, 500, and the gateway's 403/-32052),
 * a network failure, or a timeout — we cascade to the next endpoint in order.
 *
 * This replaces the previous out-of-band health-probe approach, which only
 * advanced on a separate 60s probe (and probed `getBlockHeight`, a method the
 * gateway answered even while it 403'd `getLatestBlockhash`). Failover now
 * happens in-band, per request, driven by the actual RPC errors.
 */

const PRIMARY =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://solana.api.pocket.network';

/** Ordered endpoints. Primary first; deduped in case the override equals a fallback. */
export const SOLANA_RPC_ENDPOINTS: string[] = Array.from(
  new Set([
    PRIMARY,
    'https://solana-rpc.publicnode.com',
    'https://rpc.ankr.com/solana',
  ]),
);

/** The endpoint web3.js/ConnectionProvider is nominally constructed with. */
export const SOLANA_PRIMARY_RPC = SOLANA_RPC_ENDPOINTS[0]!;

/**
 * A drop-in `fetch` for a web3.js Connection that performs per-request failover.
 *
 * web3.js calls this once per RPC request with the URL it was built with. We
 * ignore that URL and drive our own ordered list, so every request starts at
 * the primary and, on any error, transparently retries the next endpoint.
 * Callers (wallet adapter, Wormhole SDK, our signer) see one successful
 * Response and never know failover happened.
 */
export const solanaFailoverFetch = async (
  _input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  let lastError: unknown;

  for (let i = 0; i < SOLANA_RPC_ENDPOINTS.length; i++) {
    const url = SOLANA_RPC_ENDPOINTS[i]!;
    const next = SOLANA_RPC_ENDPOINTS[i + 1];
    const isLast = i === SOLANA_RPC_ENDPOINTS.length - 1;

    try {
      const res = await fetch(url, init);

      // Any non-2xx (429 / 500 / 403 / …) is a reason to fail over.
      if (!res.ok) {
        lastError = new Error(`Solana RPC ${url} returned HTTP ${res.status}`);
        if (isLast) return res; // nothing left to try — surface the error response
        console.warn(`[SolanaRPC] ${url} → HTTP ${res.status}; failing over to ${next}`);
        continue;
      }

      if (i > 0) console.warn(`[SolanaRPC] served by fallback endpoint ${url}`);
      return res;
    } catch (err) {
      lastError = err;
      if (isLast) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[SolanaRPC] ${url} request failed (${msg}); failing over to ${next}`);
    }
  }

  throw lastError ?? new Error('All Solana RPC endpoints failed');
};

/** Connection config wired for failover. */
export const SOLANA_CONNECTION_CONFIG: ConnectionConfig = {
  commitment: 'confirmed',
  // Let our fetch wrapper own rate-limit handling: don't let web3.js sleep and
  // retry a 429 on the same endpoint when we can fail over immediately.
  disableRetryOnRateLimit: true,
  fetch: solanaFailoverFetch as unknown as ConnectionConfig['fetch'],
};

/** Build a failover-aware Connection (used to seed the Wormhole SDK). */
export function createSolanaConnection(): Connection {
  return new Connection(SOLANA_PRIMARY_RPC, SOLANA_CONNECTION_CONFIG);
}
