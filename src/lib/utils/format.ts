import { formatUnits, parseUnits } from 'viem';
import { TOKEN_DECIMALS } from './constants';

export function formatPOKT(amount: bigint): string {
  return formatUnits(amount, TOKEN_DECIMALS);
}

export function parsePOKT(amount: string): bigint {
  return parseUnits(amount, TOKEN_DECIMALS);
}

export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatNumber(value: string, maxDecimals = 2): string {
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  if (num === 0) return '0';

  if (num < 0.01) {
    return '< 0.01';
  }

  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}
