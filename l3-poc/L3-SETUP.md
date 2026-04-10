# xCure L3 Deployment Guide

## Current Configuration

### Chain Info
- **Chain ID**: 412346 (0x64aba)
- **RPC**: http://127.0.0.1:8449
- **Parent Chain**: Arbitrum Sepolia (421614)

### Contract Addresses

#### L2 (Arbitrum Sepolia)
| Contract | Address |
|----------|---------|
| Token Bridge | `0xF71C64F37A8AdA918b1fD7C7d9e3FC5aC6C813Ce` |
| MockCURE | `0xf4d76f449E66c714105928f24bc9fD59692B1157` |

#### L3 (xCure Network)
| Contract | Address |
|----------|---------|
| Token Bridge | `0x3B298e17897548aEB02F52e6761ec578D195A21b` |
| CureToken | `0x2c45C5b9C2bcBD8Ed93FF2f6b1B562C5619FC937` |

## Running L3

### Start L3 Node
```bash
docker run -d --name xcure-nitro \
  -p 127.0.0.1:8449:8449 \
  offchainlabs/nitro-node:v3.2.1-d81324d \
  --dev \
  --init.dev-init \
  --init.dev-init-address <DEPLOYER_ADDRESS> \
  --http.port 8449 \
  --http.addr 0.0.0.0
```

### Check Status
```bash
# Chain ID
curl -X POST http://127.0.0.1:8449 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

# Block Number
curl -X POST http://127.0.0.1:8449 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Wallet Import (MetaMask)

| Field | Value |
|-------|-------|
| Network Name | xCure Network |
| RPC URL | http://127.0.0.1:8449 |
| Chain ID | 412346 |
| Symbol | ETH |

## Environment Variables

Create `/l3-poc/contracts/.env`:

```bash
# Your private key (NEVER commit to git)
DEPLOYER_PRIVATE_KEY=your_private_key_here
DEPLOYER_ADDRESS=your_address_here
ARBITRUM_SEPOLIA_RPC=https://arb-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
L3_RPC=http://127.0.0.1:8449
L3_CHAIN_ID=412346
```

## Deployment Scripts

After setting up `.env`, run these scripts:

```bash
cd l3-poc/contracts

# 1. Deploy CureToken to L3
npx hardhat run scripts/deployCure.ts --network xCureL3

# 2. Deploy L3TokenBridge
npx hardhat run scripts/deployL3Bridge.ts --network xCureL3

# 3. Deploy L2TokenBridge (on Arbitrum Sepolia)
npx hardhat run scripts/deployL2Bridge.ts --network arbitrumSepolia
```

## Troubleshooting

### "the chain ID used by this RPC is 412346"
Make sure MetaMask chain ID matches 412346.

### Blockscout not working
Blockscout requires full Nitro testnode. Use curl instead:
```bash
curl -X POST http://127.0.0.1:8449 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest", true],"id":1}'
```