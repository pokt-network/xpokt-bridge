/**
 * Chain Registry — Single Source of Truth (SSOT) for all chain configurations.
 *
 * Adding a new EVM chain requires ONLY:
 * 1. Adding an entry here
 * 2. Adding contract addresses in addresses.ts
 * 3. Adding the wagmi chain to config.ts
 *
 * No component or hook changes needed.
 */

export interface ChainConfig {
  /** Internal key used in state and types */
  id: string;
  /** Human-readable display name */
  name: string;
  /** EVM chain ID (e.g. 1, 8453, 42161) */
  evmChainId: number;
  /** Wormhole protocol chain ID (e.g. 2, 30, 23) */
  wormholeChainId: number;
  /** Brand color for chain icon */
  iconColor: string;
  /** Unicode symbol for chain icon badge */
  iconSymbol: string;
  /** Wormhole Standard Relayer address on this chain */
  relayerAddress: string;
  /** Whether this chain has a wPOKT Lockbox (Ethereum only) */
  hasLockbox: boolean;
  /** Whether this chain has wPOKT (Ethereum only) */
  hasWPOKT: boolean;
}

/**
 * All supported EVM chains, sorted alphabetically by name.
 * This order is used directly in dropdown menus.
 */
export const EVM_CHAINS: ChainConfig[] = [
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    evmChainId: 42161,
    wormholeChainId: 23,
    iconColor: '#28a0f0',
    iconSymbol: '\u25C6', // ◆
    relayerAddress: '0x27428DD2d3DD32A4D7f7C497eAaa23130d894911',
    hasLockbox: false,
    hasWPOKT: false,
  },
  {
    id: 'base',
    name: 'Base',
    evmChainId: 8453,
    wormholeChainId: 30,
    iconColor: '#0052ff',
    iconSymbol: '\uD83D\uDD35', // 🔵
    relayerAddress: '0x706f82e9bb5b0813501714ab5974216704980e31',
    hasLockbox: false,
    hasWPOKT: false,
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    evmChainId: 1,
    wormholeChainId: 2,
    iconColor: '#627eea',
    iconSymbol: '\u27E0', // ⟠
    relayerAddress: '0x27428DD2d3DD32A4D7f7C497eAaa23130d894911',
    hasLockbox: true,
    hasWPOKT: true,
  },
];

/** Solana chain config (not EVM, separate flow) */
export const SOLANA_CHAIN: Omit<ChainConfig, 'evmChainId' | 'relayerAddress' | 'hasLockbox' | 'hasWPOKT'> = {
  id: 'solana',
  name: 'Solana',
  wormholeChainId: 1,
  iconColor: '#9945ff',
  iconSymbol: '\u25CE', // ◎
};

// ─── Lookup helpers ──────────────────────────────────────────────────────────

/** Map from chain id string to ChainConfig */
const chainById = new Map(EVM_CHAINS.map(c => [c.id, c]));

/** Map from EVM chain ID to ChainConfig */
const chainByEvmId = new Map(EVM_CHAINS.map(c => [c.evmChainId, c]));

/** Map from Wormhole chain ID to ChainConfig */
const chainByWormholeId = new Map(EVM_CHAINS.map(c => [c.wormholeChainId, c]));

/** Get chain config by internal id (e.g. 'ethereum', 'base', 'arbitrum') */
export function getChainById(id: string): ChainConfig | undefined {
  return chainById.get(id);
}

/** Get chain config by EVM chain ID (e.g. 1, 8453, 42161) */
export function getChainByEvmId(evmChainId: number): ChainConfig | undefined {
  return chainByEvmId.get(evmChainId);
}

/** Get chain config by Wormhole chain ID (e.g. 2, 30, 23) */
export function getChainByWormholeId(wormholeChainId: number): ChainConfig | undefined {
  return chainByWormholeId.get(wormholeChainId);
}

/** Get display name for any chain (EVM or Solana) */
export function getChainName(id: string): string {
  if (id === 'solana') return SOLANA_CHAIN.name;
  return chainById.get(id)?.name ?? id;
}

/** Get icon color for any chain (EVM or Solana) */
export function getChainColor(id: string): string {
  if (id === 'solana') return SOLANA_CHAIN.iconColor;
  return chainById.get(id)?.iconColor ?? '#666';
}

/** Get icon symbol for any chain (EVM or Solana) */
export function getChainSymbol(id: string): string {
  if (id === 'solana') return SOLANA_CHAIN.iconSymbol;
  return chainById.get(id)?.iconSymbol ?? '?';
}

/** Get Wormhole chain ID for any chain (EVM or Solana) */
export function getWormholeChainId(id: string): number {
  if (id === 'solana') return SOLANA_CHAIN.wormholeChainId;
  const chain = chainById.get(id);
  if (!chain) throw new Error(`Unknown chain: ${id}`);
  return chain.wormholeChainId;
}

/** Get EVM chain ID, or throw if not an EVM chain. Returns a wagmi-compatible chain ID. */
export function getEvmChainId(id: string): 1 | 8453 | 42161 {
  const chain = chainById.get(id);
  if (!chain) throw new Error(`Unknown EVM chain: ${id}`);
  return chain.evmChainId as 1 | 8453 | 42161;
}

/** Check if a chain has a Lockbox (wPOKT↔xPOKT converter) */
export function chainHasLockbox(id: string): boolean {
  return chainById.get(id)?.hasLockbox ?? false;
}

/** All EVM chain IDs as a tuple for type narrowing */
export const EVM_CHAIN_IDS = EVM_CHAINS.map(c => c.id) as string[];
