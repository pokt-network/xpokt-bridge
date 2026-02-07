'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { truncateAddress } from '@/lib/utils/format';

export function SolanaWalletButton() {
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();

  // Prevent hydration mismatch: always render "Connect" on first render,
  // then update to connected state after mount (when wallet auto-reconnects)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const showConnected = mounted && connected && publicKey;

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
        {truncateAddress(publicKey.toBase58())}
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
