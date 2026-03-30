'use client';

import { useState, useRef, useEffect } from 'react';
import { EVM_CHAINS } from '@/lib/chains/chainRegistry';
import { ChainIcon } from '@/components/shared/ChainIcon';
import type { EvmChain } from '@/types/bridge';

interface ChainSelectorProps {
  label: 'From' | 'To';
  selected: EvmChain | null;
  onSelect: (chain: EvmChain) => void;
  disabled?: boolean;
}

export function ChainSelector({ label, selected, onSelect, disabled = false }: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedChain = EVM_CHAINS.find(c => c.id === selected);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div style={{ marginBottom: 16 }} ref={ref}>
      <div style={{
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </div>
      <div style={{ position: 'relative' }}>
        {/* Dropdown trigger */}
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 16,
            background: isOpen ? 'rgba(2,90,242,0.08)' : '#171c1f',
            border: `1px solid ${isOpen ? '#025af2' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: isOpen ? '14px 14px 0 0' : 14,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            color: '#f6f6f6',
            fontFamily: "'Rubik', sans-serif",
            fontSize: 15,
            fontWeight: 500,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {/* Chain icon */}
          {selectedChain ? (
            <ChainIcon chain={selectedChain.id} size={28} />
          ) : (
            <span style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              flexShrink: 0,
            }} />
          )}
          <span style={{ flex: 1, textAlign: 'left' }}>
            {selectedChain?.name ?? (label === 'From' ? 'Select Origin' : 'Select Destination')}
          </span>
          {/* Chevron */}
          <span style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.4)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s ease',
          }}>
            {'\u25BC'}
          </span>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#171c1f',
            border: '1px solid #025af2',
            borderTop: 'none',
            borderRadius: '0 0 14px 14px',
            overflow: 'hidden',
            zIndex: 50,
          }}>
            {EVM_CHAINS.map(chain => {
              const isSelected = chain.id === selected;
              return (
                <button
                  key={chain.id}
                  onClick={() => {
                    onSelect(chain.id as EvmChain);
                    setIsOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 16px',
                    background: isSelected ? 'rgba(2,90,242,0.08)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#f6f6f6',
                    fontFamily: "'Rubik', sans-serif",
                    fontSize: 15,
                    fontWeight: isSelected ? 600 : 400,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#1e2428';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isSelected ? 'rgba(2,90,242,0.08)' : 'transparent';
                  }}
                >
                  <ChainIcon chain={chain.id} size={28} />
                  <span>{chain.name}</span>
                  {isSelected && (
                    <span style={{ marginLeft: 'auto', color: '#025af2', fontSize: 14 }}>
                      {'\u2713'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
