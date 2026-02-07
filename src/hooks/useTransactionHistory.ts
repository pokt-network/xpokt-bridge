'use client';

import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useBridgeContext } from '@/context/BridgeContext';
import type { StoredTransaction } from '@/types/transactions';

export function useTransactionHistory() {
  const { state, dispatch } = useBridgeContext();
  const { address: evmAddress } = useAccount();

  const addTransaction = useCallback((
    tx: Omit<StoredTransaction, 'id' | 'createdAt' | 'updatedAt'>
  ): string => {
    const id = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fullTx: StoredTransaction = {
      ...tx,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // Stamp the connected wallet address for ownership verification on resume.
      // This prevents localStorage tampering from surfacing attacker-controlled
      // transactions to a different wallet.
      initiatorAddress: tx.initiatorAddress || evmAddress || undefined,
    };
    dispatch({ type: 'ADD_PENDING_TX', payload: fullTx });
    return id;
  }, [dispatch, evmAddress]);

  const updateTransaction = useCallback((
    id: string,
    updates: Partial<StoredTransaction>
  ) => {
    dispatch({ type: 'UPDATE_PENDING_TX', payload: { id, updates } });
  }, [dispatch]);

  const removeTransaction = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_PENDING_TX', payload: id });
  }, [dispatch]);

  const getTransaction = useCallback((id: string): StoredTransaction | undefined => {
    return state.pendingTransactions.find(tx => tx.id === id);
  }, [state.pendingTransactions]);

  const getPendingTransactions = useCallback((): StoredTransaction[] => {
    return state.pendingTransactions.filter(
      tx => tx.status !== 'complete' && tx.status !== 'error'
    );
  }, [state.pendingTransactions]);

  const getResumableTransactions = useCallback((): StoredTransaction[] => {
    const resumable = state.pendingTransactions.filter(
      tx => tx.status === 'waiting-vaa' || tx.status === 'vaa-ready'
    );
    // Only show transactions initiated by the currently connected wallet.
    // Transactions without initiatorAddress (legacy) are included.
    if (!evmAddress) return resumable;
    const normalized = evmAddress.toLowerCase();
    return resumable.filter(tx =>
      !tx.initiatorAddress || tx.initiatorAddress.toLowerCase() === normalized
    );
  }, [state.pendingTransactions, evmAddress]);

  return {
    transactions: state.pendingTransactions,
    pendingTransactions: getPendingTransactions(),
    resumableTransactions: getResumableTransactions(),
    addTransaction,
    updateTransaction,
    removeTransaction,
    getTransaction,
  };
}
