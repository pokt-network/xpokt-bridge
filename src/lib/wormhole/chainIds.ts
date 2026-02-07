export const WORMHOLE_CHAIN_IDS = {
  solana: 1,
  ethereum: 2,
  base: 30,
} as const;

export type WormholeChainId = typeof WORMHOLE_CHAIN_IDS[keyof typeof WORMHOLE_CHAIN_IDS];

export function getWormholeChainId(chain: 'ethereum' | 'base' | 'solana'): number {
  return WORMHOLE_CHAIN_IDS[chain];
}
