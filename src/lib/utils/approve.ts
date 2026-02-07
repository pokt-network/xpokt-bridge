/**
 * Utility for gas-efficient ERC20 approvals.
 *
 * Checks existing allowance before sending an approve transaction.
 * Skips the on-chain approve if the spender already has sufficient allowance.
 * This saves gas on retries and prevents the classic ERC20 approval race condition.
 */

import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '@/lib/chains/config';
import { ERC20_ABI } from '@/lib/contracts/abis/erc20';

interface ApproveIfNeededParams {
  /** ERC20 token address */
  token: `0x${string}`;
  /** Address authorized to spend tokens */
  spender: `0x${string}`;
  /** Amount needed (in raw wei/units) */
  amount: bigint;
  /** Token owner address */
  owner: `0x${string}`;
  /** Chain ID to read/write on (must match wagmi configured chains) */
  chainId: 1 | 8453;
  /** wagmi writeContractAsync function (from useWriteContract) */
  writeContractAsync: (args: any) => Promise<`0x${string}`>;
  /** Full chain object for wagmi writeContractAsync (Rabby compatibility) */
  chain?: any;
}

interface ApproveResult {
  /** Whether an on-chain approve tx was needed */
  wasNeeded: boolean;
  /** The approve tx hash (undefined if skipped) */
  txHash?: string;
}

/**
 * Check existing allowance and only send approve() if insufficient.
 *
 * Returns immediately if allowance >= amount (no gas spent).
 * Otherwise sends the approve tx and waits for confirmation.
 */
export async function approveIfNeeded({
  token,
  spender,
  amount,
  owner,
  chainId,
  writeContractAsync,
  chain,
}: ApproveIfNeededParams): Promise<ApproveResult> {
  // Check existing allowance
  const currentAllowance = await readContract(wagmiConfig, {
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [owner, spender],
    chainId,
  }) as bigint;

  if (currentAllowance >= amount) {
    console.log(
      `[Approve] Sufficient allowance: ${currentAllowance} >= ${amount}. Skipping approve.`
    );
    return { wasNeeded: false };
  }

  console.log(
    `[Approve] Insufficient allowance: ${currentAllowance} < ${amount}. Sending approve tx.`
  );

  // Send approve transaction
  const writeArgs: any = {
    address: token,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spender, amount],
  };

  // Use chain object if provided (Rabby wallet compatibility), otherwise chainId
  if (chain) {
    writeArgs.chain = chain;
  } else {
    writeArgs.chainId = chainId;
  }

  const txHash = await writeContractAsync(writeArgs);

  await waitForTransactionReceipt(wagmiConfig, {
    hash: txHash,
    chainId,
  });

  return { wasNeeded: true, txHash };
}
