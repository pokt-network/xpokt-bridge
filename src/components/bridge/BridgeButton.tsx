'use client';

import { useAccount } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useBridgeContext } from '@/context/BridgeContext';
import { useTokenBalances } from '@/hooks/useTokenBalances';

const chainNames: Record<string, string> = {
  ethereum: 'Ethereum',
  base: 'Base',
  solana: 'Solana',
};

interface BridgeButtonProps {
  onBridge: () => void;
  isProcessing?: boolean;
}

export function BridgeButton({ onBridge, isProcessing = false }: BridgeButtonProps) {
  const { address: evmAddress, isConnected: isEvmConnected } = useAccount();
  const { publicKey: solanaPublicKey, connected: isSolanaConnected } = useWallet();
  const { setVisible: setSolanaModalVisible } = useWalletModal();
  const { state, sourceChain, destChain } = useBridgeContext();
  const { getBalanceForChain } = useTokenBalances();

  const balance = getBalanceForChain(sourceChain);
  const isSolanaTab = state.activeTab === 'solana';
  const needsBothWallets = isSolanaTab;

  // Determine button state and action
  let buttonText = '';
  let disabled = true;
  let onClick: () => void = () => {};

  if (!isEvmConnected || !evmAddress) {
    // EVM wallet not connected — but we can't trigger wagmi connect from here
    // without a connector reference, so show a prompt
    buttonText = 'Connect EVM Wallet';
    disabled = true;
  } else if (needsBothWallets && !isSolanaConnected) {
    // Solana wallet not connected — open Solana wallet modal
    buttonText = 'Connect Solana Wallet';
    disabled = false;
    onClick = () => setSolanaModalVisible(true);
  } else if (!state.amount || parseFloat(state.amount) === 0) {
    buttonText = 'Enter Amount';
    disabled = true;
  } else if (parseFloat(state.amount) > parseFloat(balance.formatted)) {
    buttonText = 'Insufficient Balance';
    disabled = true;
  } else if (isProcessing) {
    buttonText = 'Bridging...';
    disabled = true;
  } else {
    buttonText = `Bridge to ${chainNames[destChain]}`;
    disabled = false;
    onClick = onBridge;
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: 18,
        background: disabled
          ? '#232a2f'
          : 'linear-gradient(135deg, #025af2 0%, #0147c2 100%)',
        border: 'none',
        borderRadius: 14,
        color: disabled ? 'rgba(255,255,255,0.3)' : '#ffffff',
        fontSize: 16,
        fontWeight: 600,
        fontFamily: "'Rubik', sans-serif",
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: disabled ? 'none' : '0 4px 20px rgba(2, 90, 242, 0.4)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {isProcessing && (
          <span
            style={{
              display: 'inline-block',
              width: 16,
              height: 16,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        )}
        {buttonText}
      </span>
    </button>
  );
}
