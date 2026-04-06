'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
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
  const { state, dispatch, startProcessing, stopProcessing, resetForm } = useBridgeContext();
  const { address: evmAddress } = useAccount();
  const { publicKey: solanaPublicKey } = useWallet();
  const txHistory = useTransactionHistory();

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

  // ─── Resume flow state ─────────────────────────────────────────────────────
  const [showResumeInput, setShowResumeInput] = useState(false);
  const [resumeTxHash, setResumeTxHash] = useState('');
  const [isResuming, setIsResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // Track the pending transaction ID for the current bridge flow
  const [currentPendingTxId, setCurrentPendingTxId] = useState<string | null>(null);

  // Get step state from the active hook
  const activeStep = isToSolana ? compoundSolana.state.step : unifiedSolana.state.step;
  const activeError = isToSolana ? compoundSolana.state.error : unifiedSolana.state.error;

  const isVaaReady = vaaResult !== null && !isClaiming;
  const isActive = (activeStep !== 'idle' && activeStep !== 'error' && activeStep !== 'complete') || isClaiming || isResuming;
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
    setShowResumeInput(false);
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

          // Save to pending transactions for resume across page reloads
          const txId = txHistory.addTransaction({
            sourceChain: 'ethereum',
            destChain: 'solana',
            amount: state.amount,
            amountRaw: parseUnits(state.amount, 6).toString(),
            status: 'waiting-vaa',
            sourceTxHash: result.sourceTxHash,
          });
          setCurrentPendingTxId(txId);

          const vaa = await compoundSolana.waitForVAA(result.sourceTxHash);
          if (vaa?.vaaBytes) {
            setVaaResult(vaa);
            // Update pending tx with VAA data
            txHistory.updateTransaction(txId, {
              status: 'vaa-ready',
              wormhole: {
                emitterChain: (vaa as any).emitterChain ?? 0,
                emitterAddress: (vaa as any).emitterAddress ?? '',
                sequence: (vaa as any).sequence ?? '',
                vaaBytes: vaa.vaaBytes,
              },
            });
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

          // Save to pending transactions
          const txId = txHistory.addTransaction({
            sourceChain: 'solana',
            destChain: 'ethereum',
            amount: state.amount,
            amountRaw: amountRaw.toString(),
            status: 'waiting-vaa',
            sourceTxHash: result.sourceTxHash,
            destToken: state.destToken,
          });
          setCurrentPendingTxId(txId);

          const vaa = await unifiedSolana.waitForVAA(result.sourceTxHash);
          if (vaa?.vaaBytes) {
            setVaaResult(vaa);
            txHistory.updateTransaction(txId, {
              status: 'vaa-ready',
              wormhole: {
                emitterChain: (vaa as any).emitterChain ?? 0,
                emitterAddress: (vaa as any).emitterAddress ?? '',
                sequence: (vaa as any).sequence ?? '',
                vaaBytes: vaa.vaaBytes,
              },
            });
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
    state.destToken,
    isToSolana,
    evmAddress,
    solanaPublicKey,
    compoundSolana,
    unifiedSolana,
    startProcessing,
    stopProcessing,
    txHistory,
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
      // Mark pending transaction as complete
      if (currentPendingTxId) {
        txHistory.updateTransaction(currentPendingTxId, { status: 'complete' });
      }
    } catch (error: any) {
      console.error('[SolanaBridge] Claim error:', error);
    } finally {
      setIsClaiming(false);
    }
  }, [vaaResult, isToSolana, compoundSolana, unifiedSolana, state.destToken, bridgeAmountRaw, currentPendingTxId, txHistory]);

  /**
   * Resume: User pastes a source tx hash to resume a stuck transfer.
   * Polls for the VAA, then shows the Claim button.
   */
  const handleResume = useCallback(async () => {
    const txHash = resumeTxHash.trim();
    if (!txHash) return;

    setIsResuming(true);
    setResumeError(null);
    setVaaResult(null);
    setSourceTxHashForLink(txHash);

    try {
      if (isToSolana) {
        // ETH → Solana: poll for VAA via compound Solana bridge
        const vaa = await compoundSolana.resumeFromVAA(txHash);
        if (vaa?.vaaBytes) {
          setVaaResult(vaa);
        } else {
          setResumeError('VAA not found. The transaction may still be processing — try again later.');
        }
      } else {
        // Solana → ETH: poll for VAA via unified Solana bridge
        const vaa = await unifiedSolana.resumeFromVAA(txHash, 'Solana');
        if (vaa?.vaaBytes) {
          setVaaResult(vaa);
        } else {
          setResumeError('VAA not found. The transaction may still be processing — try again later.');
        }
      }
    } catch (error: any) {
      console.error('[SolanaBridge] Resume error:', error);
      setResumeError(error.message || 'Failed to resume transaction');
    } finally {
      setIsResuming(false);
    }
  }, [resumeTxHash, isToSolana, compoundSolana, unifiedSolana]);

  /**
   * Resume from a pending transaction stored in context (e.g. from PendingTransactionsModal)
   */
  const handleResumeFromPending = useCallback(async (tx: import('@/types/transactions').StoredTransaction) => {
    if (!tx.sourceTxHash) return;

    // If VAA bytes are already cached, skip polling
    if (tx.wormhole?.vaaBytes) {
      setVaaResult({ vaaBytes: tx.wormhole.vaaBytes });
      setSourceTxHashForLink(tx.sourceTxHash);
      setCurrentPendingTxId(tx.id);
      if (tx.amountRaw) setBridgeAmountRaw(BigInt(tx.amountRaw));
      return;
    }

    // Otherwise poll for VAA
    setResumeTxHash(tx.sourceTxHash);
    setCurrentPendingTxId(tx.id);
    if (tx.amountRaw) setBridgeAmountRaw(BigInt(tx.amountRaw));

    setIsResuming(true);
    setResumeError(null);
    setVaaResult(null);
    setSourceTxHashForLink(tx.sourceTxHash);
    setShowResumeInput(false);

    try {
      if (tx.destChain === 'solana') {
        const vaa = await compoundSolana.resumeFromVAA(tx.sourceTxHash);
        if (vaa?.vaaBytes) {
          setVaaResult(vaa);
          txHistory.updateTransaction(tx.id, {
            status: 'vaa-ready',
            wormhole: {
              emitterChain: (vaa as any).emitterChain ?? 0,
              emitterAddress: (vaa as any).emitterAddress ?? '',
              sequence: (vaa as any).sequence ?? '',
              vaaBytes: vaa.vaaBytes,
            },
          });
        } else {
          setResumeError('VAA not found yet — try again later.');
        }
      } else {
        const vaa = await unifiedSolana.resumeFromVAA(tx.sourceTxHash, 'Solana');
        if (vaa?.vaaBytes) {
          setVaaResult(vaa);
          txHistory.updateTransaction(tx.id, {
            status: 'vaa-ready',
            wormhole: {
              emitterChain: (vaa as any).emitterChain ?? 0,
              emitterAddress: (vaa as any).emitterAddress ?? '',
              sequence: (vaa as any).sequence ?? '',
              vaaBytes: vaa.vaaBytes,
            },
          });
        } else {
          setResumeError('VAA not found yet — try again later.');
        }
      }
    } catch (error: any) {
      setResumeError(error.message || 'Failed to resume');
    } finally {
      setIsResuming(false);
    }
  }, [compoundSolana, unifiedSolana, txHistory]);

  const handleReset = useCallback(() => {
    compoundSolana.reset();
    unifiedSolana.reset();
    setVaaResult(null);
    setBridgeAmountRaw(0n);
    setSourceTxHashForLink(null);
    setIsClaiming(false);
    setShowResumeInput(false);
    setResumeTxHash('');
    setIsResuming(false);
    setResumeError(null);
    setCurrentPendingTxId(null);
    resetForm();
  }, [compoundSolana, unifiedSolana, resetForm]);

  // Check for resumable pending transactions on mount
  const resumableTxs = txHistory.resumableTransactions.filter(tx => {
    if (isToSolana) return tx.destChain === 'solana';
    return tx.sourceChain === 'solana';
  });

  // Watch for resume requests from PendingTransactionsModal (via context)
  useEffect(() => {
    if (state.resumeRequest) {
      const tx = state.resumeRequest;
      // Clear the request immediately to prevent re-triggering
      dispatch({ type: 'SET_RESUME_REQUEST', payload: null });
      handleResumeFromPending(tx);
    }
  }, [state.resumeRequest]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {sourceTxHashForLink && (isWaitingVAA || isResuming) && (
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

      {/* ─── Resume Transaction Section ──────────────────────────────────────── */}
      {!isActive && !isComplete && !isVaaReady && (
        <div style={{ marginTop: 16 }}>
          {/* Resumable pending transactions from previous sessions */}
          {resumableTxs.length > 0 && !showResumeInput && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(255, 197, 71, 0.08)',
              border: '1px solid rgba(255, 197, 71, 0.2)',
              borderRadius: 12,
              marginBottom: 8,
            }}>
              <p style={{ fontSize: 13, color: '#ffc547', marginBottom: 8, fontWeight: 500 }}>
                You have {resumableTxs.length} pending transaction{resumableTxs.length > 1 ? 's' : ''} awaiting claim
              </p>
              {resumableTxs.map(tx => (
                <button
                  key={tx.id}
                  onClick={() => handleResumeFromPending(tx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255, 197, 71, 0.1)',
                    border: '1px solid rgba(255, 197, 71, 0.15)',
                    borderRadius: 8,
                    color: '#f6f6f6',
                    fontSize: 12,
                    cursor: 'pointer',
                    marginBottom: 4,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span>{tx.amount} POKT — {tx.sourceTxHash.slice(0, 10)}...{tx.sourceTxHash.slice(-6)}</span>
                  <span style={{
                    padding: '2px 8px',
                    background: 'rgba(72, 229, 194, 0.15)',
                    color: '#48e5c2',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 500,
                  }}>
                    Resume
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Manual resume via tx hash */}
          {!showResumeInput ? (
            <button
              onClick={() => setShowResumeInput(true)}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                color: 'rgba(255,255,255,0.4)',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: "'Rubik', sans-serif",
              }}
            >
              Have a pending transaction? Resume claim
            </button>
          ) : (
            <div style={{
              padding: 16,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
            }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
                Paste the source transaction hash to resume claiming:
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={resumeTxHash}
                  onChange={(e) => setResumeTxHash(e.target.value)}
                  placeholder="0x... or Solana tx hash"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: '#1a1f23',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#f6f6f6',
                    fontSize: 13,
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleResume}
                  disabled={!resumeTxHash.trim() || isResuming}
                  style={{
                    padding: '10px 20px',
                    background: resumeTxHash.trim()
                      ? 'linear-gradient(135deg, #025af2 0%, #0147c2 100%)'
                      : 'rgba(255,255,255,0.05)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: resumeTxHash.trim() && !isResuming ? 'pointer' : 'not-allowed',
                    opacity: resumeTxHash.trim() && !isResuming ? 1 : 0.5,
                    fontFamily: "'Rubik', sans-serif",
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isResuming ? 'Polling...' : 'Resume'}
                </button>
              </div>
              <button
                onClick={() => { setShowResumeInput(false); setResumeTxHash(''); setResumeError(null); }}
                style={{
                  marginTop: 8,
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              {resumeError && (
                <div style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  background: 'rgba(255, 90, 95, 0.1)',
                  border: '1px solid rgba(255, 90, 95, 0.2)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#ff5a5f',
                }}>
                  {resumeError}
                </div>
              )}
            </div>
          )}
        </div>
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
