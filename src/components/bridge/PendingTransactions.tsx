'use client';

import { useBridgeContext } from '@/context/BridgeContext';
import type { StoredTransaction, TxStatus } from '@/types/transactions';

// ============================================================================
// PendingBadge - Shows count in header
// ============================================================================

export function PendingBadge() {
  const { state, dispatch } = useBridgeContext();
  const pendingCount = state.pendingTransactions.filter(
    tx => tx.status !== 'complete' && tx.status !== 'error'
  ).length;

  if (pendingCount === 0) return null;

  return (
    <button
      onClick={() => dispatch({ type: 'TOGGLE_PENDING_MODAL', payload: true })}
      className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:brightness-110"
      style={{
        background: 'rgba(255, 197, 71, 0.15)',
        border: '1px solid rgba(255, 197, 71, 0.3)',
        color: '#ffc547',
      }}
    >
      <span className="inline-block w-2 h-2 rounded-full bg-[#ffc547] animate-pulse" />
      {pendingCount} pending
    </button>
  );
}

// ============================================================================
// PendingTransactionsModal - Full list of pending transactions
// ============================================================================

export function PendingTransactionsModal() {
  const { state, dispatch } = useBridgeContext();

  if (!state.showPendingModal) return null;

  const close = () => dispatch({ type: 'TOGGLE_PENDING_MODAL', payload: false });
  const remove = (id: string) => dispatch({ type: 'REMOVE_PENDING_TX', payload: id });

  const activeTxs = state.pendingTransactions.filter(
    tx => tx.status !== 'complete'
  );
  const completedTxs = state.pendingTransactions.filter(
    tx => tx.status === 'complete'
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={close}
      />

      {/* Modal */}
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 overflow-y-auto"
        style={{
          background: '#1e2428',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/[0.08]">
          <h2 className="text-lg font-semibold">Pending Transactions</h2>
          <button
            onClick={close}
            className="text-white/40 hover:text-white text-xl transition-colors"
          >
            {'\u2715'}
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {state.pendingTransactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/30 text-sm">No pending transactions</p>
            </div>
          ) : (
            <>
              {/* Active transactions */}
              {activeTxs.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">
                    In Progress
                  </h3>
                  <div className="flex flex-col gap-3">
                    {activeTxs.map(tx => (
                      <TransactionItem
                        key={tx.id}
                        tx={tx}
                        onDismiss={() => remove(tx.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed transactions */}
              {completedTxs.length > 0 && (
                <div>
                  <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">
                    Completed
                  </h3>
                  <div className="flex flex-col gap-3">
                    {completedTxs.map(tx => (
                      <TransactionItem
                        key={tx.id}
                        tx={tx}
                        onDismiss={() => remove(tx.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// TransactionItem
// ============================================================================

const chainLabels: Record<string, string> = {
  ethereum: 'Ethereum',
  base: 'Base',
  solana: 'Solana',
};

const statusConfig: Record<TxStatus, { label: string; color: string }> = {
  idle: { label: 'Idle', color: 'rgba(255,255,255,0.4)' },
  pending: { label: 'Pending', color: '#ffc547' },
  confirmed: { label: 'Confirmed', color: '#4c9bf5' },
  'waiting-vaa': { label: 'Waiting for attestation', color: '#ffc547' },
  'vaa-ready': { label: 'Ready to claim', color: '#48e5c2' },
  claiming: { label: 'Claiming', color: '#4c9bf5' },
  converting: { label: 'Converting', color: '#4c9bf5' },
  complete: { label: 'Complete', color: '#48e5c2' },
  error: { label: 'Failed', color: '#ff5a5f' },
};

function TransactionItem({
  tx,
  onDismiss,
}: {
  tx: StoredTransaction;
  onDismiss: () => void;
}) {
  const config = statusConfig[tx.status];
  const timeAgo = getTimeAgo(tx.createdAt);
  const isResumable = tx.status === 'waiting-vaa' || tx.status === 'vaa-ready';

  return (
    <div
      className="p-4 rounded-xl"
      style={{
        background: '#232a2f',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Route + Amount */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-sm font-medium">
            {chainLabels[tx.sourceChain]} {'\u2192'} {chainLabels[tx.destChain]}
          </p>
          <p className="text-xs text-white/40 mt-0.5">{timeAgo}</p>
        </div>
        <p className="text-sm font-medium">{tx.amount} POKT</p>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {tx.status !== 'complete' && tx.status !== 'error' && (
            <span
              className="inline-block w-2 h-2 rounded-full animate-pulse"
              style={{ background: config.color }}
            />
          )}
          {tx.status === 'complete' && (
            <span style={{ color: config.color }}>{'\u2713'}</span>
          )}
          {tx.status === 'error' && (
            <span style={{ color: config.color }}>{'\u2717'}</span>
          )}
          <span className="text-xs" style={{ color: config.color }}>
            {config.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Explorer link */}
          {tx.sourceTxHash && (
            <a
              href={getExplorerUrl(tx.sourceChain, tx.sourceTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#4c9bf5] hover:text-[#4c9bf5]/80"
            >
              View {'\u2197'}
            </a>
          )}

          {/* Resume button for Solana bridges waiting for VAA */}
          {isResumable && (
            <button
              className="text-xs px-2 py-1 rounded-lg transition-colors"
              style={{
                background: 'rgba(72, 229, 194, 0.15)',
                color: '#48e5c2',
                border: '1px solid rgba(72, 229, 194, 0.3)',
              }}
            >
              Resume
            </button>
          )}

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getExplorerUrl(chain: string, txHash: string): string {
  switch (chain) {
    case 'ethereum':
      return `https://etherscan.io/tx/${txHash}`;
    case 'base':
      return `https://basescan.org/tx/${txHash}`;
    case 'solana':
      return `https://solscan.io/tx/${txHash}`;
    default:
      return `https://wormholescan.io/#/tx/${txHash}`;
  }
}

function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
