'use client';

import { useBridgeContext } from '@/context/BridgeContext';
import { TokenIcon } from '@/components/shared/TokenIcon';
import { TokenDropdown } from './TokenDropdown';

const chainNames: Record<string, string> = {
  ethereum: 'Ethereum',
  base: 'Base',
  solana: 'Solana',
};

export function ReceiveSection() {
  const { state, showTokenDropdown, sourceChain, destChain } = useBridgeContext();
  const receiveAmount = state.amount || '0.00';

  // Build label: "You Receive" for EVM, "You Receive on Solana" / "You Receive on Ethereum" for Solana tab
  const label = state.activeTab === 'solana'
    ? `You Receive on ${chainNames[destChain]}`
    : 'You Receive';

  return (
    <div
      style={{
        background: '#171c1f',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
        padding: 20,
        marginBottom: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </span>
      </div>

      {/* Amount row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1, fontSize: 28, fontWeight: 300, color: '#f6f6f6' }}>
          {receiveAmount}
        </span>
        {showTokenDropdown ? (
          <TokenDropdown />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: '#232a2f',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <TokenIcon size={24} />
            <span style={{ fontSize: 16, fontWeight: 500, color: '#f6f6f6' }}>POKT</span>
          </div>
        )}
      </div>

      {/* Base -> ETH with wPOKT destination note */}
      {showTokenDropdown && state.destToken === 'wpokt' && sourceChain === 'base' && state.activeTab === 'evm' && (
        <div style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 8,
          background: 'rgba(2,90,242,0.1)',
          border: '1px solid rgba(2,90,242,0.2)',
        }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
            <span style={{ color: '#025af2' }}>i</span> Tokens will arrive as POKT (xPOKT). Use the converter below to get wPOKT after arrival.
          </p>
        </div>
      )}
    </div>
  );
}
