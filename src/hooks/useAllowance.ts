'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ERC20_ABI } from '@/lib/contracts/abis/erc20';

export function useAllowance(
  tokenAddress: `0x${string}`,
  spenderAddress: `0x${string}`,
  ownerAddress: `0x${string}` | undefined,
  chainId: number
) {
  const { data: allowance, refetch } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [ownerAddress!, spenderAddress],
    chainId,
    query: {
      enabled: !!ownerAddress,
    },
  });

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  async function approve(amount: bigint) {
    const hash = await writeContractAsync({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spenderAddress, amount],
      chainId,
    });
    return hash;
  }

  return {
    allowance: (allowance as bigint) ?? 0n,
    approve,
    isPending,
    isConfirming,
    isSuccess,
    refetch,
  };
}
