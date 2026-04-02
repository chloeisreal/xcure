# 🧬 Cure L3 POC - Investor Demo

> **Ultra-minimal, zero-cost demonstration of custom Arbitrum Orbit L3 chain with native gas token**

This POC demonstrates the core "Cure" concept: a blockchain where transaction fees are paid in the project's native token (CURE), not ETH.

---

## 🎯 What We're Showing Investors

```
┌─────────────────────────────────────────────────────────────┐
│  "Connect wallet to Cure L3 → Send CURE → Gas deducted    │
│   in CURE, NOT ETH"                                        │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- ✅ Custom L3 chain running locally
- ✅ Native gas token (CURE) - fees paid in token, not ETH
- ✅ MetaMask integration
- ✅ Real-time transaction demonstration

---

## ⚡ Quick Start - Two Options

### Option A: Demo Mode (Recommended for First Try)
Uses default test token - fastest setup, works out of the box.

### Option B: Custom Cure Token (Your Contract)
Deploy your own CURE and use it as L3 gas token - more realistic demo.

---

## ⚡ Option A: Demo Mode (5 Minutes)

### Prerequisites
```bash
# Install Docker Desktop: https://www.docker.com/products/docker-desktop/
# Install jq: brew install jq (macOS) or apt-get install jq (Linux)
# Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup
```

### Step 1: Clone & Setup
```bash
cd l3-poc
chmod +x scripts/*.sh
./scripts/01-setup.sh
```

### Step 2: Start L3 Chain (Demo Mode)
```bash
./scripts/03-run-l3.sh --init --l3-fee-token
```

### Step 3: Add to MetaMask
| Field | Value |
|-------|-------|
| Network Name | **Cure L3 (Local)** |
| RPC URL | **http://127.0.0.1:3347** |
| Chain ID | **333333** |
| Currency Symbol | **CURE** |

---

## ⚡ Option B: Custom Cure Token (10 Minutes)

Use your own deployed CURE token as the L3 gas token.

### Step 1: Configure Environment
```bash
cp .env.example .env
# Edit .env with your test wallet private key
```

### Step 2: Start L2 First
```bash
cd nitro-testnode
./test-node.bash --init --detach
# Wait 60 seconds for L2 to start
```

### Step 3: Deploy Cure to L2
```bash
cd ../contracts
npm install
npx hardhat run scripts/deploy-cure.ts --network local
```

### Step 4: Get Cure Address
```bash
cat ../deployments/cure-sepolia.json
# Note the tokenAddress
```

### Step 5: Restart L3 with Your Cure
```bash
cd ../nitro-testnode
# The L3 will use the token deployed on L2 as fee token
./test-node.bash --init --l3node --l3-fee-token
```

### Step 6: Add to MetaMask
Same as Option A above.

---

## 🎬 Demo Script

### Before Demo Starts
- [ ] MetaMask installed with test account
- [ ] L3 chain running (`http://127.0.0.1:3347`)
- [ ] Dev account has CURE balance

### Demo Flow

**1. Show Standard Chain (ETH Gas)**
```
"This is how normal L2s work - you need ETH to pay gas"
```

**2. Show Cure L3 (Token Gas)**
```
"Switch to Cure L3..."
"Notice: No ETH balance needed!"
"Send CURE transfer..."
"Watch: Gas deducted in CURE, not ETH"
```

**3. Key Selling Point**
```
"Users don't need ETH to use the chain - they pay fees in CURE"
"This creates natural demand for the token"
```

---

## 📡 Network Endpoints

| Chain | RPC URL | Chain ID | Explorer |
|-------|---------|----------|----------|
| L1 (Geth dev) | http://localhost:8545 | 1337 | - |
| L2 (Nitro) | http://localhost:8547 | 412346 | - |
| **L3 (Cure)** | **http://localhost:3347** | **333333** | http://localhost:4000* |

*Blockscout available with `--blockscout` flag

---

## 🔑 Important Addresses

### Dev Account (Prefunded)
```
# Set these in your .env file:
# DEPLOYER_PRIVATE_KEY=your_private_key_here
# Demo Address: 0x3f1Eae7D46d88F08fc2F8ed27FCb2AB183EB2d0E (prefunded on local devnet)
```

### Chain Roles
| Role | Address |
|------|---------|
| Sequencer | 0xe2148eE53c0755215Df69b2616E552154EdC584f |
| Validator | 0x6A568afe0f82d34759347bb36F14A6bB171d2CBe |
| L2 Rollup Owner | 0x5E1497dD1f08C87b2d8FE23e9AAB6c1De833D927 |
| L3 Rollup Owner | 0x863c904166E801527125D8672442D736194A3362 |

---

## 🔧 Troubleshooting

### Docker not running
```bash
# Start Docker Desktop application
docker ps  # Verify
```

### Port already in use
```bash
# Check what's using the port
lsof -i :3347
# Kill existing process or modify nitro-testnode port config
```

### Node stuck on startup
```bash
# Clear data and restart
cd nitro-testnode
./test-node.bash --init
```

### MetaMask not connecting
```bash
# Check if node is running
curl http://127.0.0.1:3347

# Add chain manually in MetaMask
# Network: Cure L3
# RPC: http://127.0.0.1:3347
# Chain ID: 333333
```

---

## 🛠️ Advanced Usage

### Run with Blockscout Explorer
```bash
./test-node.bash --init --l3node --l3-fee-token --blockscout
# Explorer: http://localhost:4000
```

### Run Detached (Background)
```bash
./test-node.bash --init --l3node --l3-fee-token --detach
# Use docker-compose logs -f to monitor
```

### Send Transactions with Cast
```bash
# Send CURE from dev account (set DEPLOYER_PRIVATE_KEY in .env)
cast send <recipient> "transfer(address,uint256)" <amount> \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url http://127.0.0.1:3347
```

---

## 📁 Project Structure

```
l3-poc/
├── contracts/                 # Hardhat project - Cure token
│   ├── contracts/
│   │   └── CureToken.sol    # ERC20 with mint/burn
│   ├── hardhat.config.ts
│   └── scripts/
│       └── deploy-cure.ts   # Deploy to Sepolia
├── nitro-testnode/           # Git submodule - Arbitrum Nitro
├── scripts/
│   ├── 01-setup.sh          # Environment setup
│   ├── 02-deploy-cure.sh   # Deploy token
│   └── 03-run-l3.sh        # Start L3 chain
├── wagmi-config/
│   └── chains.ts            # Wagmi chain config
├── deployments/             # Deployed contract addresses
├── .env.example            # Environment template
└── README.md               # This file
```

---

## ⚠️ Important Notes

1. **ZERO real money** - This is testnet only
2. **Private keys are public** - Never use in production
3. **Local only** - Not connected to mainnet
4. **Demo purpose** - Not for production use

---

## 🔗 Resources

- [Arbitrum Docs](https://docs.arbitrum.io/)
- [nitro-testnode](https://github.com/OffchainLabs/nitro-testnode)
- [Arbitrum Orbit](https://arbitrum.io/launch-chain)

---

## 🚀 Next Steps (Production)

When ready to go production:

1. **Deploy L3 to cloud** (AWS/GCP + Nitro)
2. **Custom fee token bridge** (L2 → L3)
3. **Add validators** (decentralization)
4. **Mainnet deployment** (requires bonding)

For production Arbitrum Orbit chains, see: https://arbitrum.io/launch-chain

---

**Built with ❤️ for the Cure project**
