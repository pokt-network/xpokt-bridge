import { z } from 'zod';
import { TOKEN_DECIMALS } from './constants';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// Zod Schemas for localStorage data validation
// ============================================================================

/** Chain enum */
const chainSchema = z.enum(['ethereum', 'base', 'solana']);

/** Transaction status enum */
const txStatusSchema = z.enum([
  'idle', 'pending', 'confirmed', 'waiting-vaa',
  'vaa-ready', 'claiming', 'converting', 'complete', 'error',
]);

/** Pre-conversion info (Lockbox step before bridge) */
const preConversionSchema = z.object({
  required: z.boolean(),
  wpoktApproveTxHash: z.string().optional(),
  lockboxDepositTxHash: z.string().optional(),
}).optional();

/** Wormhole transfer metadata */
const wormholeSchema = z.object({
  emitterChain: z.number().int().nonnegative(),
  emitterAddress: z.string().min(1).max(128),
  sequence: z.string().min(1).max(32),
  vaaBytes: z.string().optional(),
}).optional();

/**
 * Full StoredTransaction schema.
 *
 * Validates data loaded from localStorage to prevent:
 * - Malicious browser extensions injecting crafted transactions
 * - XSS payloads tampering with pending transaction data
 * - Corrupted data from storage errors
 */
export const storedTransactionSchema = z.object({
  id: z.string().min(1).max(128),
  sourceChain: chainSchema,
  destChain: chainSchema,
  amount: z.string().min(1).max(64),
  amountRaw: z.string().min(1).max(128),
  status: txStatusSchema,
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  sourceTxHash: z.string().max(128),
  destToken: z.enum(['wpokt', 'xpokt']).optional(),
  preConversion: preConversionSchema,
  wormhole: wormholeSchema,
  destTxHash: z.string().max(128).optional(),
  conversionTxHash: z.string().max(128).optional(),
  // Wallet address that initiated this transaction — for ownership verification
  initiatorAddress: z.string().max(128).optional(),
});

/** Array of stored transactions — capped at 100 to prevent memory exhaustion */
export const storedTransactionsArraySchema = z.array(storedTransactionSchema).max(100);

/**
 * Parse and validate stored transactions from localStorage.
 * Returns only valid entries; silently drops malformed ones.
 */
export function parseStoredTransactions(raw: string): z.infer<typeof storedTransactionSchema>[] {
  try {
    const parsed = JSON.parse(raw);
    const result = storedTransactionsArraySchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    // If the whole array fails, try to salvage individual valid entries
    if (Array.isArray(parsed)) {
      const valid = parsed
        .map((entry: unknown) => storedTransactionSchema.safeParse(entry))
        .filter((r): r is z.SafeParseSuccess<z.infer<typeof storedTransactionSchema>> => r.success)
        .map(r => r.data);
      console.warn(
        `[Validation] ${parsed.length - valid.length} of ${parsed.length} stored transactions failed validation — dropped`
      );
      return valid;
    }
    console.warn('[Validation] Stored transactions data is not an array — discarding');
    return [];
  } catch {
    console.warn('[Validation] Failed to parse stored transactions JSON — discarding');
    return [];
  }
}

/**
 * Filter stored transactions to only those initiated by the given wallet address.
 * Transactions without an initiatorAddress are included (legacy data).
 */
export function filterByWalletOwnership(
  transactions: z.infer<typeof storedTransactionSchema>[],
  walletAddress: string | undefined
): z.infer<typeof storedTransactionSchema>[] {
  if (!walletAddress) return transactions;
  const normalized = walletAddress.toLowerCase();
  return transactions.filter(tx => {
    // Include transactions with no initiator (legacy data before this check was added)
    if (!tx.initiatorAddress) return true;
    // Match by normalized address (case-insensitive for EVM)
    return tx.initiatorAddress.toLowerCase() === normalized;
  });
}

export function validateAmount(
  amount: string,
  balance: bigint,
  decimals: number = TOKEN_DECIMALS
): ValidationResult {
  // Empty or whitespace
  if (!amount || !amount.trim()) {
    return { valid: false };
  }

  // Non-numeric
  const trimmed = amount.trim();
  if (!/^\d*\.?\d*$/.test(trimmed)) {
    return { valid: false, error: 'Invalid amount' };
  }

  // Zero
  const num = parseFloat(trimmed);
  if (num === 0 || isNaN(num)) {
    return { valid: false };
  }

  // Too many decimals
  const parts = trimmed.split('.');
  if (parts[1] && parts[1].length > decimals) {
    return { valid: false, error: `Maximum ${decimals} decimal places` };
  }

  // Convert to raw amount for balance check
  try {
    const multiplier = BigInt(10 ** decimals);
    const wholePart = BigInt(parts[0] || '0');
    const fracPart = parts[1]
      ? BigInt(parts[1].padEnd(decimals, '0').slice(0, decimals))
      : 0n;
    const rawAmount = wholePart * multiplier + fracPart;

    if (rawAmount > balance) {
      return { valid: false, error: 'Insufficient balance' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid amount' };
  }
}

export function validateEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function validateSolanaAddress(address: string): boolean {
  // Base58 check: 32-44 characters of base58 alphabet
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function sanitizeAmountInput(input: string): string {
  // Remove non-numeric characters except decimal point
  let sanitized = input.replace(/[^0-9.]/g, '');

  // Only allow one decimal point
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    sanitized = parts[0] + '.' + parts.slice(1).join('');
  }

  // Limit decimal places to TOKEN_DECIMALS
  if (parts[1] && parts[1].length > TOKEN_DECIMALS) {
    sanitized = parts[0] + '.' + parts[1].slice(0, TOKEN_DECIMALS);
  }

  return sanitized;
}
