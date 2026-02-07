'use client';

import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import { parseUnits } from 'viem';
import { useBridgeContext } from '@/context/BridgeContext';
import { useCompoundEVMBridge } from '@/hooks/useCompoundEVMBridge';
import { useCompoundSolanaBridge } from '@/hooks/useCompoundSolanaBridge';
import { useUnifiedSolanaBridge } from '@/hooks/useUnifiedSolanaBridge';
import { useRelayPoller } from '@/hooks/useRelayPoller';
import { TabContainer } from './TabContainer';
import { ChainSelector } from './ChainSelector';
import { AmountInput } from './AmountInput';
import { ReceiveSection } from './ReceiveSection';
import { BridgeInfo } from './BridgeInfo';
import { BridgeButton } from './BridgeButton';
import { DirectionSelector } from './DirectionSelector';
import { WarningBox } from './WarningBox';
import {
  TransactionStepper,
  useCompoundEVMBridgeSteps,
  useCompoundSolanaBridgeSteps,
  useSolanaToEthSteps,
  useEthToSolanaSteps,
} from './TransactionStepper';

export function BridgeCard() {
  const { state, setEvmSourceChain, setEvmDestChain, swapEvmChains } = useBridgeContext();

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #232a2f 0%, #1e2428 100%)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 80px rgba(2,90,242,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}
    >
      {/* Tabs flush to card edges (outside content padding) */}
      <TabContainer />

      {/* Card content with padding */}
      <div style={{ padding: 24 }}>
        {state.activeTab === 'evm' ? (
          <EVMBridgeContent
            sourceChain={state.evmSourceChain}
            destChain={state.evmDestChain}
            onSourceSelect={setEvmSourceChain}
            onDestSelect={setEvmDestChain}
            onSwap={swapEvmChains}
          />
        ) : (
          <SolanaBridgeContent />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// EVM Bridge Content (ETH <-> Base)
// ============================================================================

function EVMBridgeContent({
  sourceChain,
  destChain,
  onSourceSelect,
  onDestSelect,
  onSwap,
}: {
  sourceChain: 'ethereum' | 'base';
  destChain: 'ethereum' | 'base';
  onSourceSelect: (chain: 'ethereum' | 'base') => void;
  onDestSelect: (chain: 'ethereum' | 'base') => void;
  onSwap: () => void;
}) {
  const { state, startProcessing, stopProcessing, resetForm } = useBridgeContext();
  const { address } = useAccount();

  const evmBridge = useCompoundEVMBridge({
    sourceChain,
    destChain,
  });

  // Poll Wormholescan for relay delivery when in 'waiting-relay' state
  const bridgeTxHash = evmBridge.state.step === 'waiting-relay'
    ? evmBridge.state.txHashes.bridge
    : null;

  const relayPoller = useRelayPoller(bridgeTxHash, () => {
    evmBridge.markComplete();
  });

  const steps = useCompoundEVMBridgeSteps(
    evmBridge.state.step,
    evmBridge.state.needsLockboxConversion,
    evmBridge.state.txHashes
  );

  const isActive = evmBridge.state.step !== 'idle' && evmBridge.state.step !== 'error';
  const isComplete = evmBridge.state.step === 'complete';

  const handleBridge = useCallback(async () => {
    if (!state.amount || !address) return;
    startProcessing();
    try {
      await evmBridge.bridge(state.amount);
      // Bridge initiated — now in 'waiting-relay' state
      // Auto-relay will complete in ~2-20 min
    } catch (error: any) {
      console.error('[EVMBridge] Error:', error);
    } finally {
      stopProcessing();
    }
  }, [state.amount, address, evmBridge, startProcessing, stopProcessing]);

  const handleReset = useCallback(() => {
    evmBridge.reset();
    relayPoller.reset();
    resetForm();
  }, [evmBridge, relayPoller, resetForm]);

  return (
    <>
      <ChainSelector label="From" selected={sourceChain} onSelect={onSourceSelect} />

      {/* Swap arrow */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
        <button
          onClick={onSwap}
          disabled={isActive}
          style={{
            width: 40,
            height: 40,
            background: '#232a2f',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isActive ? 'not-allowed' : 'pointer',
            color: '#025af2',
            fontSize: 20,
            transition: 'all 0.2s ease',
            opacity: isActive ? 0.5 : 1,
          }}
        >
          {'\u21C5'}
        </button>
      </div>

      <ChainSelector label="To" selected={destChain} onSelect={onDestSelect} />
      <AmountInput />
      <ReceiveSection />
      <BridgeInfo />

      {/* Transaction Stepper — shown during active bridge flow */}
      {(isActive || isComplete || evmBridge.state.step === 'error') && (
        <div style={{ marginBottom: 16 }}>
          <TransactionStepper
            steps={steps.map(step => {
              // Enhance the relay step with poller info
              if (step.id === 'waiting-relay') {
                if (relayPoller.isDelivered && relayPoller.targetTxHash) {
                  return {
                    ...step,
                    description: 'Relay delivered!',
                    txHash: relayPoller.targetTxHash,
                  };
                }
                if (relayPoller.isPolling) {
                  return {
                    ...step,
                    description: 'Monitoring relay delivery (~2-20 min)...',
                  };
                }
                if (relayPoller.error) {
                  return {
                    ...step,
                    description: relayPoller.error,
                  };
                }
              }
              return step;
            })}
            variant="vertical"
          />
        </div>
      )}

      {/* Bridge / Reset Button */}
      {isComplete || evmBridge.state.step === 'error' ? (
        <button
          onClick={handleReset}
          style={{
            width: '100%',
            padding: 18,
            background: isComplete
              ? 'linear-gradient(135deg, #48e5c2 0%, #36b89e 100%)'
              : '#232a2f',
            border: 'none',
            borderRadius: 14,
            color: isComplete ? '#171c1f' : '#f6f6f6',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "'Rubik', sans-serif",
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {isComplete ? '✓ Bridge Complete — Start New' : 'Try Again'}
        </button>
      ) : (
        <BridgeButton
          onBridge={handleBridge}
          isProcessing={isActive}
        />
      )}

      {/* Error message */}
      {evmBridge.state.error && (
        <div style={{
          marginTop: 12,
          padding: '12px 16px',
          background: 'rgba(255, 90, 95, 0.1)',
          border: '1px solid rgba(255, 90, 95, 0.2)',
          borderRadius: 12,
          fontSize: 13,
          color: '#ff5a5f',
        }}>
          {evmBridge.state.error}
        </div>
      )}
    </>
  );
}

// ============================================================================
// Solana Bridge Content (ETH <-> Solana)
// ============================================================================

function SolanaBridgeContent() {
  const { state, startProcessing, stopProcessing, resetForm } = useBridgeContext();
  const { address: evmAddress } = useAccount();
  const { publicKey: solanaPublicKey } = useWallet();

  const direction = state.solanaDirection;

  // Use compound hook for ETH→Solana (handles auto wPOKT conversion)
  const compoundSolana = useCompoundSolanaBridge();

  // Use unified hook for Solana→ETH (handles post-claim wPOKT conversion)
  const unifiedSolana = useUnifiedSolanaBridge({ direction });

  // Determine which hook is active based on direction
  const isToSolana = direction === 'toSolana';

  // Get step state from the active hook
  const activeStep = isToSolana ? compoundSolana.state.step : unifiedSolana.state.step;
  const activeError = isToSolana ? compoundSolana.state.error : unifiedSolana.state.error;
  const isActive = activeStep !== 'idle' && activeStep !== 'error' && activeStep !== 'complete';
  const isComplete = activeStep === 'complete';
  const hasError = activeStep === 'error';

  // Build steps for TransactionStepper
  const compoundSolanaSteps = useCompoundSolanaBridgeSteps(
    compoundSolana.state.step,
    compoundSolana.state.needsLockboxConversion,
    compoundSolana.state.txHashes
  );

  const ethToSolanaSteps = useEthToSolanaSteps(
    unifiedSolana.state.step,
    {
      source: unifiedSolana.state.sourceTxHash,
      destination: unifiedSolana.state.destTxHash,
    }
  );

  const solanaToEthSteps = useSolanaToEthSteps(
    unifiedSolana.state.step,
    state.destToken,
    {
      source: unifiedSolana.state.sourceTxHash,
      destination: unifiedSolana.state.destTxHash,
      conversion: unifiedSolana.state.conversionTxHash,
    }
  );

  // Pick the right steps to display
  const steps = isToSolana ? compoundSolanaSteps : solanaToEthSteps;

  const handleBridge = useCallback(async () => {
    if (!state.amount) return;

    startProcessing();
    try {
      if (isToSolana) {
        // ETH → Solana: use compound hook (auto wPOKT conversion + Wormhole)
        if (!evmAddress || !solanaPublicKey) return;
        const result = await compoundSolana.bridge(
          state.amount,
          solanaPublicKey.toBase58()
        );
        // Transfer initiated — waiting for VAA
        // completeTransfer will need to be called after VAA is ready
        console.log('[SolanaBridge] ETH→Solana initiated:', result);
      } else {
        // Solana → ETH: use unified hook
        if (!evmAddress || !solanaPublicKey) return;
        const amountRaw = parseUnits(state.amount, 6);
        const result = await unifiedSolana.initiateTransfer(
          amountRaw,
          solanaPublicKey.toBase58(),
          evmAddress
        );
        console.log('[SolanaBridge] Solana→ETH initiated:', result);
      }
    } catch (error: any) {
      console.error('[SolanaBridge] Error:', error);
    } finally {
      stopProcessing();
    }
  }, [
    state.amount,
    isToSolana,
    evmAddress,
    solanaPublicKey,
    compoundSolana,
    unifiedSolana,
    startProcessing,
    stopProcessing,
  ]);

  const handleReset = useCallback(() => {
    compoundSolana.reset();
    unifiedSolana.reset();
    resetForm();
  }, [compoundSolana, unifiedSolana, resetForm]);

  return (
    <>
      <DirectionSelector />
      <AmountInput />
      <ReceiveSection />
      <BridgeInfo />

      {/* Transaction Stepper — shown during active bridge flow */}
      {(isActive || isComplete || hasError) && (
        <div style={{ marginBottom: 16 }}>
          <TransactionStepper steps={steps} variant="vertical" />
        </div>
      )}

      {/* Bridge / Reset Button */}
      {isComplete || hasError ? (
        <button
          onClick={handleReset}
          style={{
            width: '100%',
            padding: 18,
            background: isComplete
              ? 'linear-gradient(135deg, #48e5c2 0%, #36b89e 100%)'
              : '#232a2f',
            border: 'none',
            borderRadius: 14,
            color: isComplete ? '#171c1f' : '#f6f6f6',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "'Rubik', sans-serif",
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {isComplete ? '✓ Bridge Complete — Start New' : 'Try Again'}
        </button>
      ) : (
        <BridgeButton
          onBridge={handleBridge}
          isProcessing={isActive}
        />
      )}

      {/* Warning box */}
      <WarningBox />

      {/* Error message */}
      {activeError && (
        <div style={{
          marginTop: 12,
          padding: '12px 16px',
          background: 'rgba(255, 90, 95, 0.1)',
          border: '1px solid rgba(255, 90, 95, 0.2)',
          borderRadius: 12,
          fontSize: 13,
          color: '#ff5a5f',
        }}>
          {activeError}
        </div>
      )}
    </>
  );
}
