'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

  // EVM balances via multicall (reads from both Ethereum and Base in parallel)
  const {
    data: evmData,
    isLoading: evmLoading,
    error: evmError,
    refetch: refetchEvm,
  } = useReadContracts({
    contracts: [
      // Ethereum wPOKT
      {
        address: CONTRACTS.ethereum.wPOKT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [evmAddress!],
        chainId: 1,
      },
      // Ethereum xPOKT
      {
        address: CONTRACTS.ethereum.xPOKT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [evmAddress!],
        chainId: 1,
      },
      // Base xPOKT
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
      refetchInterval: 30000, // Refresh every 30 seconds
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

  // Parse EVM results
  const wpoktBalance = evmData?.[0]?.result as bigint | undefined;
  const xpoktEthBalance = evmData?.[1]?.result as bigint | undefined;
  const xpoktBaseBalance = evmData?.[2]?.result as bigint | undefined;

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
      refetchEvm(),
      fetchSolanaBalance(),
    ]);
  }, [refetchEvm, fetchSolanaBalance]);

  return {
    // Individual balances
    balances,

    // Helpers
    getBalanceForChain,
    hasWPOKT,

    // Loading/error states
    isLoading: evmLoading || solanaLoading,
    evmLoading,
    solanaLoading,
    error: evmError?.message || solanaError,

    // Refetch function
    refetch,

    // Connection status
    isEvmConnected: !!evmAddress,
    isSolanaConnected: !!solanaPublicKey,
    currentEvmChainId: chainId,
  };
}
