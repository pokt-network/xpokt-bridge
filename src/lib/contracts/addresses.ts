export const CONTRACTS = {
  ethereum: {
    chainId: 1,
    wormholeChainId: 2,
    wPOKT: '0x67F4C72a50f8Df6487720261E188F2abE83F57D7' as const,
    xPOKT: '0x764a726d9ced0433a8d7643335919deb03a9a935' as const,
    lockbox: '0xd32f55975ceb7421129b0222438d9517051c3c8f' as const,
    bridgeAdapter: '0x6c49e1ecfbe1ab0184ddf5f2200b58827293940f' as const,
    wormholeTokenBridge: '0x3ee18B2214AFF97000D974cf647E7C347E8fa585' as const,
    wormholeCoreBridge: '0x98f3c9e6E3fACe36bAAd05FE09d375Ef1464288B' as const,
    wormholeRelayer: '0x27428DD2d3DD32A4D7f7C497eAaa23130d894911' as const,
  },
  base: {
    chainId: 8453,
    wormholeChainId: 30,
    xPOKT: '0x764a726d9ced0433a8d7643335919deb03a9a935' as const,
    bridgeAdapter: '0x6c49e1ecfbe1ab0184ddf5f2200b58827293940f' as const,
    wormholeRelayer: '0x706f82e9bb5b0813501714ab5974216704980e31' as const,
  },
  solana: {
    wormholeChainId: 1,
    poktMint: '6CAsXfiCXZfP8APCG6Vma2DFMindopxiqYQN4LSQfhoC' as const,
    wormholeTokenBridge: 'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb' as const,
    wormholeCoreBridge: 'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth' as const,
  },
} as const;

export const WORMHOLE_CHAIN_IDS = {
  Solana: 1,
  Ethereum: 2,
  Base: 30,
} as const;

export const TESTNET_ADDRESSES = {
  sepolia: {
    chainId: 11155111,
    wormholeChainId: 10002,
    wPOKT: '0x50AcB08D20d91B08A443b762cE8Ab50ad00a0635',
    xPOKT: '0xf751E222C75462342748Dd68b3463a14C1E23555',
    lockbox: '0xA4e8d8A848b51F3464B3E55d3eD329E4C19631b9',
    bridgeAdapter: '0x48B02a246861Abb10166D383787689793b1A51a6',
  },
  baseSepolia: {
    chainId: 84532,
    wormholeChainId: 10004,
    xPOKT: '0xf751E222C75462342748Dd68b3463a14C1E23555',
    bridgeAdapter: '0x48B02a246861Abb10166D383787689793b1A51a6',
  },
} as const;
