'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { useAccount, useReadContracts, useChainId } from 'wagmi';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddress, getAccount, TokenAccountNotFoundError } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { formatUnits } from 'viem';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { ERC20_ABI } from '@/lib/contracts/abis/erc20';
import { TOKEN_DECIMALS } from '@/lib/utils/constants';

export interface TokenBalance {
  raw: bigint;
  formatted: string;
}

export interface AllBalances {
  // Ethereum
  wpokt: TokenBalance;
  xpoktEth: TokenBalance;
  // Base
  xpoktBase: TokenBalance;
  // Arbitrum
  xpoktArb: TokenBalance;
  // Solana
  solanaPOKT: TokenBalance;
  // Combined view for UI (total bridgeable from each chain)
  totalEth: TokenBalance;  // wpokt + xpoktEth
  totalBase: TokenBalance; // xpoktBase
  totalArb: TokenBalance;  // xpoktArb
  totalSolana: TokenBalance; // solanaPOKT
}

const ZERO_BALANCE: TokenBalance = { raw: 0n, formatted: '0' };

export function useTokenBalances() {
  const { address: evmAddress } = useAccount();
  const chainId = useChainId();
  const { publicKey: solanaPublicKey } = useWallet();
  const { connection } = useConnection();

  const [solanaBalanceRaw, setSolanaBalanceRaw] = useState<bigint>(0n);
  const [solanaFetching, setSolanaFetching] = useState(false);
  const [solanaLoading, setSolanaLoading] = useState(false);
  const [solanaError, setSolanaError] = useState<string | null>(null);

  // Ethereum balances (wPOKT + xPOKT)
  const {
    data: ethData,
    isLoading: ethLoading,
    isFetching: ethFetching,
    refetch: refetchEth,
  } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.ethereum.wPOKT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [evmAddress!],
        chainId: 1,
      },
      {
        address: CONTRACTS.ethereum.xPOKT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [evmAddress!],
        chainId: 1,
      },
    ],
    query: {
      enabled: !!evmAddress,
      refetchInterval: 30000,
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
    },
  });

  // Base balances (xPOKT only)
  const {
    data: baseData,
    isLoading: baseLoading,
    isFetching: baseFetching,
    refetch: refetchBase,
  } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.base.xPOKT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [evmAddress!],
        chainId: 8453,
      },
    ],
    query: {
      enabled: !!evmAddress,
      refetchInterval: 30000,
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
    },
  });

  // Arbitrum balances (xPOKT only)
  const {
    data: arbData,
    isLoading: arbLoading,
    isFetching: arbFetching,
    refetch: refetchArb,
  } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.arbitrum.xPOKT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [evmAddress!],
        chainId: 42161,
      },
    ],
    query: {
      enabled: !!evmAddress,
      refetchInterval: 30000,
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
    },
  });

  // Solana balance (separate effect since it's not EVM)
  const fetchSolanaBalance = useCallback(async () => {
    if (!solanaPublicKey || !connection) {
      setSolanaBalanceRaw(0n);
      return;
    }

    setSolanaFetching(true);
    setSolanaError(null);

    const mint = new PublicKey(CONTRACTS.solana.poktMint);
    const ata = await getAssociatedTokenAddress(mint, solanaPublicKey);
    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const account = await getAccount(connection, ata);
        const balance = BigInt(account.amount.toString());
        setSolanaBalanceRaw(balance);
        setSolanaFetching(false);
        setSolanaLoading(false);
        return;
      } catch (error: any) {
        if (
          error instanceof TokenAccountNotFoundError ||
          error?.name === 'TokenAccountNotFoundError' ||
          error?.message?.includes('could not find account')
        ) {
          setSolanaBalanceRaw(0n);
          setSolanaFetching(false);
          setSolanaLoading(false);
          return;
        }

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        } else {
          console.error('[useTokenBalances] Solana balance fetch failed after retries:', error);
          setSolanaError(error.message || 'Failed to fetch Solana balance');
        }
      }
    }

    setSolanaFetching(false);
    setSolanaLoading(false);
  }, [solanaPublicKey, connection]);

  useEffect(() => {
    fetchSolanaBalance();
    const interval = setInterval(fetchSolanaBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchSolanaBalance]);

  // ─── Stable settled balances ───────────────────────────────────────────────
  const [stableWPOKT, setStableWPOKT] = useState<bigint | undefined>(undefined);
  const [stableXPOKTEth, setStableXPOKTEth] = useState<bigint | undefined>(undefined);
  const [stableXPOKTBase, setStableXPOKTBase] = useState<bigint | undefined>(undefined);
  const [stableXPOKTArb, setStableXPOKTArb] = useState<bigint | undefined>(undefined);
  const [stableSolanaBalance, setStableSolanaBalance] = useState<bigint>(0n);

  useEffect(() => {
    if (!ethFetching && ethData) {
      setStableWPOKT(ethData[0]?.result as bigint | undefined);
      setStableXPOKTEth(ethData[1]?.result as bigint | undefined);
    }
  }, [ethFetching, ethData]);

  useEffect(() => {
    if (!baseFetching && baseData) {
      setStableXPOKTBase(baseData[0]?.result as bigint | undefined);
    }
  }, [baseFetching, baseData]);

  useEffect(() => {
    if (!arbFetching && arbData) {
      setStableXPOKTArb(arbData[0]?.result as bigint | undefined);
    }
  }, [arbFetching, arbData]);

  useEffect(() => {
    if (!solanaFetching) {
      setStableSolanaBalance(solanaBalanceRaw);
    }
  }, [solanaFetching, solanaBalanceRaw]);

  const wpoktBalance = stableWPOKT;
  const xpoktEthBalance = stableXPOKTEth;
  const xpoktBaseBalance = stableXPOKTBase;
  const xpoktArbBalance = stableXPOKTArb;
  const solanaBalance = stableSolanaBalance;

  const formatBalance = useCallback((raw: bigint | undefined): TokenBalance => {
    const value = raw ?? 0n;
    return { raw: value, formatted: formatUnits(value, TOKEN_DECIMALS) };
  }, []);

  const balances: AllBalances = useMemo(() => {
    const wpokt = formatBalance(wpoktBalance);
    const xpoktEth = formatBalance(xpoktEthBalance);
    const xpoktBase = formatBalance(xpoktBaseBalance);
    const xpoktArb = formatBalance(xpoktArbBalance);
    const solanaPOKT = formatBalance(solanaBalance);

    const totalEthRaw = (wpoktBalance ?? 0n) + (xpoktEthBalance ?? 0n);
    const totalEth = formatBalance(totalEthRaw);
    const totalBase = xpoktBase;
    const totalArb = xpoktArb;
    const totalSolana = solanaPOKT;

    return {
      wpokt, xpoktEth, xpoktBase, xpoktArb, solanaPOKT,
      totalEth, totalBase, totalArb, totalSolana,
    };
  }, [wpoktBalance, xpoktEthBalance, xpoktBaseBalance, xpoktArbBalance, solanaBalance, formatBalance]);

  const getBalanceForChain = useCallback((chain: string): TokenBalance => {
    switch (chain) {
      case 'ethereum': return balances.totalEth;
      case 'base': return balances.totalBase;
      case 'arbitrum': return balances.totalArb;
      case 'solana': return balances.totalSolana;
      default: return ZERO_BALANCE;
    }
  }, [balances]);

  const hasWPOKT = useMemo(() => (wpoktBalance ?? 0n) > 0n, [wpoktBalance]);

  const refetch = useCallback(async () => {
    await Promise.all([
      refetchEth(),
      refetchBase(),
      refetchArb(),
      fetchSolanaBalance(),
    ]);
  }, [refetchEth, refetchBase, refetchArb, fetchSolanaBalance]);

  return {
    balances,
    getBalanceForChain,
    hasWPOKT,
    isLoading: ethLoading || baseLoading || arbLoading || solanaLoading,
    isFetching: ethFetching || baseFetching || arbFetching || solanaFetching,
    evmLoading: ethLoading || baseLoading || arbLoading,
    solanaLoading,
    error: solanaError,
    refetch,
    isEvmConnected: !!evmAddress,
    isSolanaConnected: !!solanaPublicKey,
    currentEvmChainId: chainId,
  };
}
