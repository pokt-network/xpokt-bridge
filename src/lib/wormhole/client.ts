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
