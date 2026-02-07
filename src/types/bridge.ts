export type EvmChain = 'ethereum' | 'base';
export type Chain = EvmChain | 'solana';
export type Tab = 'evm' | 'solana';
export type SolanaDirection = 'toSolana' | 'fromSolana';

export interface BridgeRoute {
  source: Chain;
  destination: Chain;
  bridge: 'adapter' | 'wormhole';
  estimatedTime: string;
  autoRelay: boolean;
}
