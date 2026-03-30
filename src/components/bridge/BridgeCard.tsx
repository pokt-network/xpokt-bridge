'use client';

import { useCallback, useState } from 'react';
import { useAccount } from 'wagmi';
import { useWallet } from '@solana/wallet-adapter-react';
import { parseUnits } from 'viem';
import { useBridgeContext } from '@/context/BridgeContext';
import { getChainName } from '@/lib/chains/chainRegistry';
import type { EvmChain } from '@/types/bridge';
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
  sourceChain: EvmChain | null;
  destChain: EvmChain | null;
  onSourceSelect: (chain: EvmChain) => void;
  onDestSelect: (chain: EvmChain) => void;
  onSwap: () => void;
}) {
  const { state, startProcessing, stopProcessing, resetForm } = useBridgeContext();
  const { address } = useAccount();

  // Default to ethereum/base when null — hook needs non-null values.
  // Bridge button is disabled when either chain is null, so these defaults are never used for actual bridging.
  const evmBridge = useCompoundEVMBridge({
    sourceChain: sourceChain ?? 'ethereum',
    destChain: destChain ?? 'base',
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
    if (!state.amount || !address || !sourceChain || !destChain) return;
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
          disabled={isActive || !sourceChain || !destChain}
          style={{
            width: 40,
            height: 40,
            background: '#232a2f',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: (isActive || !sourceChain || !destChain) ? 'not-allowed' : 'pointer',
            color: '#025af2',
            fontSize: 20,
            transition: 'all 0.2s ease',
            opacity: (isActive || !sourceChain || !destChain) ? 0.5 : 1,
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

  // ─── Claim flow state ──────────────────────────────────────────────────────
  // VAA bytes are stored here once polling completes; the user then clicks Claim.
  const [vaaResult, setVaaResult] = useState<{ vaaBytes: string } | null>(null);
  const [bridgeAmountRaw, setBridgeAmountRaw] = useState<bigint>(0n);
  const [isClaiming, setIsClaiming] = useState(false);
  const [sourceTxHashForLink, setSourceTxHashForLink] = useState<string | null>(null);

  // Get step state from the active hook
  const activeStep = isToSolana ? compoundSolana.state.step : unifiedSolana.state.step;
  const activeError = isToSolana ? compoundSolana.state.error : unifiedSolana.state.error;

  const isVaaReady = vaaResult !== null && !isClaiming;
  const isActive = (activeStep !== 'idle' && activeStep !== 'error' && activeStep !== 'complete') || isClaiming;
  const isComplete = activeStep === 'complete';
  const hasError = activeStep === 'error';
  const isWaitingVAA = activeStep === 'waiting-vaa';

  // Build steps for TransactionStepper
  const compoundSolanaSteps = useCompoundSolanaBridgeSteps(
    compoundSolana.state.step,
    compoundSolana.state.needsLockboxConversion,
    compoundSolana.state.txHashes
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

  // Destination chain name for claim button
  const claimChainName = isToSolana ? 'Solana' : 'Ethereum';

  /**
   * Phase 1: Initiate bridge + poll for VAA. Stops before claiming.
   */
  const handleBridge = useCallback(async () => {
    if (!state.amount) return;

    setVaaResult(null);
    setSourceTxHashForLink(null);
    startProcessing();

    try {
      if (isToSolana) {
        if (!evmAddress || !solanaPublicKey) return;
        const result = await compoundSolana.bridge(
          state.amount,
          solanaPublicKey.toBase58()
        );

        if (result?.sourceTxHash) {
          setSourceTxHashForLink(result.sourceTxHash);
          const vaa = await compoundSolana.waitForVAA(result.sourceTxHash);
          if (vaa?.vaaBytes) {
            setVaaResult(vaa);
          }
        }
      } else {
        if (!evmAddress || !solanaPublicKey) return;
        const amountRaw = parseUnits(state.amount, 6);
        setBridgeAmountRaw(amountRaw);
        const result = await unifiedSolana.initiateTransfer(
          amountRaw,
          solanaPublicKey.toBase58(),
          evmAddress
        );

        if (result?.sourceTxHash) {
          setSourceTxHashForLink(result.sourceTxHash);
          const vaa = await unifiedSolana.waitForVAA(result.sourceTxHash);
          if (vaa?.vaaBytes) {
            setVaaResult(vaa);
          }
        }
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

  /**
   * Phase 2: User clicks Claim — complete the transfer on the destination chain.
   */
  const handleClaim = useCallback(async () => {
    if (!vaaResult?.vaaBytes) return;

    setIsClaiming(true);
    try {
      if (isToSolana) {
        await compoundSolana.completeTransfer(vaaResult.vaaBytes);
      } else {
        await unifiedSolana.completeTransferWithConversion(
          vaaResult.vaaBytes,
          state.destToken,
          bridgeAmountRaw,
        );
      }
    } catch (error: any) {
      console.error('[SolanaBridge] Claim error:', error);
    } finally {
      setIsClaiming(false);
    }
  }, [vaaResult, isToSolana, compoundSolana, unifiedSolana, state.destToken, bridgeAmountRaw]);

  const handleReset = useCallback(() => {
    compoundSolana.reset();
    unifiedSolana.reset();
    setVaaResult(null);
    setBridgeAmountRaw(0n);
    setSourceTxHashForLink(null);
    setIsClaiming(false);
    resetForm();
  }, [compoundSolana, unifiedSolana, resetForm]);

  return (
    <>
      <DirectionSelector />
      <AmountInput />
      <ReceiveSection />
      <BridgeInfo />

      {/* Transaction Stepper — shown during active bridge flow */}
      {(isActive || isComplete || hasError || isVaaReady) && (
        <div style={{ marginBottom: 16 }}>
          <TransactionStepper steps={steps} variant="vertical" />
        </div>
      )}

      {/* Source tx link — shown while waiting for VAA */}
      {sourceTxHashForLink && isWaitingVAA && (
        <div style={{ marginBottom: 12, textAlign: 'center' }}>
          <a
            href={`https://wormholescan.io/#/tx/${sourceTxHashForLink}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: '#4c9bf5', textDecoration: 'underline' }}
          >
            View on Wormholescan
          </a>
        </div>
      )}

      {/* Claim Button — shown when VAA is ready */}
      {isVaaReady && !isComplete && !hasError ? (
        <button
          onClick={handleClaim}
          style={{
            width: '100%',
            padding: 18,
            background: 'linear-gradient(135deg, #025af2 0%, #0147c2 100%)',
            border: 'none',
            borderRadius: 14,
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "'Rubik', sans-serif",
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 20px rgba(2, 90, 242, 0.4)',
          }}
        >
          Claim Tokens on {claimChainName}
        </button>
      ) : isComplete || hasError ? (
        /* Reset Button */
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
          {isComplete ? '\u2713 Bridge Complete — Bridge Another' : 'Try Again'}
        </button>
      ) : (
        /* Bridge / Processing Button */
        <BridgeButton
          onBridge={handleBridge}
          isProcessing={isActive}
        />
      )}

      {/* Warning box — context-aware */}
      <WarningBox claimReady={isVaaReady} />

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
