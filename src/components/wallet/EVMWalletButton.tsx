'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { truncateAddress } from '@/lib/utils/format';

export function EVMWalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Prevent hydration mismatch: always render "Connect" on first render,
  // then update to connected state after mount (when wallet auto-reconnects)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const showConnected = mounted && isConnected && address;

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
        <span>{'\u27E0'}</span>
        {truncateAddress(address)}
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        const injectedConnector = connectors.find(c => c.id === 'injected') || connectors[0];
        if (injectedConnector) {
          connect({ connector: injectedConnector });
        }
      }}
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
      <span>{'\u27E0'}</span>
      Connect EVM
    </button>
  );
}
