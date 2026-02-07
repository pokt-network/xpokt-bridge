'use client';

import type { EvmChain } from '@/types/bridge';

interface ChainSelectorProps {
  label: 'From' | 'To';
  selected: EvmChain;
  onSelect: (chain: EvmChain) => void;
}

const chains: { id: EvmChain; name: string; icon: string; color: string }[] = [
  { id: 'ethereum', name: 'Ethereum', icon: '\u27E0', color: '#627eea' },
  { id: 'base', name: 'Base', icon: '\uD83D\uDD35', color: '#0052ff' },
];

export function ChainSelector({ label, selected, onSelect }: ChainSelectorProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {chains.map(chain => (
          <button
            key={chain.id}
            onClick={() => onSelect(chain.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: 16,
              background: selected === chain.id ? 'rgba(2,90,242,0.15)' : '#171c1f',
              border: `1px solid ${selected === chain.id ? '#025af2' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 14,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: '#f6f6f6',
              fontFamily: "'Rubik', sans-serif",
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            <span style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 'bold',
              color: 'white',
              background: chain.color,
            }}>
              {chain.icon}
            </span>
            <span>{chain.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
