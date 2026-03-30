import { getChainName } from '@/lib/chains/chainRegistry';

interface ChainIconProps {
  chain: string;
  size?: number;
  className?: string;
}

export function ChainIcon({ chain, size = 28, className = '' }: ChainIconProps) {
  const Logo = CHAIN_LOGOS[chain];

  if (Logo) {
    return (
      <span
        className={className}
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        title={getChainName(chain)}
      >
        <Logo size={size} />
      </span>
    );
  }

  // Fallback for unknown chains
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
        fontSize: size * 0.5,
        fontWeight: 'bold',
        backgroundColor: '#666',
        color: 'white',
      }}
      title={chain}
    >
      ?
    </span>
  );
}

// ============================================================================
// Chain Logo SVGs
// ============================================================================

function EthereumLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M127.961 0L125.166 9.5V285.168L127.961 287.958L255.923 212.32L127.961 0Z" fill="#343434"/>
      <path d="M127.962 0L0 212.32L127.962 287.958V154.158V0Z" fill="#8C8C8C"/>
      <path d="M127.961 312.187L126.386 314.107V412.306L127.961 416.905L255.999 236.587L127.961 312.187Z" fill="#3C3C3B"/>
      <path d="M127.962 416.905V312.187L0 236.587L127.962 416.905Z" fill="#8C8C8C"/>
      <path d="M127.961 287.958L255.923 212.32L127.961 154.158V287.958Z" fill="#141414"/>
      <path d="M0 212.32L127.962 287.958V154.158L0 212.32Z" fill="#393939"/>
    </svg>
  );
}

function BaseLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="55.5" cy="55.5" r="55.5" fill="#0052FF"/>
      <path d="M54.921 94.121C76.232 94.121 93.521 76.832 93.521 55.521C93.521 34.21 76.232 16.921 54.921 16.921C34.655 16.921 17.987 32.588 16.521 52.421H70.721V58.621H16.521C17.987 78.454 34.655 94.121 54.921 94.121Z" fill="white"/>
    </svg>
  );
}

function ArbitrumLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="185 185 371 418" xmlns="http://www.w3.org/2000/svg">
      <path fill="#05163d" d="M199.08,311.99v163.76c0,10.39,5.54,20.09,14.64,25.23l141.7,81.83c9.01,5.24,20.19,5.24,29.19,0l141.79-81.83c9.01-5.24,14.64-14.84,14.64-25.23v-163.76c0-10.39-5.54-20.09-14.64-25.33l-141.79-81.83c-9-5.24-20.18-5.24-29.19,0l-141.79,81.83c-8.91,5.24-14.55,14.84-14.55,25.33Z"/>
      <path fill="#12aaff" d="M401.04,425.58l-20.29,55.41c-.59,1.48-.59,3.26,0,4.75l34.73,95.39,40.27-23.25-48.29-132.39c-1.09-2.97-5.34-2.97-6.43.1Z"/>
      <path fill="#12aaff" d="M441.51,332.27c-1.09-3.07-5.34-3.07-6.53,0l-20.28,55.41c-.59,1.58-.59,3.26,0,4.75l57,156.24,40.27-23.25-70.45-193.15Z"/>
      <path fill="#9dcced" d="M370.07,210.86c.99,0,1.98.3,2.87.79l153.37,88.56c1.78.99,2.87,2.87,2.87,4.95v177.12c0,2.08-1.09,3.96-2.87,4.95l-153.37,88.66c-.89.49-1.88.79-2.87.79s-1.98-.3-2.87-.79l-153.37-88.56c-1.78-.99-2.87-2.87-2.87-4.95v-177.22c0-2.08,1.09-3.96,2.87-4.95l153.37-88.56c.89-.49,1.88-.79,2.87-.79ZM370.07,185.04c-5.44,0-10.98,1.48-15.83,4.25l-153.37,88.56c-9.7,5.64-15.83,16.03-15.83,27.31v177.12c0,11.28,6.04,21.77,15.83,27.41l153.37,88.56c4.85,2.87,10.29,4.25,15.83,4.25s10.98-1.48,15.83-4.25l153.37-88.56c9.8-5.64,15.83-16.03,15.83-27.41v-177.12c0-11.28-6.04-21.77-15.83-27.41l-153.37-88.46c-4.95-2.77-10.39-4.25-15.83-4.25Z"/>
      <path fill="#05163d" d="M268.64,548.87l14.15-38.59,28.3,23.55-26.42,24.24-16.03-9.2Z"/>
      <path fill="#fff" d="M357.11,292.59h-38.89c-2.87,0-5.54,1.78-6.53,4.55l-83.32,228.57,40.27,23.25,91.83-251.73c.79-2.28-.89-4.65-3.37-4.65Z"/>
      <path fill="#fff" d="M425.18,292.59h-38.89c-2.87,0-5.54,1.78-6.53,4.55l-95.09,260.93,40.27,23.25,103.5-284.08c.89-2.28-.89-4.65-3.27-4.65Z"/>
    </svg>
  );
}

function SolanaLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 397 312" fill="none" xmlns="http://www.w3.org/2000/svg">
      <linearGradient id="sol-grad" x1="360.879" y1="351.455" x2="141.213" y2="-69.294" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00FFA3"/>
        <stop offset="1" stopColor="#DC1FFF"/>
      </linearGradient>
      <path d="M64.6 237.9C67.1 235.4 70.5 233.9 74.1 233.9H389.8C395.6 233.9 398.5 240.9 394.4 245L332.1 307.2C329.6 309.7 326.2 311.2 322.6 311.2H6.9C1.1 311.2-1.8 304.2 2.3 300.1L64.6 237.9Z" fill="url(#sol-grad)"/>
      <path d="M64.6 3.8C67.2 1.3 70.6-0.2 74.1-0.2H389.8C395.6-0.2 398.5 6.8 394.4 10.9L332.1 73.1C329.6 75.6 326.2 77.1 322.6 77.1H6.9C1.1 77.1-1.8 70.1 2.3 66L64.6 3.8Z" fill="url(#sol-grad)"/>
      <path d="M332.1 120.3C329.6 117.8 326.2 116.3 322.6 116.3H6.9C1.1 116.3-1.8 123.3 2.3 127.4L64.6 189.6C67.1 192.1 70.5 193.6 74.1 193.6H389.8C395.6 193.6 398.5 186.6 394.4 182.5L332.1 120.3Z" fill="url(#sol-grad)"/>
    </svg>
  );
}

const CHAIN_LOGOS: Record<string, React.FC<{ size: number }>> = {
  ethereum: EthereumLogo,
  base: BaseLogo,
  arbitrum: ArbitrumLogo,
  solana: SolanaLogo,
};
