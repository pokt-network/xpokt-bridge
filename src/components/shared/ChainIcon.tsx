import { CHAIN_COLORS } from '@/lib/utils/constants';
import type { Chain } from '@/types/bridge';

interface ChainIconProps {
  chain: Chain;
  size?: number;
  className?: string;
}

const chainIcons: Record<Chain, string> = {
  ethereum: '\u27E0',
  base: '\uD83D\uDD35',
  solana: '\u25CE',
};

const chainNames: Record<Chain, string> = {
  ethereum: 'Ethereum',
  base: 'Base',
  solana: 'Solana',
};

export function ChainIcon({ chain, size = 28, className = '' }: ChainIconProps) {
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.57,
        fontWeight: 'bold',
        backgroundColor: CHAIN_COLORS[chain],
        color: 'white',
      }}
      title={chainNames[chain]}
    >
      {chainIcons[chain]}
    </span>
  );
}

export { chainNames, chainIcons };
