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
    <header className="flex justify-between items-center max-w-[1200px] mx-auto p-6 mb-24">
      <img
        src={BRAND_ASSETS.logo}
        alt="Pocket Network"
        className="h-10"
      />
      <div className="flex gap-3 items-center">
        <PendingBadge />
        <EVMWalletButton />
        {showSolanaWallet && <SolanaWalletButton />}
      </div>
    </header>
  );
}
