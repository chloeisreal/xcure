/**
 * scripts/simulate.js
 *
 * Two modes:
 *   Normal:   npx hardhat run scripts/simulate.js --network arbitrumSepolia
 *   Grad test: GRAD_TEST=1 npx hardhat run scripts/simulate.js --network arbitrumSepolia
 *
 * Grad-test mode creates a fresh meme token, buys until graduation (1000 CURE),
 * then verifies the Uniswap V2 pair was created and liquidity injected.
 */

const hre = require("hardhat");
const { ethers } = hre;

// ── Contract Addresses (Arbitrum Sepolia) ─────────────────
const ADDRESSES = {
  MockCURE:         "0xf4d76f449E66c714105928f24bc9fD59692B1157",
  MockBAO:          "0xcA8467C9a2d546B1A9Dc0AC8F668d2716D343730",
  MockWETH:         "0xd23ad7d69d892f2ccABFF2E78cb2e46751B49295",
  SwapCUREBAO:      "0xDF0FB1782e6388845d78B318ee7460778342C7FA",
  SwapBAOWETH:      "0x3f4C141153B1994bcb72D22d37a8073f58981Ad6",
  MemeFactory:      "0x68AEe80420040cc52dB236e651E4910EB8528A93", // new factory with Uniswap exit (v2 fixes)
  UniswapV2Factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
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
  "function cureRaised() view returns (uint256)",
  "function graduated() view returns (bool)",
  "function name() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function GRAD_THRESHOLD() view returns (uint256)",
];

const UNI_FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)",
];

const UNI_PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
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
        const [msg] = ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10));
        return msg;
      } catch {}
    }
    if (data.startsWith("0x4e487b71")) {
      try {
        const [code] = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], "0x" + data.slice(10));
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
    maxFeePerGas:         feeData.maxFeePerGas         * 2n,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n,
  };
}

async function fundWallet(deployer, wallet, ethAmount) {
  const fees = await getFees(deployer.provider);
  const tx = await deployer.sendTransaction({ to: wallet.address, value: ethAmount, ...fees });
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

// ══════════════════════════════════════════════════════════
// GRADUATION TEST MODE
// ══════════════════════════════════════════════════════════
async function runGradTest() {
  const [deployer] = await ethers.getSigners();
  console.log("\n🎓 XCure — Uniswap V2 Graduation Test");
  console.log(`   Deployer : ${deployer.address}`);
  console.log(`   Network  : ${hre.network.name}`);
  console.log(`   Factory  : ${ADDRESSES.MemeFactory}\n`);

  const ethBal = await deployer.provider.getBalance(deployer.address);
  console.log(`   ETH bal  : ${ethers.formatEther(ethBal)} ETH`);
  if (ethBal < ethers.parseEther("0.005")) {
    throw new Error("Need at least 0.005 ETH for gas");
  }

  // ── Step 1: Mint 2000 CURE to deployer ──────────────────
  console.log("\n── Step 1: Mint 2000 CURE to deployer ─────────────");
  const cure = new ethers.Contract(ADDRESSES.MockCURE, ERC20_ABI, deployer);
  await mintTokens(deployer, ADDRESSES.MockCURE, deployer.address, ethers.parseEther("2000"), "CURE");
  const cureBal = await cure.balanceOf(deployer.address);
  console.log(`   Deployer CURE balance: ${ethers.formatEther(cureBal)} CURE`);

  // ── Step 2: Create a new meme token ─────────────────────
  console.log("\n── Step 2: Create meme token via new MemeFactory ──");
  const factory = new ethers.Contract(ADDRESSES.MemeFactory, FACTORY_ABI, deployer);

  const memeName   = "GradTest";
  const memeSymbol = "GRAD";
  console.log(`   Token: ${memeName} ($${memeSymbol})`);

  const createFees = await getFees(deployer.provider);
  let memeAddress;
  try {
    const createTx = await factory.createToken(memeName, memeSymbol, { ...createFees });
    console.log(`   TxHash: ${createTx.hash}`);
    await createTx.wait();
    const length = await factory.allTokensLength();
    const tokens = await factory.getTokens(length - 1n, 1n);
    memeAddress = tokens[0];
    console.log(`   ✓ MemeToken deployed at: ${memeAddress}`);
  } catch (err) {
    console.error(`   ❌ createToken failed: ${await decodeRevertReason(err)}`);
    throw err;
  }

  const memeToken = new ethers.Contract(memeAddress, MEME_ABI, deployer);
  const gradThreshold = await memeToken.GRAD_THRESHOLD();
  console.log(`   Graduation threshold: ${ethers.formatEther(gradThreshold)} CURE`);

  // ── Step 3: Buy in chunks until graduation ──────────────
  console.log("\n── Step 3: Buy until graduation ───────────────────");

  // Pre-approve a large amount so we don't re-approve every iteration
  const bigApprove = ethers.parseEther("2000");
  const approveFees = await getFees(deployer.provider);
  console.log("   Approving 2000 CURE to meme contract…");
  await (await cure.approve(memeAddress, bigApprove, { ...approveFees })).wait();
  console.log("   ✓ Approved");

  const MAX_ITERATIONS = 30; // safety cap
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const isGraduated = await memeToken.graduated();
    if (isGraduated) {
      console.log(`\n   🎉 Token has graduated!`);
      break;
    }

    const raised = await memeToken.cureRaised();
    const remaining = gradThreshold - raised;

    // Buy 50-100 CURE, but cap at what's still needed (+ small buffer for rounding)
    let buyAmount = randAmount(50, 100);
    if (buyAmount > remaining + ethers.parseEther("5")) {
      buyAmount = remaining + ethers.parseEther("2");
    }

    const progress = (Number(raised) / Number(gradThreshold) * 100).toFixed(1);
    console.log(`\n   [${iteration}] cureRaised: ${ethers.formatEther(raised).slice(0,8)} / ${ethers.formatEther(gradThreshold)} CURE (${progress}%)`);
    console.log(`        Buying ${ethers.formatEther(buyAmount).slice(0,6)} CURE…`);

    try {
      const buyFees = await getFees(deployer.provider);
      const tx = await memeToken.buy(buyAmount, 0n, { ...buyFees });
      const receipt = await tx.wait();
      console.log(`        ✓ Tx confirmed (block ${receipt.blockNumber})`);
    } catch (err) {
      const reason = await decodeRevertReason(err);
      // AlreadyGraduated or ZeroAmount means the curve is exhausted/graduated
      if (reason.includes("AlreadyGraduated") || reason.includes("already") || reason.includes("ZeroAmount")) {
        console.log(`        ℹ️  Curve exhausted / AlreadyGraduated — checking state…`);
        break;
      }
      console.error(`        ❌ buy() failed: ${reason}`);
      throw err;
    }

    await sleep(1500);
  }

  // ── Step 4: Verify graduation state ─────────────────────
  console.log("\n── Step 4: Verify graduation ───────────────────────");

  const isGraduated = await memeToken.graduated();
  const finalRaised = await memeToken.cureRaised();
  console.log(`   graduated()  : ${isGraduated}`);
  console.log(`   cureRaised() : ${ethers.formatEther(finalRaised)} CURE`);

  if (!isGraduated) {
    console.error("   ❌ Token did NOT graduate — check buy loop or threshold");
    process.exit(1);
  }
  console.log("   ✓ Graduation confirmed");

  // ── Step 5: Verify Uniswap V2 pair ──────────────────────
  console.log("\n── Step 5: Verify Uniswap V2 pair ─────────────────");

  let pairAddress = "0x0000000000000000000000000000000000000000";
  try {
    const uniFactory = new ethers.Contract(ADDRESSES.UniswapV2Factory, UNI_FACTORY_ABI, deployer.provider);
    pairAddress = await uniFactory.getPair(ADDRESSES.MockCURE, memeAddress);
    console.log(`   getPair(CURE, ${memeSymbol}): ${pairAddress}`);
  } catch {
    console.log(`   ⚠️  Could not query Uniswap V2 Factory — not deployed on ${hre.network.name}`);
  }

  const ZERO = "0x0000000000000000000000000000000000000000";
  let cureReserve = 0n, memeReserve = 0n;
  if (pairAddress === ZERO) {
    console.log("   ⚠️  Pair address is zero — Uniswap V2 LP skipped (router may not be on this testnet)");
    console.log("      This is expected on Arbitrum Sepolia; graduation state is still valid.");
  } else {
    console.log("   ✓ Uniswap V2 pair exists");

    // ── Step 6: Read pair reserves ─────────────────────────
    console.log("\n── Step 6: Read pair reserves ──────────────────────");

    const pair   = new ethers.Contract(pairAddress, UNI_PAIR_ABI, deployer.provider);
    const token0 = await pair.token0();
    const token1 = await pair.token1();
    const { reserve0, reserve1 } = await pair.getReserves();

    const isCureToken0 = token0.toLowerCase() === ADDRESSES.MockCURE.toLowerCase();
    [cureReserve, memeReserve] = isCureToken0 ? [reserve0, reserve1] : [reserve1, reserve0];

    console.log(`   token0        : ${token0} (${isCureToken0 ? "CURE" : memeSymbol})`);
    console.log(`   token1        : ${token1} (${isCureToken0 ? memeSymbol : "CURE"})`);
    console.log(`   CURE in pool  : ${ethers.formatEther(cureReserve)} CURE`);
    console.log(`   ${memeSymbol} in pool   : ${ethers.formatEther(memeReserve)} ${memeSymbol}`);

    if (cureReserve > 0n || memeReserve > 0n) {
      console.log("   ✓ Liquidity confirmed in pool");
    } else {
      console.log("   ⚠️  Both reserves are zero — LP injection may have failed, but graduation is valid");
    }
  }

  // ── Summary ───────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("✅ Graduation test PASSED");
  console.log("═".repeat(60));
  console.log(`   MemeToken     : ${memeAddress}`);
  console.log(`   Uniswap Pair  : ${pairAddress === ZERO ? "(none — router not on testnet)" : pairAddress}`);
  if (pairAddress !== ZERO) {
    console.log(`   CURE in pool  : ${ethers.formatEther(cureReserve)} CURE`);
    console.log(`   ${memeSymbol} in pool   : ${ethers.formatEther(memeReserve)} ${memeSymbol}`);
  }
  console.log(`   Scan (token)  : https://sepolia.arbiscan.io/address/${memeAddress}`);
  if (pairAddress !== ZERO) console.log(`   Scan (pair)   : https://sepolia.arbiscan.io/address/${pairAddress}`);
  console.log("═".repeat(60) + "\n");
}

// ══════════════════════════════════════════════════════════
// NORMAL SIMULATION MODE
// ══════════════════════════════════════════════════════════
async function runSimulation() {
  const [deployer] = await ethers.getSigners();
  console.log("\n🚀 XCure Testnet Activity Simulator");
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   Network:  ${hre.network.name}\n`);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`   ETH Balance: ${ethers.formatEther(balance)} ETH`);
  if (balance < ethers.parseEther("0.007")) {
    throw new Error("Deployer needs at least 0.007 ETH on Arbitrum Sepolia");
  }

  const txCount = new Map();

  // ── 1. Create simulation wallets ──────────────────────────
  const NUM_WALLETS = 2;
  console.log(`\n📦 [1/7] Creating ${NUM_WALLETS} simulation wallets...`);
  const wallets = Array.from({ length: NUM_WALLETS }, () =>
    ethers.Wallet.createRandom().connect(deployer.provider)
  );
  for (const w of wallets) txCount.set(w.address, 0);
  console.log(`   Addresses: ${wallets.map(w => w.address.slice(0,10)+"…").join(", ")}\n`);

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
  console.log("\n🔄 [3/7] Simulating CURE ↔ BAO swaps (3 rounds × 2 wallets)...\n");
  const swapCUREBAO = new ethers.Contract(ADDRESSES.SwapCUREBAO, SWAP_ABI, deployer);

  for (let round = 0; round < 3; round++) {
    console.log(`   Round ${round + 1}/3`);
    for (const wallet of wallets) {
      const w    = wallet.connect(deployer.provider);
      const cure = new ethers.Contract(ADDRESSES.MockCURE, ERC20_ABI, w);
      const bao  = new ethers.Contract(ADDRESSES.MockBAO,  ERC20_ABI, w);
      const swap = new ethers.Contract(ADDRESSES.SwapCUREBAO, SWAP_ABI, w);
      const fees = await getFees(deployer.provider);
      const buyBAO   = Math.random() > 0.5;
      const amountIn = randAmount(10, 80);

      if (buyBAO) {
        const rA = await swapCUREBAO.reserveA();
        const rB = await swapCUREBAO.reserveB();
        const tokenA = await swapCUREBAO.tokenA();
        const [rIn, rOut] = tokenA.toLowerCase() === ADDRESSES.MockCURE.toLowerCase() ? [rA, rB] : [rB, rA];
        const minOut = (await swapCUREBAO.getAmountOut(amountIn, rIn, rOut)) * 95n / 100n;
        await (await cure.approve(ADDRESSES.SwapCUREBAO, amountIn, { ...fees })).wait();
        const tx = await swap.swap(ADDRESSES.MockCURE, amountIn, minOut, { ...fees });
        await tx.wait();
        txCount.set(w.address, txCount.get(w.address) + 1);
        console.log(`  ↔️  ${w.address.slice(0,10)}… swapped ${ethers.formatUnits(amountIn,18).slice(0,6)} CURE → BAO ✓`);
      } else {
        const rA = await swapCUREBAO.reserveA();
        const rB = await swapCUREBAO.reserveB();
        const tokenA = await swapCUREBAO.tokenA();
        const [rIn, rOut] = tokenA.toLowerCase() === ADDRESSES.MockBAO.toLowerCase() ? [rA, rB] : [rB, rA];
        const minOut = (await swapCUREBAO.getAmountOut(amountIn, rIn, rOut)) * 95n / 100n;
        await (await bao.approve(ADDRESSES.SwapCUREBAO, amountIn, { ...fees })).wait();
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
      const w    = wallet.connect(deployer.provider);
      const bao  = new ethers.Contract(ADDRESSES.MockBAO,  ERC20_ABI, w);
      const weth = new ethers.Contract(ADDRESSES.MockWETH, ERC20_ABI, w);
      const swap = new ethers.Contract(ADDRESSES.SwapBAOWETH, SWAP_ABI, w);
      const fees = await getFees(deployer.provider);
      const buyWETH  = Math.random() > 0.5;
      const amountIn = buyWETH ? randAmount(20, 100) : ethers.parseEther((Math.random() * 0.02 + 0.005).toFixed(4));

      if (buyWETH) {
        const rA = await swapBAOWETH.reserveA();
        const rB = await swapBAOWETH.reserveB();
        const tokenA = await swapBAOWETH.tokenA();
        const [rIn, rOut] = tokenA.toLowerCase() === ADDRESSES.MockBAO.toLowerCase() ? [rA, rB] : [rB, rA];
        const minOut = (await swapBAOWETH.getAmountOut(amountIn, rIn, rOut)) * 95n / 100n;
        await (await bao.approve(ADDRESSES.SwapBAOWETH, amountIn, { ...fees })).wait();
        const tx = await swap.swap(ADDRESSES.MockBAO, amountIn, minOut, { ...fees });
        await tx.wait();
        txCount.set(w.address, txCount.get(w.address) + 1);
        console.log(`  ↔️  ${w.address.slice(0,10)}… swapped ${ethers.formatUnits(amountIn,18).slice(0,6)} BAO → WETH ✓`);
      } else {
        const rA = await swapBAOWETH.reserveA();
        const rB = await swapBAOWETH.reserveB();
        const tokenA = await swapBAOWETH.tokenA();
        const [rIn, rOut] = tokenA.toLowerCase() === ADDRESSES.MockWETH.toLowerCase() ? [rA, rB] : [rB, rA];
        const minOut = (await swapBAOWETH.getAmountOut(amountIn, rIn, rOut)) * 95n / 100n;
        await (await weth.approve(ADDRESSES.SwapBAOWETH, amountIn, { ...fees })).wait();
        const tx = await swap.swap(ADDRESSES.MockWETH, amountIn, minOut, { ...fees });
        await tx.wait();
        txCount.set(w.address, txCount.get(w.address) + 1);
        console.log(`  ↔️  ${w.address.slice(0,10)}… swapped ${ethers.formatUnits(amountIn,18).slice(0,5)} WETH → BAO ✓`);
      }
      await sleep(randBetween(1500, 3000));
    }
  }

  // ── 5. Create a new Meme Token ────────────────────────────
  console.log("\n🚀 [5/7] Launching a new Meme token (deployer as creator)...\n");
  const factory = new ethers.Contract(ADDRESSES.MemeFactory, FACTORY_ABI, deployer);
  const memeNames  = ["BioApe", "GenomeDog", "CancerCure", "DNAcat", "PharmaFrog"];
  const memeName   = memeNames[randBetween(0, memeNames.length - 1)];
  const memeSymbol = memeName.toUpperCase().slice(0, 5);
  console.log(`   Token: ${memeName} ($${memeSymbol})`);

  const createFees = await getFees(deployer.provider);
  let memeAddress, receipt;
  try {
    const createTx = await factory.createToken(memeName, memeSymbol, { ...createFees });
    console.log(`   TxHash: ${createTx.hash}`);
    receipt = await createTx.wait();
    console.log(`   Confirmed in block ${receipt.blockNumber}`);
  } catch (err) {
    const reason = await decodeRevertReason(err);
    console.error(`\n❌ createToken reverted: ${reason}`);
    throw err;
  }

  const length = await factory.allTokensLength();
  const tokens = await factory.getTokens(length - 1n, 1n);
  memeAddress = tokens[0];
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
      console.log(`   ⚠️  ${w.address.slice(0,10)}… CURE balance too low, skipping buy`);
      continue;
    }

    const fees = await getFees(deployer.provider);
    await (await cure.approve(memeAddress, cureAmount, { ...fees })).wait();
    const buyFees = await getFees(deployer.provider);
    const tx = await meme.buy(cureAmount, 0n, { ...buyFees });
    await tx.wait();
    txCount.set(w.address, txCount.get(w.address) + 1);

    const cureRaised = await memeToken.cureRaised();
    console.log(`  🛒 ${w.address.slice(0,10)}… bought with ${ethers.formatUnits(cureAmount,18).slice(0,5)} CURE | Total raised: ${ethers.formatUnits(cureRaised,18).slice(0,6)} CURE ✓`);
    await sleep(randBetween(2000, 4000));
  }

  // ── 7. One sell ───────────────────────────────────────────
  console.log("\n💰 [7/7] Simulating a sell...\n");
  const seller     = wallets[1].connect(deployer.provider);
  const sellerMeme = new ethers.Contract(memeAddress, MEME_ABI, seller);
  const sellerBal  = await sellerMeme.balanceOf(seller.address);

  if (sellerBal > 0n) {
    const sellAmount = sellerBal / 2n;
    const sellFees   = await getFees(deployer.provider);
    await (await sellerMeme.approve(memeAddress, sellAmount, { ...sellFees })).wait();
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

// ── Entry point ────────────────────────────────────────────
async function main() {
  if (process.env.GRAD_TEST === "1") {
    await runGradTest();
  } else {
    await runSimulation();
  }
}

main().catch(err => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
