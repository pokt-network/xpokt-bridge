export const XPOKT_ABI = [
  {
    type: 'function',
    name: 'mintingMaxLimitOf',
    stateMutability: 'view',
    inputs: [{ name: '_bridge', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'burningMaxLimitOf',
    stateMutability: 'view',
    inputs: [{ name: '_bridge', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'mintingCurrentLimitOf',
    stateMutability: 'view',
    inputs: [{ name: '_bridge', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'burningCurrentLimitOf',
    stateMutability: 'view',
    inputs: [{ name: '_bridge', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'lockbox',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;
