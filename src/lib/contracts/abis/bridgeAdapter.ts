export const BRIDGE_ADAPTER_ABI = [
  // Main bridge function
  // NOTE: dstChainId is uint256 in the contract (internally cast to uint16 via SafeCast)
  {
    type: 'function',
    name: 'bridge',
    stateMutability: 'payable',
    inputs: [
      { name: 'dstChainId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
  },
  // Dynamic fee quoting — wraps wormholeRelayer.quoteEVMDeliveryPrice()
  {
    type: 'function',
    name: 'bridgeCost',
    stateMutability: 'view',
    inputs: [
      { name: 'targetChainId', type: 'uint16' },
    ],
    outputs: [
      { name: 'gasCost', type: 'uint256' },
    ],
  },
] as const;
