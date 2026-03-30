'use client';

import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { useBridgeContext } from '@/context/BridgeContext';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { BRIDGE_ADAPTER_ABI } from '@/lib/contracts/abis/bridgeAdapter';
import { getChainName, getEvmChainId, getWormholeChainId } from '@/lib/chains/chainRegistry';

/**
 * Format a wei value as a human-readable ETH string with ~prefix.
 * Shows up to 6 significant decimal places, trimming trailing zeros.
 */
function formatFeeETH(wei: bigint): string {
  const eth = formatUnits(wei, 18);
  // Parse to number for rounding, then format nicely
  const num = parseFloat(eth);
  if (num === 0) return '0 ETH';
  // Use up to 6 decimal places, trim trailing zeros
  const formatted = num.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return `~${formatted} ETH (relayer)`;
}

export function BridgeInfo() {
  const { sourceChain, destChain, state } = useBridgeContext();

  const isSolana = state.activeTab === 'solana';

  // Don't render until chains are selected (EVM tab with null chains)
  if (!sourceChain || !destChain) return null;

  const bridgeType = isSolana ? 'Wormhole Token Bridge' : 'xPOKT Bridge Adapter';
  const estimatedTime = isSolana ? '15-25 minutes' : '2-20 minutes';

  // Determine which chain's Bridge Adapter to query for relay fee
  const sourceChainId = isSolana ? 1 : getEvmChainId(sourceChain);
  const bridgeAdapterAddress = isSolana
    ? CONTRACTS.ethereum.bridgeAdapter
    : (CONTRACTS[sourceChain as keyof typeof CONTRACTS] as any).bridgeAdapter;
  const destWormholeChainId = getWormholeChainId(destChain);

  // Live relay fee quote from on-chain bridgeCost() — only for EVM↔EVM tab
  const { data: relayFeeWei, isLoading: feeLoading } = useReadContract({
    address: bridgeAdapterAddress as `0x${string}`,
    abi: BRIDGE_ADAPTER_ABI,
    functionName: 'bridgeCost',
    args: [destWormholeChainId],
    chainId: sourceChainId,
    query: {
      enabled: !isSolana, // Only fetch for EVM↔EVM bridges
      refetchInterval: 60_000, // Refresh every 60 seconds
      staleTime: 30_000,
    },
  });

  const feeDisplay = useMemo(() => {
    if (feeLoading) return 'Fetching fee...';
    if (relayFeeWei != null) return formatFeeETH(relayFeeWei as bigint);
    return '— ETH (relayer)';
  }, [relayFeeWei, feeLoading]);

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
      <InfoRow label="Route" value={`${getChainName(sourceChain)} \u2192 ${getChainName(destChain)}`} />
      <InfoRow label="Bridge" value={bridgeType} />
      <InfoRow label="Est. Time" value={estimatedTime} highlight />
      {isSolana ? (
        <InfoRow label="Claim" value="Manual (requires signature)" warning />
      ) : (
        <InfoRow label="Fee" value={feeDisplay} />
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
