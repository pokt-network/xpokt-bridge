import { TOKEN_DECIMALS } from './constants';

export interface ValidationResult {
  valid: boolean;
  error?: string;
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
