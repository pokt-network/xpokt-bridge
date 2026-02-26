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
  // Solana
  solanaPOKT: TokenBalance;
  // Combined view for UI (total bridgeable from each chain)
  totalEth: TokenBalance;  // wpokt + xpoktEth
  totalBase: TokenBalance; // xpoktBase
  totalSolana: TokenBalance; // solanaPOKT
}

const ZERO_BALANCE: TokenBalance = { raw: 0n, formatted: '0' };

export function useTokenBalances() {
  const { address: evmAddress } = useAccount();
  const chainId = useChainId();
  const { publicKey: solanaPublicKey } = useWallet();
  const { connection } = useConnection();

  const [solanaBalance, setSolanaBalance] = useState<bigint>(0n);
  const [solanaLoading, setSolanaLoading] = useState(false);
  const [solanaError, setSolanaError] = useState<string | null>(null);

  // Ethereum balances (wPOKT + xPOKT) — separate query so a Base RPC failure
  // can never zero out Ethereum balances, and vice versa.
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
      // Wallet interactions (MetaMask popup open/close) trigger window focus events.
      // Refetching immediately on focus creates a race condition where the RPC
      // hasn't settled post-transaction state yet and briefly returns 0.
      refetchOnWindowFocus: false,
    },
  });

  // Base balances (xPOKT only) — isolated from the Ethereum query.
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

  // Solana balance (separate effect since it's not EVM)
  const fetchSolanaBalance = useCallback(async () => {
    if (!solanaPublicKey || !connection) {
      setSolanaBalance(0n);
      return;
    }

    setSolanaLoading(true);
    setSolanaError(null);

    try {
      const mint = new PublicKey(CONTRACTS.solana.poktMint);
      const ata = await getAssociatedTokenAddress(mint, solanaPublicKey);

      console.log('[useTokenBalances] Fetching Solana POKT balance...', {
        wallet: solanaPublicKey.toBase58(),
        mint: CONTRACTS.solana.poktMint,
        ata: ata.toBase58(),
        rpc: connection.rpcEndpoint,
      });

      try {
        const account = await getAccount(connection, ata);
        const balance = BigInt(account.amount.toString());
        console.log('[useTokenBalances] Solana POKT balance:', balance.toString());
        setSolanaBalance(balance);
      } catch (error: any) {
        // TokenAccountNotFoundError means the account doesn't exist yet (balance = 0)
        // Also handle the case where the error name matches but isn't an instance
        // (can happen with different module versions)
        if (
          error instanceof TokenAccountNotFoundError ||
          error?.name === 'TokenAccountNotFoundError' ||
          error?.message?.includes('could not find account')
        ) {
          console.log('[useTokenBalances] Solana POKT token account not found (balance = 0)');
          setSolanaBalance(0n);
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('[useTokenBalances] Error fetching Solana balance:', error);
      setSolanaError(error.message || 'Failed to fetch Solana balance');
      setSolanaBalance(0n);
    } finally {
      setSolanaLoading(false);
    }
  }, [solanaPublicKey, connection]);

  // Fetch Solana balance on mount and when wallet changes
  useEffect(() => {
    fetchSolanaBalance();

    // Set up polling for Solana balance
    const interval = setInterval(fetchSolanaBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchSolanaBalance]);

  // ─── Stable settled balances ───────────────────────────────────────────────
  // Live query results (ethData / baseData) update the moment a refetch starts
  // returning new data — including spurious 0s from post-transaction RPC race
  // conditions. These stable states only update when the fetch has fully settled
  // (isFetching transitions false→true→false), so the displayed balance never
  // flickers to 0 mid-flight.
  const [stableWPOKT, setStableWPOKT] = useState<bigint | undefined>(undefined);
  const [stableXPOKTEth, setStableXPOKTEth] = useState<bigint | undefined>(undefined);
  const [stableXPOKTBase, setStableXPOKTBase] = useState<bigint | undefined>(undefined);

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

  // Use settled values for all balance computations — never the raw live results.
  const wpoktBalance = stableWPOKT;
  const xpoktEthBalance = stableXPOKTEth;
  const xpoktBaseBalance = stableXPOKTBase;

  // Format helper
  const formatBalance = useCallback((raw: bigint | undefined): TokenBalance => {
    const value = raw ?? 0n;
    return {
      raw: value,
      formatted: formatUnits(value, TOKEN_DECIMALS),
    };
  }, []);

  // Compute all balances
  const balances: AllBalances = useMemo(() => {
    const wpokt = formatBalance(wpoktBalance);
    const xpoktEth = formatBalance(xpoktEthBalance);
    const xpoktBase = formatBalance(xpoktBaseBalance);
    const solanaPOKT = formatBalance(solanaBalance);

    // Combined totals for UI display
    const totalEthRaw = (wpoktBalance ?? 0n) + (xpoktEthBalance ?? 0n);
    const totalEth = formatBalance(totalEthRaw);

    const totalBase = xpoktBase; // Same as xpoktBase (no wPOKT on Base)
    const totalSolana = solanaPOKT; // Same as solanaPOKT

    return {
      wpokt,
      xpoktEth,
      xpoktBase,
      solanaPOKT,
      totalEth,
      totalBase,
      totalSolana,
    };
  }, [wpoktBalance, xpoktEthBalance, xpoktBaseBalance, solanaBalance, formatBalance]);

  // Get balance for a specific chain (for UI convenience)
  const getBalanceForChain = useCallback((chain: 'ethereum' | 'base' | 'solana'): TokenBalance => {
    switch (chain) {
      case 'ethereum':
        return balances.totalEth;
      case 'base':
        return balances.totalBase;
      case 'solana':
        return balances.totalSolana;
      default:
        return ZERO_BALANCE;
    }
  }, [balances]);

  // Check if user has any wPOKT (affects which bridge flow to use)
  const hasWPOKT = useMemo(() => (wpoktBalance ?? 0n) > 0n, [wpoktBalance]);

  // Combined refetch function
  const refetch = useCallback(async () => {
    await Promise.all([
      refetchEth(),
      refetchBase(),
      fetchSolanaBalance(),
    ]);
  }, [refetchEth, refetchBase, fetchSolanaBalance]);

  return {
    // Individual balances
    balances,

    // Helpers
    getBalanceForChain,
    hasWPOKT,

    // Loading/error states
    isLoading: ethLoading || baseLoading || solanaLoading,
    // isFetching is true during ANY background refetch (unlike isLoading which is first-fetch only).
    // Components can use this to avoid showing alarms (e.g. "Insufficient balance") while
    // a refetch is in-flight and the cached value may temporarily read as 0.
    isFetching: ethFetching || baseFetching,
    evmLoading: ethLoading || baseLoading,
    solanaLoading,
    error: solanaError, // EVM query errors are transient RPC issues; keepPreviousData handles display

    // Refetch function
    refetch,

    // Connection status
    isEvmConnected: !!evmAddress,
    isSolanaConnected: !!solanaPublicKey,
    currentEvmChainId: chainId,
  };
}
