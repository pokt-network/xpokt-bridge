export const WORMHOLE_API_BASE = 'https://api.wormholescan.io/api/v1';

export async function fetchVAAStatus(txHash: string) {
  const response = await fetch(`${WORMHOLE_API_BASE}/transactions/${txHash}`);
  if (!response.ok) {
    throw new Error(`Wormhole API error: ${response.status}`);
  }
  return response.json();
}

export async function fetchVAABytes(
  emitterChain: number,
  emitterAddress: string,
  sequence: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${WORMHOLE_API_BASE}/vaas/${emitterChain}/${emitterAddress}/${sequence}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data?.data?.vaa ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch VAA via the /operations endpoint which works for BOTH EVM and Solana tx hashes.
 * The /transactions endpoint only works for EVM tx hashes and returns 404 for Solana.
 *
 * Returns { vaaBytes (hex), emitterChain, emitterAddress, sequence } or null.
 */
export async function fetchVAAFromOperations(txHash: string): Promise<{
  vaaBytes: string;
  emitterChain: number;
  emitterAddress: string;
  sequence: string;
} | null> {
  try {
    const response = await fetch(
      `${WORMHOLE_API_BASE}/operations?txHash=${encodeURIComponent(txHash)}`
    );
    if (!response.ok) return null;
    const data = await response.json();

    const op = data?.operations?.[0];
    if (!op) return null;

    // VAA bytes are base64-encoded in the operations response
    const vaaBase64 = op.vaa?.raw;
    if (!vaaBase64) return null;

    // Convert base64 to hex string
    const vaaBytes = base64ToHex(vaaBase64);

    return {
      vaaBytes,
      emitterChain: op.emitterChain,
      emitterAddress: op.emitterAddress?.hex ?? '',
      sequence: String(op.sequence),
    };
  } catch {
    return null;
  }
}

/** Convert a base64 string to a hex string */
function base64ToHex(base64: string): string {
  // Use atob in browser, Buffer in Node (Next.js SSR)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('hex');
  }
  const binary = atob(base64);
  let hex = '';
  for (let i = 0; i < binary.length; i++) {
    hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}
