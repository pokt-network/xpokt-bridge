'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { EvmChain, Chain, Tab, SolanaDirection } from '@/types/bridge';
import type { StoredTransaction } from '@/types/transactions';

// ============================================================================
// State Shape
// ============================================================================

export interface BridgeState {
  activeTab: Tab;
  evmSourceChain: EvmChain;
  evmDestChain: EvmChain;
  solanaDirection: SolanaDirection;
  amount: string;
  destToken: 'wpokt' | 'xpokt';
  isProcessing: boolean;
  currentTxId: string | null;
  pendingTransactions: StoredTransaction[];
  showPendingModal: boolean;
}

const initialState: BridgeState = {
  activeTab: 'evm',
  evmSourceChain: 'ethereum',
  evmDestChain: 'base',
  solanaDirection: 'toSolana',
  amount: '',
  destToken: 'xpokt',
  isProcessing: false,
  currentTxId: null,
  pendingTransactions: [],
  showPendingModal: false,
};

// ============================================================================
// Action Types
// ============================================================================

type BridgeAction =
  | { type: 'SET_TAB'; payload: Tab }
  | { type: 'SET_EVM_SOURCE_CHAIN'; payload: EvmChain }
  | { type: 'SET_EVM_DEST_CHAIN'; payload: EvmChain }
  | { type: 'SWAP_EVM_CHAINS' }
  | { type: 'SET_SOLANA_DIRECTION'; payload: SolanaDirection }
  | { type: 'SET_AMOUNT'; payload: string }
  | { type: 'SET_DEST_TOKEN'; payload: 'wpokt' | 'xpokt' }
  | { type: 'START_PROCESSING'; payload?: string }
  | { type: 'STOP_PROCESSING' }
  | { type: 'SET_CURRENT_TX_ID'; payload: string | null }
  | { type: 'ADD_PENDING_TX'; payload: StoredTransaction }
  | { type: 'UPDATE_PENDING_TX'; payload: { id: string; updates: Partial<StoredTransaction> } }
  | { type: 'REMOVE_PENDING_TX'; payload: string }
  | { type: 'SET_PENDING_TRANSACTIONS'; payload: StoredTransaction[] }
  | { type: 'TOGGLE_PENDING_MODAL'; payload?: boolean }
  | { type: 'RESET_FORM' }
  | { type: 'RESET_ALL' };

// ============================================================================
// Reducer
// ============================================================================

function bridgeReducer(state: BridgeState, action: BridgeAction): BridgeState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_EVM_SOURCE_CHAIN':
      if (action.payload === state.evmDestChain) {
        return {
          ...state,
          evmSourceChain: action.payload,
          evmDestChain: state.evmSourceChain,
        };
      }
      return { ...state, evmSourceChain: action.payload };

    case 'SET_EVM_DEST_CHAIN':
      if (action.payload === state.evmSourceChain) {
        return {
          ...state,
          evmDestChain: action.payload,
          evmSourceChain: state.evmDestChain,
        };
      }
      return { ...state, evmDestChain: action.payload };

    case 'SWAP_EVM_CHAINS':
      return {
        ...state,
        evmSourceChain: state.evmDestChain,
        evmDestChain: state.evmSourceChain,
      };

    case 'SET_SOLANA_DIRECTION':
      return { ...state, solanaDirection: action.payload };

    case 'SET_AMOUNT':
      return { ...state, amount: action.payload };

    case 'SET_DEST_TOKEN':
      return { ...state, destToken: action.payload };

    case 'START_PROCESSING':
      return {
        ...state,
        isProcessing: true,
        currentTxId: action.payload ?? state.currentTxId,
      };

    case 'STOP_PROCESSING':
      return { ...state, isProcessing: false };

    case 'SET_CURRENT_TX_ID':
      return { ...state, currentTxId: action.payload };

    case 'ADD_PENDING_TX':
      return {
        ...state,
        pendingTransactions: [...state.pendingTransactions, action.payload],
      };

    case 'UPDATE_PENDING_TX':
      return {
        ...state,
        pendingTransactions: state.pendingTransactions.map(tx =>
          tx.id === action.payload.id
            ? { ...tx, ...action.payload.updates, updatedAt: Date.now() }
            : tx
        ),
      };

    case 'REMOVE_PENDING_TX':
      return {
        ...state,
        pendingTransactions: state.pendingTransactions.filter(
          tx => tx.id !== action.payload
        ),
      };

    case 'SET_PENDING_TRANSACTIONS':
      return { ...state, pendingTransactions: action.payload };

    case 'TOGGLE_PENDING_MODAL':
      return {
        ...state,
        showPendingModal: action.payload ?? !state.showPendingModal
      };

    case 'RESET_FORM':
      return { ...state, amount: '', isProcessing: false, currentTxId: null };

    case 'RESET_ALL':
      return { ...initialState, pendingTransactions: state.pendingTransactions };

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

interface BridgeContextValue {
  state: BridgeState;
  dispatch: Dispatch<BridgeAction>;
  sourceChain: Chain;
  destChain: Chain;
  showTokenDropdown: boolean;
  setTab: (tab: Tab) => void;
  setEvmSourceChain: (chain: EvmChain) => void;
  setEvmDestChain: (chain: EvmChain) => void;
  swapEvmChains: () => void;
  setSolanaDirection: (direction: SolanaDirection) => void;
  setAmount: (amount: string) => void;
  setDestToken: (token: 'wpokt' | 'xpokt') => void;
  startProcessing: (txId?: string) => void;
  stopProcessing: () => void;
  resetForm: () => void;
}

const BridgeContext = createContext<BridgeContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

const STORAGE_KEY = 'xpokt-bridge-pending-txs';

interface BridgeProviderProps {
  children: ReactNode;
}

export function BridgeProvider({ children }: BridgeProviderProps) {
  const [state, dispatch] = useReducer(bridgeReducer, initialState);

  // Load pending transactions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const pendingTxs = JSON.parse(stored) as StoredTransaction[];
        dispatch({ type: 'SET_PENDING_TRANSACTIONS', payload: pendingTxs });
      }
    } catch (error) {
      console.error('Failed to load pending transactions:', error);
    }
  }, []);

  // Save pending transactions to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pendingTransactions));
    } catch (error) {
      console.error('Failed to save pending transactions:', error);
    }
  }, [state.pendingTransactions]);

  const sourceChain: Chain = state.activeTab === 'evm'
    ? state.evmSourceChain
    : (state.solanaDirection === 'toSolana' ? 'ethereum' : 'solana');

  const destChain: Chain = state.activeTab === 'evm'
    ? state.evmDestChain
    : (state.solanaDirection === 'toSolana' ? 'solana' : 'ethereum');

  const showTokenDropdown = destChain === 'ethereum';

  const setTab = useCallback((tab: Tab) => {
    dispatch({ type: 'SET_TAB', payload: tab });
  }, []);

  const setEvmSourceChain = useCallback((chain: EvmChain) => {
    dispatch({ type: 'SET_EVM_SOURCE_CHAIN', payload: chain });
  }, []);

  const setEvmDestChain = useCallback((chain: EvmChain) => {
    dispatch({ type: 'SET_EVM_DEST_CHAIN', payload: chain });
  }, []);

  const swapEvmChains = useCallback(() => {
    dispatch({ type: 'SWAP_EVM_CHAINS' });
  }, []);

  const setSolanaDirection = useCallback((direction: SolanaDirection) => {
    dispatch({ type: 'SET_SOLANA_DIRECTION', payload: direction });
  }, []);

  const setAmount = useCallback((amount: string) => {
    dispatch({ type: 'SET_AMOUNT', payload: amount });
  }, []);

  const setDestToken = useCallback((token: 'wpokt' | 'xpokt') => {
    dispatch({ type: 'SET_DEST_TOKEN', payload: token });
  }, []);

  const startProcessing = useCallback((txId?: string) => {
    dispatch({ type: 'START_PROCESSING', payload: txId });
  }, []);

  const stopProcessing = useCallback(() => {
    dispatch({ type: 'STOP_PROCESSING' });
  }, []);

  const resetForm = useCallback(() => {
    dispatch({ type: 'RESET_FORM' });
  }, []);

  const value: BridgeContextValue = {
    state,
    dispatch,
    sourceChain,
    destChain,
    showTokenDropdown,
    setTab,
    setEvmSourceChain,
    setEvmDestChain,
    swapEvmChains,
    setSolanaDirection,
    setAmount,
    setDestToken,
    startProcessing,
    stopProcessing,
    resetForm,
  };

  return (
    <BridgeContext.Provider value={value}>
      {children}
    </BridgeContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useBridgeContext(): BridgeContextValue {
  const context = useContext(BridgeContext);
  if (!context) {
    throw new Error('useBridgeContext must be used within a BridgeProvider');
  }
  return context;
}

export const useBridgeState = useBridgeContext;
