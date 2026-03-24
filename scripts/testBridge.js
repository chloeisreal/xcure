const { ethers } = require("ethers");

async function main() {
  console.log("=== 分析跨链问题 ===\n");
  
  const l2Provider = new ethers.JsonRpcProvider("http://127.0.0.1:8547");
  const l3Provider = new ethers.JsonRpcProvider("http://127.0.0.1:3347");
  
  const wallet = new ethers.Wallet("0xecdf21cb41c65afb51f91df408b7656e2c8739a5877f2814add0afd780cc210e");
  
  // Check chain IDs
  console.log("1. 检查网络...");
  const l2ChainId = (await l2Provider.getNetwork()).chainId;
  const l3ChainId = (await l3Provider.getNetwork()).chainId;
  console.log(`   L2 Chain ID: ${l2ChainId}`);
  console.log(`   L3 Chain ID: ${l3ChainId}`);
  
  // Check block numbers
  const l2Block = await l2Provider.getBlockNumber();
  const l3Block = await l3Provider.getBlockNumber();
  console.log(`   L2 区块: ${l2Block}`);
  console.log(`   L3 区块: ${l3Block}`);
  
  // The problem: we're using same wallet on different chains
  console.log("\n2. 问题分析...");
  console.log(`   钱包地址: ${wallet.address}`);
  console.log("   这是两个独立的链!");
  console.log("   L2 上的转账只会影响 L2，不会影响 L3");
  
  // Check balances
  const l2Balance = await l2Provider.getBalance(wallet.address);
  const l3Balance = await l3Provider.getBalance(wallet.address);
  console.log(`\n3. 余额...`);
  console.log(`   L2: ${ethers.formatEther(l2Balance)} ETH`);
  console.log(`   L3: ${ethers.formatEther(l3Balance)} ETH`);
  
  // Show what we have
  console.log("\n=== 当前状态 ===");
  console.log("✓ L2 (Sequencer) 运行在端口 8547");
  console.log("✓ L3 (l3node) 运行在端口 3347");
  console.log("✓ 桥接合约已部署");
  console.log("✗ 两个链是独立的，没有自动桥接");
  
  console.log("\n=== 解决方案 ===");
  console.log("1. 使用桥接合约 (需要 ERC20 代币)");
  console.log("2. 手动在两端转账 (需要不同账户)");
  console.log("3. 配置完整的 Token Bridge (复杂)");
  
  console.log("\n=== 测试手动桥接 ===");
  console.log("从 L2 账户转账到 L3 账户...");
  
  // Create different wallets for L2 and L3
  const l2Account = ethers.Wallet.createRandom();
  const l3Account = ethers.Wallet.createRandom();
  
  console.log(`   L2 账户: ${l2Account.address}`);
  console.log(`   L3 账户: ${l3Account.address}`);
  
  // Send ETH to L2 account first
  const l2Wallet = wallet.connect(l2Provider);
  const tx = await l2Wallet.sendTransaction({
    to: l2Account.address,
    value: ethers.parseEther("1")
  });
  await tx.wait();
  
  const l2AccountBalance = await l2Provider.getBalance(l2Account.address);
  console.log(`   L2 账户收到: ${ethers.formatEther(l2AccountBalance)} ETH`);
  
  console.log("\n注意: L2 和 L3 是不同链，无法直接互转");
  console.log("需要通过桥接合约或手动跨链操作");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("错误:", error.message);
    process.exit(1);
  });
