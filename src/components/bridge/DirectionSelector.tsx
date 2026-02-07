'use client';

import { useBridgeContext } from '@/context/BridgeContext';
import type { SolanaDirection } from '@/types/bridge';

const directions: { id: SolanaDirection; fromIcon: string; fromColor: string; toIcon: string; toColor: string }[] = [
  { id: 'toSolana', fromIcon: '\u27E0', fromColor: '#627eea', toIcon: '\u25CE', toColor: '#9945ff' },
  { id: 'fromSolana', fromIcon: '\u25CE', fromColor: '#9945ff', toIcon: '\u27E0', toColor: '#627eea' },
];

export function DirectionSelector() {
  const { state, setSolanaDirection } = useBridgeContext();

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        Direction
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {directions.map(dir => (
          <button
            key={dir.id}
            onClick={() => setSolanaDirection(dir.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 16,
              background: state.solanaDirection === dir.id ? 'rgba(2,90,242,0.15)' : '#171c1f',
              border: `1px solid ${state.solanaDirection === dir.id ? '#025af2' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 14,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: '#f6f6f6',
              fontFamily: "'Rubik', sans-serif",
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
              background: dir.fromColor,
            }}>
              {dir.fromIcon}
            </span>
            <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>{'\u2192'}</span>
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
              background: dir.toColor,
            }}>
              {dir.toIcon}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
