'use client';

import { useMemo } from 'react';
import type { CompoundEVMBridgeStep } from '@/hooks/useCompoundEVMBridge';
import type { CompoundSolanaBridgeStep } from '@/hooks/useCompoundSolanaBridge';
import type { UnifiedSolanaBridgeStep } from '@/hooks/useUnifiedSolanaBridge';

// ============================================================================
// Core Types
// ============================================================================

export type StepStatus = 'pending' | 'active' | 'complete' | 'error';

export interface Step {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
  txHash?: string;
}

// ============================================================================
// TransactionStepper Component
// ============================================================================

interface TransactionStepperProps {
  steps: Step[];
  variant?: 'vertical' | 'compact';
}

export function TransactionStepper({ steps, variant = 'vertical' }: TransactionStepperProps) {
  if (variant === 'compact') {
    return <CompactStepper steps={steps} />;
  }
  return <VerticalStepper steps={steps} />;
}

function VerticalStepper({ steps }: { steps: Step[] }) {
  return (
    <div className="py-4 px-2">
      {steps.map((step, index) => (
        <div key={step.id} className="flex gap-3">
          {/* Step indicator column */}
          <div className="flex flex-col items-center">
            <StepIcon status={step.status} />
            {index < steps.length - 1 && (
              <div
                className="w-[2px] flex-1 min-h-[24px]"
                style={{
                  background: step.status === 'complete'
                    ? '#48e5c2'
                    : 'rgba(255,255,255,0.1)',
                }}
              />
            )}
          </div>
          {/* Step content */}
          <div className="pb-4 flex-1 min-w-0">
            <p
              className="text-sm font-medium"
              style={{
                color: step.status === 'active'
                  ? '#ffffff'
                  : step.status === 'complete'
                  ? '#48e5c2'
                  : step.status === 'error'
                  ? '#ff5a5f'
                  : 'rgba(255,255,255,0.4)',
              }}
            >
              {step.label}
              {step.status === 'active' && (
                <span className="ml-2 inline-block w-3 h-3 border-2 border-[#4c9bf5]/30 border-t-[#4c9bf5] rounded-full animate-spin-slow" />
              )}
            </p>
            <p className="text-xs text-white/30 mt-0.5">{step.description}</p>
            {step.txHash && (
              <a
                href={`https://wormholescan.io/#/tx/${step.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#4c9bf5] hover:text-[#4c9bf5]/80 mt-1 inline-block"
              >
                View on explorer {'\u2197'}
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompactStepper({ steps }: { steps: Step[] }) {
  const activeStep = steps.find(s => s.status === 'active');
  const completedCount = steps.filter(s => s.status === 'complete').length;

  return (
    <div className="py-3">
      {/* Progress bar */}
      <div className="flex gap-1 mb-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              background: step.status === 'complete'
                ? '#48e5c2'
                : step.status === 'active'
                ? '#4c9bf5'
                : step.status === 'error'
                ? '#ff5a5f'
                : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>
      {/* Current step info */}
      {activeStep && (
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-[#4c9bf5]/30 border-t-[#4c9bf5] rounded-full animate-spin-slow" />
          <span className="text-xs text-white/60">
            {activeStep.label} ({completedCount}/{steps.length})
          </span>
        </div>
      )}
      {!activeStep && completedCount === steps.length && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#48e5c2]">{'\u2713'} Complete</span>
        </div>
      )}
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  const size = 24;

  if (status === 'complete') {
    return (
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: size, height: size, background: '#48e5c2' }}
      >
        <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="#171c1f" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          background: 'rgba(76, 155, 245, 0.15)',
          border: '2px solid #4c9bf5',
        }}
      >
        <div className="w-2 h-2 rounded-full bg-[#4c9bf5]" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: size, height: size, background: '#ff5a5f' }}
      >
        <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
          <path d="M3 3L9 9M9 3L3 9" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // pending
  return (
    <div
      className="rounded-full"
      style={{
        width: size,
        height: size,
        background: '#232a2f',
        border: '2px solid rgba(255,255,255,0.15)',
      }}
    />
  );
}

// ============================================================================
// Helper Hooks for Bridge Flows
// ============================================================================

/**
 * Helper hook for Compound EVM bridge steps (ETH -> Base with auto wPOKT conversion)
 */
export function useCompoundEVMBridgeSteps(
  currentStep: CompoundEVMBridgeStep,
  needsLockbox: boolean,
  txHashes: {
    wpoktApprove?: string;
    lockboxDeposit?: string;
    xpoktApprove?: string;
    bridge?: string;
  }
): Step[] {
  return useMemo(() => {
    const steps: Step[] = [];

    const stepOrder: CompoundEVMBridgeStep[] = needsLockbox
      ? ['approving-wpokt', 'converting-lockbox', 'approving-xpokt', 'bridging', 'waiting-relay']
      : ['approving-xpokt', 'bridging', 'waiting-relay'];

    if (needsLockbox) {
      steps.push({
        id: 'approving-wpokt',
        label: 'Approve wPOKT',
        description: 'Allow Lockbox to spend your wPOKT',
        status: getStepStatusFromOrder('approving-wpokt', currentStep, stepOrder),
        txHash: txHashes.wpoktApprove,
      });
      steps.push({
        id: 'converting-lockbox',
        label: 'Convert to xPOKT',
        description: 'Deposit wPOKT to Lockbox',
        status: getStepStatusFromOrder('converting-lockbox', currentStep, stepOrder),
        txHash: txHashes.lockboxDeposit,
      });
    }

    steps.push({
      id: 'approving-xpokt',
      label: 'Approve xPOKT',
      description: 'Allow Bridge Adapter to spend xPOKT',
      status: getStepStatusFromOrder('approving-xpokt', currentStep, stepOrder),
      txHash: txHashes.xpoktApprove,
    });

    steps.push({
      id: 'bridging',
      label: 'Initiate Bridge',
      description: 'Send xPOKT to Bridge Adapter',
      status: getStepStatusFromOrder('bridging', currentStep, stepOrder),
      txHash: txHashes.bridge,
    });

    steps.push({
      id: 'waiting-relay',
      label: 'Waiting for Relay',
      description: 'Auto-relay in progress (~2-20 min)',
      status: getStepStatusFromOrder('waiting-relay', currentStep, stepOrder),
    });

    return steps;
  }, [currentStep, needsLockbox, txHashes]);
}

/**
 * Helper hook for Compound Solana bridge steps (ETH -> Solana with auto wPOKT conversion)
 */
export function useCompoundSolanaBridgeSteps(
  currentStep: CompoundSolanaBridgeStep,
  needsLockbox: boolean,
  txHashes: {
    wpoktApprove?: string;
    lockboxDeposit?: string;
    bridgeInitiate?: string;
    bridgeComplete?: string;
  }
): Step[] {
  return useMemo(() => {
    const steps: Step[] = [];

    const stepOrder: CompoundSolanaBridgeStep[] = needsLockbox
      ? ['approving-wpokt', 'converting-lockbox', 'initiating-bridge', 'waiting-vaa', 'completing']
      : ['initiating-bridge', 'waiting-vaa', 'completing'];

    if (needsLockbox) {
      steps.push({
        id: 'approving-wpokt',
        label: 'Approve wPOKT',
        description: 'Allow Lockbox to spend your wPOKT',
        status: getStepStatusFromOrder('approving-wpokt', currentStep, stepOrder),
        txHash: txHashes.wpoktApprove,
      });
      steps.push({
        id: 'converting-lockbox',
        label: 'Convert to xPOKT',
        description: 'Deposit wPOKT to Lockbox',
        status: getStepStatusFromOrder('converting-lockbox', currentStep, stepOrder),
        txHash: txHashes.lockboxDeposit,
      });
    }

    steps.push({
      id: 'initiating-bridge',
      label: 'Lock on Ethereum',
      description: 'Lock xPOKT in Wormhole Token Bridge',
      status: getStepStatusFromOrder('initiating-bridge', currentStep, stepOrder),
      txHash: txHashes.bridgeInitiate,
    });

    steps.push({
      id: 'waiting-vaa',
      label: 'Waiting for Guardians',
      description: 'Wormhole guardians signing attestation (~15-25 min)',
      status: getStepStatusFromOrder('waiting-vaa', currentStep, stepOrder),
    });

    steps.push({
      id: 'completing',
      label: 'Claim on Solana',
      description: 'Mint POKT SPL to your wallet',
      status: getStepStatusFromOrder('completing', currentStep, stepOrder),
      txHash: txHashes.bridgeComplete,
    });

    return steps;
  }, [currentStep, needsLockbox, txHashes]);
}

/**
 * Helper hook for Solana->ETH bridge steps (with optional post-claim Lockbox conversion)
 */
export function useSolanaToEthSteps(
  currentStep: UnifiedSolanaBridgeStep,
  destToken: 'wpokt' | 'xpokt',
  txHashes: {
    source?: string;
    destination?: string;
    conversion?: string;
  }
): Step[] {
  return useMemo(() => {
    const steps: Step[] = [
      {
        id: 'initiating',
        label: 'Burn on Solana',
        description: 'Burn POKT SPL tokens',
        status: getSolanaEthStepStatus('initiating', currentStep, destToken),
        txHash: txHashes.source,
      },
      {
        id: 'waiting-vaa',
        label: 'Waiting for Guardians',
        description: 'Wormhole guardians signing attestation (~15-25 min)',
        status: getSolanaEthStepStatus('waiting-vaa', currentStep, destToken),
      },
      {
        id: 'claiming',
        label: 'Claim on Ethereum',
        description: 'Unlock xPOKT on Ethereum',
        status: getSolanaEthStepStatus('claiming', currentStep, destToken),
        txHash: txHashes.destination,
      },
    ];

    if (destToken === 'wpokt') {
      steps.push({
        id: 'approving-lockbox',
        label: 'Approve Lockbox',
        description: 'Allow Lockbox to spend xPOKT',
        status: getSolanaEthStepStatus('approving-lockbox', currentStep, destToken),
      });
      steps.push({
        id: 'converting-lockbox',
        label: 'Convert to wPOKT',
        description: 'Withdraw wPOKT from Lockbox',
        status: getSolanaEthStepStatus('converting-lockbox', currentStep, destToken),
        txHash: txHashes.conversion,
      });
    }

    return steps;
  }, [currentStep, destToken, txHashes]);
}

/**
 * Helper hook for ETH->Solana bridge steps (simple, no Lockbox)
 */
export function useEthToSolanaSteps(
  currentStep: UnifiedSolanaBridgeStep,
  txHashes: {
    source?: string;
    destination?: string;
  }
): Step[] {
  return useMemo(() => {
    return [
      {
        id: 'initiating',
        label: 'Lock on Ethereum',
        description: 'Lock xPOKT in Wormhole Token Bridge',
        status: getSimpleStepStatus('initiating', currentStep),
        txHash: txHashes.source,
      },
      {
        id: 'waiting-vaa',
        label: 'Waiting for Guardians',
        description: 'Wormhole guardians signing attestation (~15-25 min)',
        status: getSimpleStepStatus('waiting-vaa', currentStep),
      },
      {
        id: 'claiming',
        label: 'Claim on Solana',
        description: 'Mint POKT SPL to your wallet',
        status: getSimpleStepStatus('claiming', currentStep),
        txHash: txHashes.destination,
      },
    ];
  }, [currentStep, txHashes]);
}

// ============================================================================
// Step Status Helpers
// ============================================================================

function getStepStatusFromOrder(
  stepId: string,
  currentStep: string,
  stepOrder: string[]
): StepStatus {
  const stepIndex = stepOrder.indexOf(stepId);
  const currentIndex = stepOrder.indexOf(currentStep);

  if (currentStep === 'error') {
    if (currentIndex >= 0 && stepIndex >= currentIndex) {
      return stepIndex === currentIndex ? 'error' : 'pending';
    }
    return 'complete';
  }
  if (currentStep === 'complete') return 'complete';
  if (currentStep === 'idle' || currentStep === 'checking-balances' || currentStep === 'quoting-fee' || currentStep === 'switching-chain') return 'pending';
  if (stepIndex < currentIndex) return 'complete';
  if (stepId === currentStep) return 'active';
  return 'pending';
}

function getSolanaEthStepStatus(
  stepId: string,
  currentStep: UnifiedSolanaBridgeStep,
  destToken: 'wpokt' | 'xpokt'
): StepStatus {
  const stepOrder: string[] = destToken === 'wpokt'
    ? ['initiating', 'waiting-vaa', 'claiming', 'approving-lockbox', 'converting-lockbox']
    : ['initiating', 'waiting-vaa', 'claiming'];

  const stepIndex = stepOrder.indexOf(stepId);
  const currentIndex = stepOrder.indexOf(currentStep);

  if (currentStep === 'error') {
    if (currentIndex >= 0 && stepIndex >= currentIndex) {
      return stepIndex === currentIndex ? 'error' : 'pending';
    }
    return 'complete';
  }
  if (currentStep === 'complete') return 'complete';
  if (currentStep === 'idle') return 'pending';
  if (stepIndex < currentIndex) return 'complete';
  if (stepId === currentStep) return 'active';
  return 'pending';
}

function getSimpleStepStatus(
  stepId: string,
  currentStep: UnifiedSolanaBridgeStep
): StepStatus {
  const stepOrder = ['initiating', 'waiting-vaa', 'claiming'];
  const stepIndex = stepOrder.indexOf(stepId);
  const currentIndex = stepOrder.indexOf(currentStep);

  if (currentStep === 'error') {
    if (currentIndex >= 0 && stepIndex >= currentIndex) {
      return stepIndex === currentIndex ? 'error' : 'pending';
    }
    return 'complete';
  }
  if (currentStep === 'complete') return 'complete';
  if (currentStep === 'idle') return 'pending';
  if (stepIndex < currentIndex) return 'complete';
  if (stepId === currentStep) return 'active';
  return 'pending';
}
