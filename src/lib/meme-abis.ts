// ── Addresses ──────────────────────────────────────────────────────────────
export const FACTORY_ADDRESS =
  "0x7474ceF804Fec62ffC7adbF2f3103fF607A2CF5d" as const;

// ── ABIs ───────────────────────────────────────────────────────────────────
export const FACTORY_ABI = [
  {
    name: "allTokensLength",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getTokens",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit",  type: "uint256" },
    ],
    outputs: [{ name: "result", type: "address[]" }],
  },
  {
    name: "createToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name",   type: "string" },
      { name: "symbol", type: "string" },
    ],
    outputs: [{ name: "token", type: "address" }],
  },
  {
    name: "TokenCreated",
    type: "event",
    inputs: [
      { indexed: true,  name: "token",   type: "address" },
      { indexed: true,  name: "creator", type: "address" },
      { indexed: false, name: "name",    type: "string"  },
      { indexed: false, name: "symbol",  type: "string"  },
      { indexed: false, name: "index",   type: "uint256" },
    ],
  },
] as const;

export const MEME_TOKEN_ABI = [
  { name: "name",         type: "function", stateMutability: "view",     inputs: [],                                                          outputs: [{ name: "", type: "string"  }] },
  { name: "symbol",       type: "function", stateMutability: "view",     inputs: [],                                                          outputs: [{ name: "", type: "string"  }] },
  { name: "tokensSold",   type: "function", stateMutability: "view",     inputs: [],                                                          outputs: [{ name: "", type: "uint256" }] },
  { name: "ethRaised",    type: "function", stateMutability: "view",     inputs: [],                                                          outputs: [{ name: "", type: "uint256" }] },
  { name: "graduated",    type: "function", stateMutability: "view",     inputs: [],                                                          outputs: [{ name: "", type: "bool"    }] },
  { name: "creator",      type: "function", stateMutability: "view",     inputs: [],                                                          outputs: [{ name: "", type: "address" }] },
  { name: "currentPrice", type: "function", stateMutability: "view",     inputs: [],                                                          outputs: [{ name: "", type: "uint256" }] },
  { name: "balanceOf",    type: "function", stateMutability: "view",     inputs: [{ name: "account", type: "address" }],                      outputs: [{ name: "", type: "uint256" }] },
  { name: "getCost",      type: "function", stateMutability: "pure",     inputs: [{ name: "sold", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "buy",          type: "function", stateMutability: "payable",  inputs: [{ name: "minTokens", type: "uint256" }],                    outputs: [] },
  { name: "sell",         type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }],                     outputs: [] },
] as const;

// ── Constants (mirror Solidity) ─────────────────────────────────────────────
export const GRAD_THRESHOLD = 100_000_000_000_000_000n; // 0.1 ETH in wei

const BASE_PRICE  = 100_000_000n; // 1e8 wei per whole token
const PRICE_SLOPE =  50_000_000n; // 5e7 wei per whole token
const CURVE_WHOLE = 800_000_000n;
const CURVE_SUPPLY_UNITS = 800_000_000n * 1_000_000_000_000_000_000n;
const E18 = 1_000_000_000_000_000_000n;

function getCostJS(sold: bigint, amount: bigint): bigint {
  const s = sold   / E18;
  const a = amount / E18;
  if (a === 0n) return 0n;
  return BASE_PRICE * a + (PRICE_SLOPE * (a * s + (a * a) / 2n)) / CURVE_WHOLE;
}

/** Estimate tokens receivable for `ethInput` wei (mirrors Solidity buy logic). */
export function estimateBuyTokens(ethInput: bigint, tokensSold: bigint): bigint {
  if (ethInput === 0n) return 0n;
  const fee   = (ethInput * 100n) / 10_000n;
  const ethIn = ethInput - fee;
  const maxWhole = (CURVE_SUPPLY_UNITS - tokensSold) / E18;
  let lo = 0n, hi = maxWhole;
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    getCostJS(tokensSold, mid * E18) <= ethIn ? (lo = mid) : (hi = mid - 1n);
  }
  return lo * E18;
}

/** Estimate ETH received for selling `sellAmount` tokens (after 1% fee). */
export function estimateSellETH(sellAmount: bigint, tokensSold: bigint): bigint {
  if (sellAmount === 0n || sellAmount > tokensSold) return 0n;
  const proceeds = getCostJS(tokensSold - sellAmount, sellAmount);
  return proceeds - (proceeds * 100n) / 10_000n;
}
