'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Wormholescan operations API response shape (relevant fields only)
 */
interface WormholeOperation {
  id: string;
  sourceChain?: {
    status: string;
    transaction?: { txHash: string };
  };
  targetChain?: {
    chainId: number;
    status: string;
    transaction?: { txHash: string };
    timestamp?: string;
  };
}

interface WormholeOperationsResponse {
  operations: WormholeOperation[];
}

export type RelayStatus = 'idle' | 'polling' | 'delivered' | 'error';

interface RelayPollerState {
  status: RelayStatus;
  targetTxHash: string | null;
  deliveredAt: string | null;
  error: string | null;
}

const WORMHOLESCAN_API = 'https://api.wormholescan.io/api/v1';
const POLL_INTERVAL_MS = 15_000; // 15 seconds
const MAX_POLL_DURATION_MS = 45 * 60 * 1000; // 45 minutes max

/**
 * Polls the Wormholescan operations API for relay delivery completion.
 *
 * Usage:
 *   const { status, targetTxHash } = useRelayPoller(bridgeTxHash);
 *   // status transitions: idle -> polling -> delivered
 *
 * @param sourceTxHash  The bridge transaction hash on the source chain (or null to stay idle)
 * @param onDelivered   Optional callback fired once when delivery is confirmed
 */
export function useRelayPoller(
  sourceTxHash: string | null | undefined,
  onDelivered?: (targetTxHash: string) => void
) {
  const [state, setState] = useState<RelayPollerState>({
    status: 'idle',
    targetTxHash: null,
    deliveredAt: null,
    error: null,
  });

  // Track whether we've already fired the callback
  const deliveredRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  // Store onDelivered in a ref to avoid re-creating checkDelivery (and
  // therefore re-triggering the polling useEffect) every time the caller
  // passes a new inline function reference.
  const onDeliveredRef = useRef(onDelivered);
  onDeliveredRef.current = onDelivered;

  const checkDelivery = useCallback(async (txHash: string): Promise<boolean> => {
    try {
      const url = `${WORMHOLESCAN_API}/operations?txHash=${txHash}&page=0&pageSize=1`;
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`[RelayPoller] API returned ${response.status}`);
        return false;
      }

      const data: WormholeOperationsResponse = await response.json();

      if (!data.operations || data.operations.length === 0) {
        console.log('[RelayPoller] No operation found yet');
        return false;
      }

      const op = data.operations[0];

      if (op.targetChain?.status === 'completed' && op.targetChain.transaction?.txHash) {
        const targetHash = op.targetChain.transaction.txHash;
        const deliveredAt = op.targetChain.timestamp || null;

        console.log(`[RelayPoller] Delivery confirmed! Target tx: ${targetHash}`);

        setState({
          status: 'delivered',
          targetTxHash: targetHash,
          deliveredAt,
          error: null,
        });

        if (!deliveredRef.current) {
          deliveredRef.current = true;
          onDeliveredRef.current?.(targetHash);
        }

        return true;
      }

      console.log('[RelayPoller] Not yet delivered. Source status:', op.sourceChain?.status);
      return false;
    } catch (err: any) {
      console.warn('[RelayPoller] Fetch error:', err.message);
      return false;
    }
  }, []); // No dependencies — onDelivered accessed via stable ref

  useEffect(() => {
    // Reset when txHash changes
    deliveredRef.current = false;

    if (!sourceTxHash) {
      setState({ status: 'idle', targetTxHash: null, deliveredAt: null, error: null });
      return;
    }

    setState(prev => ({ ...prev, status: 'polling', error: null }));
    startTimeRef.current = Date.now();

    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;

      // Check timeout
      if (Date.now() - startTimeRef.current > MAX_POLL_DURATION_MS) {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'Relay polling timed out. The relay may still complete — check Wormholescan.',
        }));
        return;
      }

      const delivered = await checkDelivery(sourceTxHash!);

      if (!delivered && !cancelled) {
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    // Start polling immediately
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [sourceTxHash, checkDelivery]);

  const reset = useCallback(() => {
    deliveredRef.current = false;
    setState({ status: 'idle', targetTxHash: null, deliveredAt: null, error: null });
  }, []);

  return {
    ...state,
    isPolling: state.status === 'polling',
    isDelivered: state.status === 'delivered',
    reset,
  };
}
