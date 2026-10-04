import { Connection, type ConnectionConfig } from '@solana/web3.js';

/**
 * Solana RPC failover.
 *
 * Pocket Network is ALWAYS the primary endpoint (overridable via
 * NEXT_PUBLIC_SOLANA_RPC_URL). On ANY error from the current endpoint —
 * HTTP 4xx/5xx (notably 429 rate-limit, 500, and the gateway's 403/-32052),
 * a network failure, a timeout, or an endpoint-level JSON-RPC error delivered
 * with HTTP 200 (the gateway's intermittent -32603 "internal error") — we
 * cascade to the next endpoint in order.
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
    // Free public key (not a secret). Replaced rpc.ankr.com, which now 403s keyless requests.
    'https://solana.leorpc.com/?api_key=FREE',
  ]),
);

/** The endpoint web3.js/ConnectionProvider is nominally constructed with. */
export const SOLANA_PRIMARY_RPC = SOLANA_RPC_ENDPOINTS[0]!;

/**
 * JSON-RPC error codes that mean "this endpoint is unhealthy", not "your request
 * is bad". Gateways return these with HTTP 200, so status alone can't catch them.
 * Request-level errors (e.g. -32002 preflight/simulation failure) are NOT here:
 * they'd fail identically on every endpoint and must surface to the caller.
 */
const ENDPOINT_FAILURE_CODES = new Set([
  -32603, // internal error (Pocket gateway's intermittent failure mode)
  -32052, // gateway: API key not allowed / blocked
  -32005, // node is behind / unhealthy
  -32004, // block not available
  -32001, // slot skipped / cleaned up
]);

function isEndpointFailure(body: unknown): boolean {
  const entries = Array.isArray(body) ? body : [body];
  return entries.some((e) => {
    const code = (e as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === 'number' && ENDPOINT_FAILURE_CODES.has(code);
  });
}

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

      // HTTP 200 can still carry an endpoint-level JSON-RPC error. Read a clone
      // so the original body stays consumable by web3.js.
      if (!isLast) {
        try {
          const body: unknown = await res.clone().json();
          if (isEndpointFailure(body)) {
            lastError = new Error(`Solana RPC ${url} returned JSON-RPC endpoint error`);
            console.warn(`[SolanaRPC] ${url} → JSON-RPC endpoint error; failing over to ${next}`);
            continue;
          }
        } catch {
          // Non-JSON body: let web3.js handle/report it as before.
        }
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
