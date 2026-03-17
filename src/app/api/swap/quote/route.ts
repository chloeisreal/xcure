import { NextRequest, NextResponse } from "next/server";

// 0x API v2 — supported chains: Arbitrum One (42161), Ethereum (1), Base (8453), etc.
// Testnet (Arbitrum Sepolia 421614) is not supported; we use Arbitrum One for price quotes.
const ZERO_EX_CHAIN_ID = "42161"; // Arbitrum One

export async function GET(request: NextRequest) {
  const apiKey = process.env.NEXT_PUBLIC_0X_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { reason: "0x API key not configured. Add NEXT_PUBLIC_0X_API_KEY to .env.local" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "price"; // "price" | "quote"

  // Forward all params except "type" to the 0x API
  const forwardParams = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (key !== "type") {
      forwardParams.set(key, value);
    }
  }

  const url = `https://api.0x.org/swap/permit2/${type}?${forwardParams}`;

  try {
    const res = await fetch(url, {
      headers: {
        "0x-api-key": apiKey,
        "0x-chain-id": ZERO_EX_CHAIN_ID,
      },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ reason: "Failed to reach 0x API" }, { status: 502 });
  }
}
