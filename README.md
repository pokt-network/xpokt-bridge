# xPOKT Bridge

The official multi-chain bridge for POKT tokens. Bridge POKT between Ethereum, Base, and Solana.

**🌐 Live at [bridge.pocket.network](https://bridge.pocket.network)**

## Overview

xPOKT Bridge is a frontend interface for bridging POKT tokens across supported chains. It leverages existing audited smart contracts—xERC20 (EIP-7281) token contracts and Wormhole's cross-chain messaging protocol—to enable secure token transfers.

All transactions execute client-side in the user's wallet. No private keys or privileged information are stored by this interface.

## Supported Routes

| Route | Bridge Method | Est. Time |
|-------|--------------|-----------|
| Ethereum ↔ Base | xPOKT Bridge Adapter | 2-20 min |
| Ethereum ↔ Solana | Wormhole Token Bridge | 15-25 min |

## Features

- **Unified POKT interface** — Users see "POKT" everywhere; wPOKT/xPOKT conversions are handled automatically
- **No WalletConnect** — Open-source wallet connections only via EIP-6963 (browser extension wallets)
- **Transaction resume** — Pending Solana bridges can be completed after VAA availability
- **Same-chain conversion** — Convert between wPOKT and xPOKT on Ethereum via the Lockbox

## Tech Stack

- **Framework:** Next.js 14
- **EVM Wallets:** wagmi v2 + viem
- **Solana Wallets:** @solana/wallet-adapter
- **Cross-chain:** @wormhole-foundation/sdk

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Contract Addresses

| Chain | Contract | Address |
|-------|----------|---------|
| Ethereum | wPOKT | `0x67F4C72a50f8Df6487720261E188F2abE83F57D7` |
| Ethereum | xPOKT | `0x764a726d9ced0433a8d7643335919deb03a9a935` |
| Ethereum | Lockbox | `0xd32f55975ceb7421129b0222438d9517051c3c8f` |
| Ethereum / Base | Bridge Adapter | `0x6c49e1ecfbe1ab0184ddf5f2200b58827293940f` |
| Base | xPOKT | `0x764a726d9ced0433a8d7643335919deb03a9a935` |
| Solana | POKT (SPL) | `6CAsXfiCXZfP8APCG6Vma2DFMindopxiqYQN4LSQfhoC` |

## Resources

- [Pocket Network](https://pocket.network)
- [Wormhole Docs](https://wormhole.com/docs)
- [Transaction Tracker (Wormholescan)](https://wormholescan.io)

## License

MIT
