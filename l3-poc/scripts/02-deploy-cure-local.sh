#!/bin/bash
# Cure L3 POC - Deploy Cure Token to Local L2 (Nitro) and Configure as L3 Fee Token
set -e

echo "🎯 Deploying Cure Token as L3 Native Gas Token"
echo "================================================"

# Navigate to contracts
cd contracts

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

# Compile contracts
echo "🔨 Compiling contracts..."
npx hardhat compile

# First, we need to start the L2 node to deploy Cure
echo ""
echo "📝 First, start the L2 node in background:"
echo "   cd ../nitro-testnode && ./test-node.bash --init --detach"
echo ""
echo "   Wait for L2 to start (30-60 seconds), then run this script again."
echo ""

# Check if L2 is running
if curl -s http://127.0.0.1:8547 > /dev/null 2>&1; then
    echo "✅ L2 node is running!"
    
    echo ""
    echo "📤 Deploying CureToken to local L2..."
    
    # Deploy to local L2 (not Sepolia)
    npx hardhat run scripts/deploy-cure.ts --network local
    
    # Get the deployment info
    DEPLOYMENT="../deployments/cure-sepolia.json"
    if [ -f "$DEPLOYMENT" ]; then
        TOKEN_ADDRESS=$(cat $DEPLOYMENT | jq -r '.tokenAddress')
        echo ""
        echo "✅ Cure deployed at: $TOKEN_ADDRESS"
        echo ""
        echo "🔧 To use this as L3 fee token, run:"
        echo "   cd ../nitro-testnode"
        echo "   ./test-node.bash --init --l3node --l3-fee-token --l3-fee-token-address $TOKEN_ADDRESS"
    fi
else
    echo "❌ L2 node not running. Start it first with:"
    echo "   cd ../nitro-testnode && ./test-node.bash --init --detach"
    exit 1
fi
