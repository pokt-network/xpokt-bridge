'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { truncateAddress } from '@/lib/utils/format';

export function SolanaWalletButton() {
  const { publicKey, disconnect, connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  // Stable address cache: prevent flashing to "Connect" during reconnection.
  // Only update when the wallet adapter settles on a confirmed state.
  const [mounted, setMounted] = useState(false);
  const [stableAddress, setStableAddress] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (connecting) return;
    if (connected && publicKey) {
      setStableAddress(publicKey.toBase58());
    } else if (!connected && !connecting) {
      setStableAddress(null);
    }
  }, [connected, publicKey, connecting]);

  const showConnected = mounted && stableAddress !== null;

  if (showConnected) {
    return (
      <button
        onClick={() => disconnect()}
        style={{
          background: 'linear-gradient(135deg, #232a2f 0%, rgba(2,90,242,0.2) 100%)',
          border: '1px solid #025af2',
          borderRadius: 12,
          padding: '10px 20px',
          color: '#f6f6f6',
          fontFamily: "'Rubik', sans-serif",
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'all 0.2s ease',
          height: 40,
        }}
      >
        <span>{'\u25CE'}</span>
        {truncateAddress(stableAddress!)}
      </button>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      style={{
        background: '#232a2f',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '10px 20px',
        color: '#f6f6f6',
        fontFamily: "'Rubik', sans-serif",
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all 0.2s ease',
        height: 40,
      }}
    >
      <span>{'\u25CE'}</span>
      Connect Solana
    </button>
  );
}
