'use client';

import { useMemo } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import type { WalletClient } from 'viem';

export class WagmiSigner {
  private walletClient: WalletClient;
  private _address: string;
  private _chainId: number;

  constructor(walletClient: WalletClient, address: string, chainId: number) {
    this.walletClient = walletClient;
    this._address = address;
    this._chainId = chainId;
  }

  chain(): string {
    return this._chainId === 1 ? 'Ethereum' : 'Base';
  }

  address(): string {
    return this._address;
  }

  async signAndSend(txs: any[]): Promise<string[]> {
    const results: string[] = [];
    for (const tx of txs) {
      const hash = await this.walletClient.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value ? BigInt(tx.value) : undefined,
        chain: null,
        account: this._address as `0x${string}`,
      });
      results.push(hash);
    }
    return results;
  }
}

export function useEvmWormholeSigner(): WagmiSigner | null {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  return useMemo(() => {
    if (!address || !walletClient) return null;
    const chainId = walletClient.chain?.id ?? 1;
    return new WagmiSigner(walletClient, address, chainId);
  }, [address, walletClient]);
}
