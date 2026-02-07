import { BRAND_ASSETS } from '@/lib/utils/constants';

interface TokenIconProps {
  size?: number;
  className?: string;
}

export function TokenIcon({ size = 24, className = '' }: TokenIconProps) {
  return (
    <img
      src={BRAND_ASSETS.tokenIcon}
      alt="POKT"
      width={size}
      height={size}
      className={`rounded-full ${className}`}
    />
  );
}
