'use client';

import { useState } from 'react';
import { useLockbox } from '@/hooks/useLockbox';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { TokenIcon } from '@/components/shared/TokenIcon';
import { parsePOKT, formatNumber } from '@/lib/utils/format';
import { sanitizeAmountInput } from '@/lib/utils/validation';

export function ConvertCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const { state: lockboxState, deposit, withdraw, reset } = useLockbox();
  const { balances } = useTokenBalances();

  const sourceToken = direction === 'deposit' ? 'wPOKT' : 'POKT (xPOKT)';
  const destToken = direction === 'deposit' ? 'POKT (xPOKT)' : 'wPOKT';
  const sourceBalance = direction === 'deposit' ? balances.wpokt : balances.xpoktEth;

  const handleConvert = async () => {
    if (!amount) return;
    const amountWei = parsePOKT(amount);
    try {
      if (direction === 'deposit') {
        await deposit(amountWei);
      } else {
        await withdraw(amountWei);
      }
      setAmount('');
    } catch (e) {
      // Error handled by hook
    }
  };

  if (!isOpen) {
    // Collapsed state matching HTML reference
    return (
      <div
        style={{
          marginTop: 24,
          padding: 20,
          background: '#232a2f',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#f6f6f6' }}>
            Convert wPOKT {'\u2194'} xPOKT
          </span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: '#171c1f',
            borderRadius: 8,
            fontSize: 12,
            color: 'rgba(255,255,255,0.6)',
          }}>
            <TokenIcon size={16} />
            Ethereum only
          </div>
        </div>

        {/* Description */}
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
          wPOKT can be bridged to native POKT on Cosmos. xPOKT is the bridge token
          used across EVM chains. Convert between them using the Lockbox.
        </div>

        {/* Open button */}
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '100%',
            marginTop: 16,
            padding: 14,
            background: 'transparent',
            border: '1px solid #025af2',
            borderRadius: 12,
            color: '#025af2',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "'Rubik', sans-serif",
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Open Converter
        </button>
      </div>
    );
  }

  // Expanded state
  return (
    <div
      style={{
        marginTop: 24,
        padding: 20,
        background: '#232a2f',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#f6f6f6' }}>
          Convert wPOKT {'\u2194'} xPOKT
        </span>
        <button
          onClick={() => { setIsOpen(false); reset(); }}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: "'Rubik', sans-serif",
          }}
        >
          {'\u2715'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setDirection('deposit')}
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            fontFamily: "'Rubik', sans-serif",
            cursor: 'pointer',
            background: direction === 'deposit' ? 'rgba(2,90,242,0.15)' : '#171c1f',
            color: direction === 'deposit' ? '#4c9bf5' : 'rgba(255,255,255,0.5)',
            border: `1px solid ${direction === 'deposit' ? 'rgba(2,90,242,0.3)' : 'rgba(255,255,255,0.08)'}`,
            transition: 'all 0.2s ease',
          }}
        >
          wPOKT {'\u2192'} xPOKT
        </button>
        <button
          onClick={() => setDirection('withdraw')}
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            fontFamily: "'Rubik', sans-serif",
            cursor: 'pointer',
            background: direction === 'withdraw' ? 'rgba(2,90,242,0.15)' : '#171c1f',
            color: direction === 'withdraw' ? '#4c9bf5' : 'rgba(255,255,255,0.5)',
            border: `1px solid ${direction === 'withdraw' ? 'rgba(2,90,242,0.3)' : 'rgba(255,255,255,0.08)'}`,
            transition: 'all 0.2s ease',
          }}
        >
          xPOKT {'\u2192'} wPOKT
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
          <span>{sourceToken}</span>
          <span>Balance: {formatNumber(sourceBalance.formatted)}</span>
        </div>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
          style={{
            width: '100%',
            background: '#171c1f',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 18,
            color: '#f6f6f6',
            border: '1px solid rgba(255,255,255,0.08)',
            outline: 'none',
            fontFamily: "'Rubik', sans-serif",
          }}
        />
      </div>

      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
        Receive: {amount || '0'} {destToken}
      </div>

      <button
        onClick={() => {
          if (lockboxState.step === 'error' || lockboxState.step === 'complete') {
            reset();
          } else {
            handleConvert();
          }
        }}
        disabled={!amount || (lockboxState.step !== 'idle' && lockboxState.step !== 'error' && lockboxState.step !== 'complete')}
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 600,
          fontFamily: "'Rubik', sans-serif",
          cursor: !amount || (lockboxState.step !== 'idle' && lockboxState.step !== 'error' && lockboxState.step !== 'complete') ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          background: lockboxState.step === 'complete'
            ? 'linear-gradient(135deg, #48e5c2 0%, #36b89e 100%)'
            : lockboxState.step === 'error'
            ? '#232a2f'
            : (!amount || lockboxState.step !== 'idle')
            ? '#171c1f'
            : 'linear-gradient(135deg, #025af2 0%, #0147c2 100%)',
          color: lockboxState.step === 'complete'
            ? '#171c1f'
            : lockboxState.step === 'error'
            ? '#ff5a5f'
            : (!amount || lockboxState.step !== 'idle')
            ? 'rgba(255,255,255,0.3)'
            : '#ffffff',
          border: lockboxState.step === 'error' ? '1px solid rgba(255,90,95,0.3)' : 'none',
        }}
      >
        {lockboxState.step === 'idle' ? 'Convert' :
         lockboxState.step === 'switching-chain' ? 'Switching Network...' :
         lockboxState.step === 'approving' ? 'Approving...' :
         lockboxState.step === 'converting' ? 'Converting...' :
         lockboxState.step === 'complete' ? '\u2713 Done — Convert Again' :
         lockboxState.step === 'error' ? 'Failed — Try Again' : 'Convert'}
      </button>

      {lockboxState.error && (
        <p style={{ marginTop: 8, fontSize: 12, color: '#ff5a5f' }}>{lockboxState.error}</p>
      )}
    </div>
  );
}
