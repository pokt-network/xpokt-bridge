export const WORMHOLE_TOKEN_BRIDGE_ABI = [
  {
    type: 'function',
    name: 'transferTokens',
    stateMutability: 'payable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'recipientChain', type: 'uint16' },
      { name: 'recipient', type: 'bytes32' },
      { name: 'arbiterFee', type: 'uint256' },
      { name: 'nonce', type: 'uint32' },
    ],
    outputs: [{ name: 'sequence', type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'completeTransfer',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'encodedVm', type: 'bytes' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'wrappedAsset',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenChainId', type: 'uint16' },
      { name: 'tokenAddress', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;
