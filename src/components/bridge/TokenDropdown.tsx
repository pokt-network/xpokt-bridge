'use client';

import { useState } from 'react';
import { useBridgeContext } from '@/context/BridgeContext';
import { TokenIcon } from '@/components/shared/TokenIcon';

const tokenOptions = [
  { id: 'wpokt' as const, name: 'wPOKT', description: 'Bridgeable to Cosmos' },
  { id: 'xpokt' as const, name: 'POKT', description: 'Native bridge token' },
];

export function TokenDropdown() {
  const { state, setDestToken } = useBridgeContext();
  const [isOpen, setIsOpen] = useState(false);

  const selected = tokenOptions.find(t => t.id === state.destToken) || tokenOptions[0];

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          background: '#232a2f',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.08)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          color: '#f6f6f6',
          fontFamily: "'Rubik', sans-serif",
        }}
      >
        <TokenIcon size={24} />
        <span style={{ fontSize: 16, fontWeight: 500 }}>{selected.name}</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{'\u25BC'}</span>
      </button>

      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 8,
              background: '#232a2f',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              zIndex: 20,
              minWidth: 200,
              overflow: 'hidden',
            }}
          >
            {tokenOptions.map((option, index) => (
              <button
                key={option.id}
                onClick={() => { setDestToken(option.id); setIsOpen(false); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  borderBottom: index < tokenOptions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: state.destToken === option.id ? 'rgba(2,90,242,0.15)' : 'transparent',
                  border: 'none',
                  borderBottomStyle: index < tokenOptions.length - 1 ? 'solid' : 'none',
                  borderBottomWidth: index < tokenOptions.length - 1 ? 1 : 0,
                  borderBottomColor: 'rgba(255,255,255,0.05)',
                  color: '#f6f6f6',
                  fontFamily: "'Rubik', sans-serif",
                  textAlign: 'left',
                }}
              >
                <TokenIcon size={24} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#f6f6f6' }}>{option.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{option.description}</div>
                </div>
                <span style={{
                  color: '#48e5c2',
                  fontSize: 14,
                  visibility: state.destToken === option.id ? 'visible' : 'hidden',
                }}>
                  {'\u2713'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
