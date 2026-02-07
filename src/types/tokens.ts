import type { Chain } from './bridge';

export type TokenType = 'wpokt' | 'xpokt' | 'spl';

export interface TokenBalance {
  token: TokenType;
  chain: Chain;
  balance: bigint;
  formatted: string;
}
