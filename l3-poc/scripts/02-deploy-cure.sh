#!/bin/bash
# Cure L3 POC - Deploy Cure Token to Arbitrum Sepolia
set -e

echo "🚀 Deploying Cure Token to Arbitrum Sepolia"
echo "============================================"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Copy .env.example and fill in your values."
    echo "   Required: ARBITRUM_SEPOLIA_RPC and DEPLOYER_PRIVATE_KEY"
    exit 1
fi

# Source environment variables
source .env

# Check for required variables
if [ -z "$ARBITRUM_SEPOLIA_RPC" ] || [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
    echo "❌ Missing required environment variables!"
    echo "   Please set ARBITRUM_SEPOLIA_RPC and DEPLOYER_PRIVATE_KEY in .env"
    exit 1
fi

# Navigate to contracts directory
cd contracts

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

# Compile contracts
echo "🔨 Compiling contracts..."
npx hardhat compile

# Deploy
echo "📤 Deploying CureToken..."
npx hardhat run scripts/deploy-cure.ts --network arbitrumSepolia

echo ""
echo "✅ Deployment complete!"
echo ""
