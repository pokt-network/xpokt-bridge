'use client';

import { useBridgeContext } from '@/context/BridgeContext';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { TokenIcon } from '@/components/shared/TokenIcon';
import { sanitizeAmountInput } from '@/lib/utils/validation';
import { formatNumber } from '@/lib/utils/format';
import { MIN_EVM_BRIDGE_POKT } from '@/lib/utils/constants';

export function AmountInput() {
  const { state, setAmount, sourceChain } = useBridgeContext();
  const { getBalanceForChain, isLoading } = useTokenBalances();

  const balance = sourceChain ? getBalanceForChain(sourceChain) : { raw: 0n, formatted: '0' };

  // Show skeleton only on the very first load (before any balance has settled).
  // Once the stable balance architecture in useTokenBalances has produced a value,
  // always display it — never grey out during background refetches.
  const showBalanceSkeleton = isLoading;

  // Don't flag insufficient balance while the skeleton is showing.
  const isInsufficientBalance =
    !showBalanceSkeleton &&
    !!state.amount &&
    parseFloat(state.amount) > parseFloat(balance.formatted);

  // EVM auto-relay claim bot won't process transfers under 100 POKT.
  const isBelowMinimum =
    state.activeTab === 'evm' &&
    !!state.amount &&
    parseFloat(state.amount) > 0 &&
    parseFloat(state.amount) < MIN_EVM_BRIDGE_POKT;

  const hasError = isInsufficientBalance || isBelowMinimum;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeAmountInput(e.target.value);
    setAmount(sanitized);
  };

  const handleMax = () => {
    setAmount(balance.formatted);
  };

  return (
    <div
      style={{
        background: '#171c1f',
        borderRadius: 16,
        border: `1px solid ${hasError ? '#ff5a5f' : 'rgba(255,255,255,0.08)'}`,
        padding: 20,
        marginBottom: 16,
      }}
    >
      {/* Header row: Amount label + Balance */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Amount
        </span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          Balance:{' '}
          {showBalanceSkeleton ? (
            <span className="skeleton" style={{ display: 'inline-block', width: 64, height: 12, borderRadius: 4 }} />
          ) : (
            <span
              onClick={handleMax}
              style={{ color: '#f6f6f6', fontWeight: 500, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#025af2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#f6f6f6'; }}
            >
              {formatNumber(balance.formatted)} POKT
            </span>
          )}
        </span>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={state.amount}
          onChange={handleChange}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 32,
            fontWeight: 300,
            color: '#f6f6f6',
            fontFamily: "'Rubik', sans-serif",
            minWidth: 0,
          }}
        />
        <button
          onClick={handleMax}
          style={{
            padding: '6px 12px',
            background: 'rgba(2,90,242,0.15)',
            border: '1px solid #025af2',
            borderRadius: 8,
            color: '#025af2',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontFamily: "'Rubik', sans-serif",
            transition: 'all 0.2s ease',
          }}
        >
          Max
        </button>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          background: '#232a2f',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <TokenIcon size={24} />
          <span style={{ fontSize: 16, fontWeight: 500, color: '#f6f6f6' }}>POKT</span>
        </div>
      </div>

      {isInsufficientBalance && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#ff5a5f' }}>
          Insufficient balance
        </div>
      )}
      {!isInsufficientBalance && isBelowMinimum && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#ff5a5f' }}>
          Minimum {MIN_EVM_BRIDGE_POKT} POKT
        </div>
      )}
    </div>
  );
}
