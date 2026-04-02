#!/bin/bash
# Cure L3 POC - Complete Setup Script
# Handles both Demo Mode and Custom Token Mode

set -e

MODE=${1:-demo}  # demo | custom

echo "🧬 Cure L3 POC - Complete Setup"
echo "================================"
echo "Mode: $MODE"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Install from https://docker.com"
    exit 1
fi
echo "✅ Docker ready"

# Check jq
if ! command -v jq &> /dev/null; then
    echo "Installing jq..."
    if [[ "$OSTYPE" == "darwin"* ]]; then brew install jq; fi
fi
echo "✅ jq ready"

# Check nitro-testnode
if [ ! -d "nitro-testnode" ]; then
    echo "📦 Cloning nitro-testnode..."
    git clone -b release --recurse-submodules https://github.com/OffchainLabs/nitro-testnode.git
fi
cd nitro-testnode

if [ "$MODE" = "demo" ]; then
    echo ""
    echo "🎯 Running in DEMO MODE (default token)"
    echo "========================================"
    
    # Start with default fee token
    ./test-node.bash --init --l3node --l3-fee-token

elif [ "$MODE" = "custom" ]; then
    echo ""
    echo "🎯 Running in CUSTOM MODE (your Cure token)"
    echo "============================================"
    
    # Step 1: Start L2 only (detached)
    echo "📝 Step 1: Starting L2 node..."
    ./test-node.bash --init --detach
    echo "⏳ Waiting for L2 to start (60s)..."
    sleep 60
    
    # Step 2: Deploy Cure to L2
    echo "📝 Step 2: Deploying Cure to L2..."
    cd ../contracts
    
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    npx hardhat compile 2>/dev/null || true
    npx hardhat run scripts/deploy-cure.js --network local
    
    # Get token address
    TOKEN_ADDR=$(cat ../deployments/cure-local.json | jq -r '.tokenAddress')
    echo "✅ Cure deployed at: $TOKEN_ADDR"
    
    # Step 3: Start L3 with custom token
    echo "📝 Step 3: Starting L3 with Cure as fee token..."
    cd ../nitro-testnode
    
    # Note: nitro-testnode will automatically use the token deployed on L2
    # as the fee token when --l3-fee-token is used with local deployment
    ./test-node.bash --init --l3node --l3-fee-token

else
    echo "❌ Unknown mode: $MODE"
    echo "Usage: $0 [demo|custom]"
    exit 1
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📡 Endpoints:"
echo "   L2: http://127.0.0.1:8547 (Chain ID: 412346)"
echo "   L3: http://127.0.0.1:3347 (Chain ID: 333333)"
echo ""
echo "👤 Dev Account:"
echo "   Address: Set in .env DEPLOYER_PRIVATE_KEY to see address"
echo "   Private: Do NOT expose - set in .env file"
echo ""
echo "🔗 Add to MetaMask:"
echo "   Network: Cure L3 (Local)"
echo "   RPC: http://127.0.0.1:3347"
echo "   Chain ID: 333333"
