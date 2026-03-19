#!/bin/bash
# Cure L3 POC - Start Local L3 Chain with Custom Fee Token
set -e

echo "🏁 Starting Cure L3 Chain"
echo "========================"

# Check if nitro-testnode exists
if [ ! -d "nitro-testnode" ]; then
    echo "❌ nitro-testnode not found. Run 01-setup.sh first."
    exit 1
fi

cd nitro-testnode

# Parse command line arguments
INIT=false
L3_FEE_TOKEN=false
DETACH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --init)
            INIT=true
            shift
            ;;
        --l3-fee-token)
            L3_FEE_TOKEN=true
            shift
            ;;
        --detach)
            DETACH=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Build command
CMD="./test-node.bash"

if [ "$INIT" = true ]; then
    CMD="$CMD --init"
fi

# Always add L3 node
CMD="$CMD --l3node"

# Add custom fee token (demo mode uses default token)
if [ "$L3_FEE_TOKEN" = true ]; then
    CMD="$CMD --l3-fee-token"
fi

# Add detach if requested
if [ "$DETACH" = true ]; then
    CMD="$CMD --detach"
fi

echo "📋 Command: $CMD"
echo ""

# Run the node
echo "🚀 Starting nodes (this may take a few minutes on first run)..."
eval $CMD

# Show info after startup
if [ "$DETACH" = false ]; then
    echo ""
    echo "📡 Chain Endpoints:"
    echo "   L1 (Geth):      http://localhost:8545 (Chain ID: 1337)"
    echo "   L2 (Nitro):     http://localhost:8547 (Chain ID: 412346)"
    echo "   L3 (Cure):      http://localhost:3347 (Chain ID: 333333)"
    echo ""
    echo "👤 Dev Account:"
    echo "   Address: 0x3f1Eae7D46d88F08fc2F8ed27FCb2AB183EB2d0E"
    echo "   Private: 0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659"
    echo ""
    echo "🔗 Add to MetaMask:"
    echo "   Network Name: Cure L3 (Local)"
    echo "   RPC URL: http://127.0.0.1:3347"
    echo "   Chain ID: 333333"
    echo "   Currency: CURE"
fi
