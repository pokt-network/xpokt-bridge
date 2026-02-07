'use client';

import { useBridgeContext } from '@/context/BridgeContext';
import type { Tab } from '@/types/bridge';

export function TabContainer() {
  const { state, setTab } = useBridgeContext();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'evm', label: 'EVM' },
    { id: 'solana', label: 'Solana' },
  ];

  return (
    <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setTab(tab.id)}
          style={{
            flex: 1,
            padding: '18px 24px',
            background: 'transparent',
            border: 'none',
            color: state.activeTab === tab.id ? '#f6f6f6' : 'rgba(255,255,255,0.5)',
            fontFamily: "'Rubik', sans-serif",
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
            position: 'relative',
            transition: 'color 0.2s ease',
          }}
        >
          {tab.label}
          {state.activeTab === tab.id && (
            <div
              style={{
                position: 'absolute',
                bottom: -1,
                left: 24,
                right: 24,
                height: 2,
                background: '#4c9bf5',
                borderRadius: '2px 2px 0 0',
              }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
