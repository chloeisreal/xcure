#!/bin/bash
# Deploy L3 Rollup to Arbitrum Sepolia using Cast

# Configuration
RPC_URL="https://arb-sepolia.g.alchemy.com/v2/zx7BMikiG5OzteHcbrIPW"
PRIVATE_KEY="e9d61d1a9f2d792a869072645f0cbf2f298a2e97bf37cdce8f1e00f29fcfa00e"
CHAIN_ID="281003"

# RollupCreator address on Arbitrum Sepolia
ROLLUP_CREATOR="0x0F7f71c48c6278422736a4a9441cd1d59ba0C2dB"

echo "=== L3 Rollup Deployment ==="
echo "Chain ID: $CHAIN_ID"
echo "RPC: $RPC_URL"

# Get deployer address
DEPLOYER=$(cast compute-address $PRIVATE_KEY | grep "0x" | head -1)
echo "Deployer: $DEPLOYER"

# Check balance
echo ""
echo "=== Checking Balance ==="
cast balance $DEPLOYER --rpc-url $RPC_URL

# Get nonce
echo ""
echo "=== Nonce ==="
cast nonce $DEPLOYER --rpc-url $RPC_URL

# Check RollupCreator
echo ""
echo "=== Checking RollupCreator ==="
cast call $ROLLUP_CREATOR "owner()" --rpc-url $RPC_URL

echo ""
echo "Note: Direct deployment via RollupCreator requires the correct function signature and parameters."
echo "Please use the Orbit Deployment Portal at https://orbit.arbitrum.io/"
echo "Or try RaaS services like Caldera (https://caldera.xyz/)"