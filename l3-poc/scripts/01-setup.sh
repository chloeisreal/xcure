#!/bin/bash
# Cure L3 POC - Setup Script
# Prerequisites installer

set -e

echo "🏗️  Cure L3 POC - Environment Setup"
echo "===================================="

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop:"
    echo "   https://www.docker.com/products/docker-desktop/"
    exit 1
fi
echo "✅ Docker installed"

# Check for jq
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get install -y jq
    fi
fi
echo "✅ jq installed"

# Check for foundry (cast)
if ! command -v cast &> /dev/null; then
    echo "⚠️  Foundry not found. Installing..."
    curl -L https://foundry.paradigm.xyz | bash
    foundryup
fi
echo "✅ Foundry (cast) installed"

# Clone nitro-testnode if not exists
if [ ! -d "nitro-testnode" ]; then
    echo "📦 Cloning nitro-testnode..."
    git clone -b release --recurse-submodules https://github.com/OffchainLabs/nitro-testnode.git
    cd nitro-testnode
else
    echo "✅ nitro-testnode already exists"
    cd nitro-testnode
fi

# Create data directory
mkdir -p data

echo ""
echo "✅ Setup complete!"
echo ""
echo "NEXT STEPS:"
echo "1. Deploy Cure token: cd contracts && npm install && npm run deploy:sepolia"
echo "2. Start L3 chain: cd ../scripts && ./03-run-l3.sh"
echo ""
