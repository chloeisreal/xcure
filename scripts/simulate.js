/**
 * scripts/simulate.js
 *
 * Simulates realistic trading activity on XCure Arbitrum Sepolia contracts.
 * Creates multiple wallets, funds them, and executes swaps + meme buys/sells.
 *
 * Usage:
 *   npx hardhat run scripts/simulate.js --network arbitrumSepolia
 *
 * Requirements:
 *   - DEPLOYER_PRIVATE_KEY in .env with enough ETH to fund simulation wallets
 *   - At least 0.05 ETH in deployer wallet
 */

const hre = require("hardhat");
const { ethers } = hre;

// ── Contract Addresses (Arbitrum Sepolia) ─────────────────
const ADDRESSES = {
  MockCURE:    "0xf4d76f449E66c714105928f24bc9fD59692B1157",
  MockBAO:     "0xcA8467C9a2d546B1A9Dc0AC8F668d2716D343730",
  MockWETH:    "0xd23ad7d69d892f2ccABFF2E78cb2e46751B49295",
  SwapCUREBAO: "0xDF0FB1782e6388845d78B318ee7460778342C7FA",
  SwapBAOWETH: "0x3f4C141153B1994bcb72D22d37a8073f58981Ad6",
  MemeFactory: "0x432208DF6e2219951D4FcA6716B7b6A8b032f4d2",
};

// ── ABIs (minimal) ─────────────────────────────────────────
const ERC20_ABI = [
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
];

const SWAP_ABI = [
  "function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut) external",
  "function reserveA() view returns (uint256)",
  "function reserveB() view returns (uint256)",
  "function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) view returns (uint256)",
  "function tokenA() view returns (address)",
  "function tokenB() view returns (address)",
];

const FACTORY_ABI = [
  "function createToken(string name, string symbol) external returns (address)",
  "function allTokensLength() view returns (uint256)",
  "function getTokens(uint256 offset, uint256 limit) view returns (address[])",
];

const MEME_ABI = [
  "function buy(uint256 cureAmount, uint256 minTokens) external",
  "function sell(uint256 tokenAmount, uint256 minCure) external",
  "function getTokensForCure(uint256 cureAmount) view returns (uint256)",
  "function cureRaised() view returns (uint256)",
  "function graduated() view returns (bool)",
  "function name() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
];

// ── Helpers ────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function decodeRevertReason(error) {
  if (error.reason) return error.reason;
  if (error.revert?.args?.[0]) return String(error.revert.args[0]);

  const data = error.data ?? error.error?.data;
  if (data && typeof data === "string") {
    if (data.startsWith("0x08c379a0")) {
      try {
        const [msg] = ethers.AbiCoder.defaultAbiCoder().decode(
          ["string"], "0x" + data.slice(10)
        );
        return msg;
      } catch {}
    }
    if (data.startsWith("0x4e487b71")) {
      try {
        const [code] = ethers.AbiCoder.defaultAbiCoder().decode(
          ["uint256"], "0x" + data.slice(10)
        );
        return `Panic(${code})`;
      } catch {}
    }
    return `raw revert data: ${data}`;
  }
  return error.message;
}

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randAmount(minEther, maxEther) {
  const val = minEther + Math.random() * (maxEther - minEther);
  return ethers.parseEther(val.toFixed(4));
}

async function getFees(provider) {
  const feeData = await provider.getFeeData();
  return {
    maxFeePerGas: feeData.maxFeePerGas * 2n,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n,
  };
}

async function fundWallet(deployer, wallet, ethAmount) {
  const fees = await getFees(deployer.provider);
  const tx = await deployer.sendTransaction({
    to: wallet.address,
    value: ethAmount,
    ...fees,
  });
  await tx.wait();
  console.log(`  💰 Funded ${wallet.address.slice(0,10)}… with ${ethers.formatEther(ethAmount)} ETH`);
}

async function mintTokens(deployer, token, to, amount, name) {
  const fees = await getFees(deployer.provider);
  const contract = new ethers.Contract(token, ERC20_ABI, deployer);
  const tx = await contract.mint(to, amount, { ...fees });
  await tx.wait();
  console.log(`  🪙  Minted ${ethers.formatUnits(amount, 18)} ${name} → ${to.slice(0,10)}…`);
}

// ── Main Simulation ────────────────────────────────────────
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n🚀 XCure Testnet Activity Simulator");
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Network:  ${hre.network.name}\n`);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`   ETH Balance: ${ethers.formatEther(balance)} ETH`);
  if (balance < ethers.parseEther("0.007")) {
    throw new Error("Deployer needs at least 0.007 ETH on Arbitrum Sepolia");
  }

  // Per-wallet tx counter for summary
  const txCount = new Map(); // address → count

  // ── 1. Create simulation wallets ──────────────────────────
  const NUM_WALLETS = 2;
  console.log(`\n📦 [1/7] Creating ${NUM_WALLETS} simulation wallets...`);
  const wallets = Array.from({ length: NUM_WALLETS }, () =>
    ethers.Wallet.createRandom().connect(deployer.provider)
  );
  for (const w of wallets) txCount.set(w.address, 0);
  console.log(`   Addresses: ${wallets.map(w => w.address.slice(0,10)+"…").join(", ")}\n`);

  // Fund each wallet with ETH for gas
  console.log("   Funding wallets with ETH for gas...");
  for (const w of wallets) {
    await fundWallet(deployer, w, ethers.parseEther("0.002"));
    await sleep(1500);
  }

  // ── 2. Mint tokens to simulation wallets ──────────────────
  console.log("\n🪙  [2/7] Minting tokens to wallets...\n");
  for (const w of wallets) {
    await mintTokens(deployer, ADDRESSES.MockCURE, w.address, ethers.parseEther("5000"), "CURE");
    await sleep(1000);
    await mintTokens(deployer, ADDRESSES.MockBAO,  w.address, ethers.parseEther("3000"), "BAO");
    await sleep(1000);
    await mintTokens(deployer, ADDRESSES.MockWETH, w.address, ethers.parseEther("1"),    "WETH");
    await sleep(1000);
  }

  // ── 3. CURE ↔ BAO Swaps ───────────────────────────────────
  console.log("\n🔄 [3/7] Simulating CURE ↔ BAO swaps (3 rounds × 4 wallets)...\n");
  const swapCUREBAO = new ethers.Contract(ADDRESSES.SwapCUREBAO, SWAP_ABI, deployer);

  for (let round = 0; round < 3; round++) {
    console.log(`   Round ${round + 1}/3`);
    for (const wallet of wallets) {
      const w = wallet.connect(deployer.provider);
      const cure = new ethers.Contract(ADDRESSES.MockCURE, ERC20_ABI, w);
      const bao  = new ethers.Contract(ADDRESSES.MockBAO,  ERC20_ABI, w);
      const swap = new ethers.Contract(ADDRESSES.SwapCUREBAO, SWAP_ABI, w);
      const fees = await getFees(deployer.provider);

      const buyBAO = Math.random() > 0.5;
      const amountIn = randAmount(10, 80);

      if (buyBAO) {
        const rA = await swapCUREBAO.reserveA();
        const rB = await swapCUREBAO.reserveB();
        const tokenA = await swapCUREBAO.tokenA();
        const [rIn, rOut] = tokenA.toLowerCase() === ADDRESSES.MockCURE.toLowerCase()
          ? [rA, rB] : [rB, rA];
        const amountOut = await swapCUREBAO.getAmountOut(amountIn, rIn, rOut);
        const minOut = amountOut * 95n / 100n;

        console.log(`     ${w.address.slice(0,10)}… approving ${ethers.formatUnits(amountIn,18).slice(0,6)} CURE…`);
        await (await cure.approve(ADDRESSES.SwapCUREBAO, amountIn, { ...fees })).wait();
        console.log(`     ${w.address.slice(0,10)}… swapping CURE → BAO…`);
        const tx = await swap.swap(ADDRESSES.MockCURE, amountIn, minOut, { ...fees });
        await tx.wait();
        txCount.set(w.address, txCount.get(w.address) + 1);
        console.log(`  ↔️  ${w.address.slice(0,10)}… swapped ${ethers.formatUnits(amountIn,18).slice(0,6)} CURE → BAO ✓`);
      } else {
        const rA = await swapCUREBAO.reserveA();
        const rB = await swapCUREBAO.reserveB();
        const tokenA = await swapCUREBAO.tokenA();
        const [rIn, rOut] = tokenA.toLowerCase() === ADDRESSES.MockBAO.toLowerCase()
          ? [rA, rB] : [rB, rA];
        const amountOut = await swapCUREBAO.getAmountOut(amountIn, rIn, rOut);
        const minOut = amountOut * 95n / 100n;

        console.log(`     ${w.address.slice(0,10)}… approving ${ethers.formatUnits(amountIn,18).slice(0,6)} BAO…`);
        await (await bao.approve(ADDRESSES.SwapCUREBAO, amountIn, { ...fees })).wait();
        console.log(`     ${w.address.slice(0,10)}… swapping BAO → CURE…`);
        const tx = await swap.swap(ADDRESSES.MockBAO, amountIn, minOut, { ...fees });
        await tx.wait();
        txCount.set(w.address, txCount.get(w.address) + 1);
        console.log(`  ↔️  ${w.address.slice(0,10)}… swapped ${ethers.formatUnits(amountIn,18).slice(0,6)} BAO → CURE ✓`);
      }

      await sleep(randBetween(1500, 3000));
    }
  }

  // ── 4. BAO ↔ WETH Swaps ───────────────────────────────────
  console.log("\n🔄 [4/7] Simulating BAO ↔ WETH swaps (2 rounds × 2 wallets)...\n");
  const swapBAOWETH = new ethers.Contract(ADDRESSES.SwapBAOWETH, SWAP_ABI, deployer);

  for (let round = 0; round < 2; round++) {
    console.log(`   Round ${round + 1}/2`);
    for (const wallet of wallets.slice(0, 2)) {
      const w = wallet.connect(deployer.provider);
      const bao  = new ethers.Contract(ADDRESSES.MockBAO,  ERC20_ABI, w);
      const weth = new ethers.Contract(ADDRESSES.MockWETH, ERC20_ABI, w);
      const swap = new ethers.Contract(ADDRESSES.SwapBAOWETH, SWAP_ABI, w);
      const fees = await getFees(deployer.provider);

      const buyWETH = Math.random() > 0.5;
      const amountIn = buyWETH
        ? randAmount(20, 100)
        : ethers.parseEther((Math.random() * 0.02 + 0.005).toFixed(4));

      if (buyWETH) {
        const rA = await swapBAOWETH.reserveA();
        const rB = await swapBAOWETH.reserveB();
        const tokenA = await swapBAOWETH.tokenA();
        const [rIn, rOut] = tokenA.toLowerCase() === ADDRESSES.MockBAO.toLowerCase()
          ? [rA, rB] : [rB, rA];
        const amountOut = await swapBAOWETH.getAmountOut(amountIn, rIn, rOut);
        const minOut = amountOut * 95n / 100n;

        console.log(`     ${w.address.slice(0,10)}… approving ${ethers.formatUnits(amountIn,18).slice(0,6)} BAO…`);
        await (await bao.approve(ADDRESSES.SwapBAOWETH, amountIn, { ...fees })).wait();
        console.log(`     ${w.address.slice(0,10)}… swapping BAO → WETH…`);
        const tx = await swap.swap(ADDRESSES.MockBAO, amountIn, minOut, { ...fees });
        await tx.wait();
        txCount.set(w.address, txCount.get(w.address) + 1);
        console.log(`  ↔️  ${w.address.slice(0,10)}… swapped ${ethers.formatUnits(amountIn,18).slice(0,6)} BAO → WETH ✓`);
      } else {
        const rA = await swapBAOWETH.reserveA();
        const rB = await swapBAOWETH.reserveB();
        const tokenA = await swapBAOWETH.tokenA();
        const [rIn, rOut] = tokenA.toLowerCase() === ADDRESSES.MockWETH.toLowerCase()
          ? [rA, rB] : [rB, rA];
        const amountOut = await swapBAOWETH.getAmountOut(amountIn, rIn, rOut);
        const minOut = amountOut * 95n / 100n;

        console.log(`     ${w.address.slice(0,10)}… approving ${ethers.formatUnits(amountIn,18).slice(0,5)} WETH…`);
        await (await weth.approve(ADDRESSES.SwapBAOWETH, amountIn, { ...fees })).wait();
        console.log(`     ${w.address.slice(0,10)}… swapping WETH → BAO…`);
        const tx = await swap.swap(ADDRESSES.MockWETH, amountIn, minOut, { ...fees });
        await tx.wait();
        txCount.set(w.address, txCount.get(w.address) + 1);
        console.log(`  ↔️  ${w.address.slice(0,10)}… swapped ${ethers.formatUnits(amountIn,18).slice(0,5)} WETH → BAO ✓`);
      }

      await sleep(randBetween(1500, 3000));
    }
  }

  // ── 5. Create a new Meme Token (deployer pays gas) ────────
  console.log("\n🚀 [5/7] Launching a new Meme token (deployer as creator)...\n");
  const factory = new ethers.Contract(ADDRESSES.MemeFactory, FACTORY_ABI, deployer);

  const memeNames = ["BioApe", "GenomeDog", "CancerCure", "DNAcat", "PharmaFrog"];
  const memeName  = memeNames[randBetween(0, memeNames.length - 1)];
  const memeSymbol = memeName.toUpperCase().slice(0, 5);
  console.log(`   Token: ${memeName} ($${memeSymbol})`);

  const createFees = await getFees(deployer.provider);
  console.log(`   ⛽ maxFeePerGas: ${ethers.formatUnits(createFees.maxFeePerGas, "gwei")} gwei`);
  console.log("   Sending createToken…");

  let receipt;
  try {
    const createTx = await factory.createToken(
      memeName, memeSymbol,
      { ...createFees }
    );
    console.log(`   TxHash: ${createTx.hash}`);
    receipt = await createTx.wait();
    console.log(`   Confirmed in block ${receipt.blockNumber}`);
  } catch (err) {
    const reason = await decodeRevertReason(err);
    console.error(`\n❌ createToken reverted`);
    console.error(`   Reason : ${reason}`);
    console.error(`   TxHash : ${err.transaction?.hash ?? "n/a"}`);
    console.error(`   Data   : ${err.data ?? err.error?.data ?? "n/a"}`);
    throw err;
  }

  const length = await factory.allTokensLength();
  const tokens = await factory.getTokens(length - 1n, 1n);
  const memeAddress = tokens[0];
  console.log(`  🎉 Launched ${memeName} ($${memeSymbol}) at ${memeAddress}`);

  // ── 6. Meme Token Buy Activity ────────────────────────────
  console.log("\n🛒 [6/7] Simulating Meme token buys...\n");
  const memeToken = new ethers.Contract(memeAddress, MEME_ABI, deployer);

  for (const wallet of wallets) {
    const w    = wallet.connect(deployer.provider);
    const cure = new ethers.Contract(ADDRESSES.MockCURE, ERC20_ABI, w);
    const meme = new ethers.Contract(memeAddress, MEME_ABI, w);

    const cureAmount  = randAmount(5, 30);
    const cureBalance = await cure.balanceOf(w.address);

    if (cureBalance < cureAmount) {
      console.log(`   ⚠️  ${w.address.slice(0,10)}… CURE balance too low (${ethers.formatUnits(cureBalance,18).slice(0,6)}), skipping buy`);
      continue;
    }

    const fees = await getFees(deployer.provider);
    console.log(`   ${w.address.slice(0,10)}… approving ${ethers.formatUnits(cureAmount,18).slice(0,5)} CURE for meme…`);
    await (await cure.approve(memeAddress, cureAmount, { ...fees })).wait();

    console.log(`   ${w.address.slice(0,10)}… buying ${memeName}…`);
    const buyFees = await getFees(deployer.provider);
    const tx = await meme.buy(cureAmount, 0n, { ...buyFees });
    await tx.wait();
    txCount.set(w.address, txCount.get(w.address) + 1);

    const cureRaised = await memeToken.cureRaised();
    console.log(`  🛒 ${w.address.slice(0,10)}… bought with ${ethers.formatUnits(cureAmount,18).slice(0,5)} CURE | Total raised: ${ethers.formatUnits(cureRaised,18).slice(0,6)} CURE ✓`);

    await sleep(randBetween(2000, 4000));
  }

  // ── 7. One sell to show two-way activity ──────────────────
  console.log("\n💰 [7/7] Simulating a sell...\n");
  const seller     = wallets[1].connect(deployer.provider);
  const sellerMeme = new ethers.Contract(memeAddress, MEME_ABI, seller);

  const sellerBalance = await sellerMeme.balanceOf(seller.address);
  if (sellerBalance > 0n) {
    const sellAmount = sellerBalance / 2n;
    const sellFees   = await getFees(deployer.provider);

    console.log(`   ${seller.address.slice(0,10)}… approving ${ethers.formatUnits(sellAmount,18).slice(0,8)} ${memeSymbol}…`);
    await (await sellerMeme.approve(memeAddress, sellAmount, { ...sellFees })).wait();

    console.log(`   ${seller.address.slice(0,10)}… selling…`);
    const sellFees2 = await getFees(deployer.provider);
    const sellTx    = await sellerMeme.sell(sellAmount, 0n, { ...sellFees2 });
    await sellTx.wait();
    txCount.set(seller.address, txCount.get(seller.address) + 1);
    console.log(`  📤 ${seller.address.slice(0,10)}… sold ${ethers.formatUnits(sellAmount,18).slice(0,8)} ${memeSymbol} ✓`);
  } else {
    console.log(`   ⚠️  ${seller.address.slice(0,10)}… has no ${memeSymbol} to sell, skipping`);
  }

  // ── Summary ───────────────────────────────────────────────
  const finalCureRaised = await memeToken.cureRaised();

  console.log("\n" + "═".repeat(55));
  console.log("✅ Simulation complete!");
  console.log("═".repeat(55));
  console.log(`   New Token  : ${memeName} ($${memeSymbol})`);
  console.log(`   Address    : ${memeAddress}`);
  console.log(`   CURE Raised: ${ethers.formatUnits(finalCureRaised, 18)} / 1000 CURE`);
  console.log(`   Graduation : ${(Number(finalCureRaised) / 1e18 / 10).toFixed(1)}%`);
  console.log("\n   Per-wallet tx count:");
  for (const [addr, count] of txCount) {
    console.log(`     ${addr.slice(0,10)}…  ${count} tx`);
  }
  console.log(`\n   View : https://xcure.vercel.app/meme/${memeAddress}`);
  console.log(`   Scan : https://sepolia.arbiscan.io/address/${ADDRESSES.MemeFactory}`);
  console.log("═".repeat(55) + "\n");
}

main().catch(err => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
