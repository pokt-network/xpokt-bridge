import type { Chain } from './bridge';

export type TxStatus =
  | 'idle'
  | 'pending'
  | 'confirmed'
  | 'waiting-vaa'
  | 'vaa-ready'
  | 'claiming'
  | 'converting'
  | 'complete'
  | 'error';

export interface StoredTransaction {
  id: string;
  sourceChain: Chain;
  destChain: Chain;
  amount: string;
  amountRaw: string;
  status: TxStatus;
  createdAt: number;
  updatedAt: number;
  sourceTxHash: string;
  destToken?: 'wpokt' | 'xpokt';
  preConversion?: {
    required: boolean;
    wpoktApproveTxHash?: string;
    lockboxDepositTxHash?: string;
  };
  wormhole?: {
    emitterChain: number;
    emitterAddress: string;
    sequence: string;
    vaaBytes?: string;
  };
  destTxHash?: string;
  conversionTxHash?: string;
  // Wallet address that initiated this transaction — for ownership verification
  // Ensures resumed transactions can't be hijacked by localStorage tampering
  initiatorAddress?: string;
}

export interface PendingTransaction {
  hash: string;
  type: 'evm-bridge' | 'solana-bridge' | 'lockbox';
  status: TxStatus;
  sourceChain: Chain;
  destChain: Chain;
  amount: string;
  timestamp: number;
}
