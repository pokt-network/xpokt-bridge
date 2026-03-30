'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { truncateAddress } from '@/lib/utils/format';

export function EVMWalletButton() {
  const { address, isConnected, isReconnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Stable address cache: prevent flashing to "Connect" during reconnection
  // or refetches. Only update the displayed address when wagmi settles on
  // a confirmed value (connected with address, or explicitly disconnected).
  const [mounted, setMounted] = useState(false);
  const [stableAddress, setStableAddress] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    // Don't clear address during reconnection — keep showing the cached one
    if (isReconnecting) return;
    if (isConnected && address) {
      setStableAddress(address);
    } else if (!isConnected && !isReconnecting) {
      setStableAddress(null);
    }
  }, [isConnected, address, isReconnecting]);

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
        <span>{'\u27E0'}</span>
        {truncateAddress(stableAddress!)}
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
