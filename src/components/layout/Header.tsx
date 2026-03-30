'use client';

import { EVMWalletButton } from '@/components/wallet/EVMWalletButton';
import { SolanaWalletButton } from '@/components/wallet/SolanaWalletButton';
import { PendingBadge } from '@/components/bridge/PendingTransactions';
import { useBridgeContext } from '@/context/BridgeContext';
import { BRAND_ASSETS } from '@/lib/utils/constants';

export function Header() {
  const { state } = useBridgeContext();
  const showSolanaWallet = state.activeTab === 'solana';

  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      maxWidth: 1200,
      margin: '0 auto',
      padding: 24,
      marginBottom: 32,
    }}>
      <img
        src={BRAND_ASSETS.logo}
        alt="Pocket Network"
        style={{ height: 40 }}
      />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <PendingBadge />
        <EVMWalletButton />
        {showSolanaWallet && <SolanaWalletButton />}
      </div>
    </header>
  );
}
