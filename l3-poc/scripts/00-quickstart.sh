#!/bin/bash
# Cure L3 POC - One-command quickstart (after env is configured)
# Usage: ./scripts/00-quickstart.sh

set -e

echo "🧬 Cure L3 POC - Quick Start"
echo "============================"

# Check for .env
if [ ! -f ".env" ]; then
    echo "❌ .env not found. Run: cp .env.example .env"
    exit 1
fi

# Source env
source .env

# Check for nitro-testnode
if [ ! -d "nitro-testnode" ]; then
    echo "📦 Cloning nitro-testnode..."
    git clone -b release --recurse-submodules https://github.com/OffchainLabs/nitro-testnode.git
fi

# Check for contracts
if [ ! -d "contracts/node_modules" ]; then
    echo "📦 Installing contract dependencies..."
    cd contracts
    npm install
    cd ..
fi

# Check for Cure deployment
DEPLOYMENT_FILE="deployments/cure-sepolia.json"
if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "⚠️  Cure not deployed yet. Deploying..."
    cd contracts
    npx hardhat run scripts/deploy-cure.ts --network arbitrumSepolia
    cd ..
fi

# Start L3
echo "🚀 Starting L3 chain..."
cd nitro-testnode
./test-node.bash --init --l3node --l3-fee-token
