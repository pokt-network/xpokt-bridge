'use client';

import { useBridgeContext } from '@/context/BridgeContext';

const chainNames: Record<string, string> = {
  ethereum: 'Ethereum',
  base: 'Base',
  solana: 'Solana',
};

export function BridgeInfo() {
  const { sourceChain, destChain, state } = useBridgeContext();

  const isSolana = state.activeTab === 'solana';
  const bridgeType = isSolana ? 'Wormhole Token Bridge' : 'xPOKT Bridge Adapter';
  const estimatedTime = isSolana ? '15-25 minutes' : '2-20 minutes';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        background: 'rgba(2,90,242,0.08)',
        borderRadius: 12,
        marginBottom: 20,
        border: '1px solid rgba(2,90,242,0.15)',
      }}
    >
      <InfoRow label="Route" value={`${chainNames[sourceChain]} \u2192 ${chainNames[destChain]}`} />
      <InfoRow label="Bridge" value={bridgeType} />
      <InfoRow label="Est. Time" value={estimatedTime} highlight />
      {isSolana ? (
        <InfoRow label="Claim" value="Manual (requires signature)" warning />
      ) : (
        <InfoRow label="Fee" value="~0.003 ETH (relayer)" />
      )}
    </div>
  );
}

function InfoRow({ label, value, highlight, warning }: { label: string; value: string; highlight?: boolean; warning?: boolean }) {
  let valueColor = '#f6f6f6';
  if (highlight) valueColor = '#48e5c2';
  if (warning) valueColor = '#ffc547';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span style={{ fontSize: 13, color: valueColor, fontWeight: 500 }}>{value}</span>
    </div>
  );
}
