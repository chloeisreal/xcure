import { cacheGet, cacheSet, cacheKey } from './cache';
import type { TokenizedCompany } from './types';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

interface CoinGeckoPrice {
  [coinId: string]: {
    usd: number;
    usd_24h_change?: number;
    usd_market_cap?: number;
  };
}

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
}

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function getTokenPriceFromCoinGecko(tokenSymbol: string): Promise<number | null> {
  try {
    const searchUrl = `${COINGECKO_API}/search?query=${tokenSymbol}`;
    const searchResponse = await fetchWithTimeout(searchUrl);
    
    if (!searchResponse.ok) {
      return null;
    }
    
    const searchData = await searchResponse.json();
    const coins: CoinGeckoCoin[] = searchData.coins || [];
    
    if (coins.length === 0) {
      return null;
    }
    
    const coinId = coins[0].id;
    const priceUrl = `${COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=usd`;
    const priceResponse = await fetchWithTimeout(priceUrl);
    
    if (!priceResponse.ok) {
      return null;
    }
    
    const priceData: CoinGeckoPrice = await priceResponse.json();
    return priceData[coinId]?.usd || null;
    
  } catch (error) {
    console.error(`CoinGecko error for ${tokenSymbol}:`, error);
    return null;
  }
}

export async function getMultipleTokenPrices(
  tokenSymbols: string[]
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  
  const promises = tokenSymbols.map(async (symbol) => {
    const price = await getTokenPriceFromCoinGecko(symbol);
    if (price) {
      results[symbol.toUpperCase()] = price;
    }
  });
  
  await Promise.allSettled(promises);
  
  return results;
}

export async function getTokenPrice(tokenSymbol: string): Promise<number | null> {
  const cacheKeyName = cacheKey('token', 'price', tokenSymbol.toUpperCase());
  const cached = await cacheGet<number>(cacheKeyName);
  
  if (cached && cached > 0) {
    return cached;
  }
  
  const price = await getTokenPriceFromCoinGecko(tokenSymbol);
  
  if (price) {
    await cacheSet(cacheKeyName, price, 300);
  }
  
  return price;
}

export async function refreshTokenPrices(): Promise<Record<string, number>> {
  const tokenized = await import('./local').then(m => m.getTokenizedBiotech());
  
  const symbols = tokenized.map(t => t.symbol);
  const prices = await getMultipleTokenPrices(symbols);
  
  for (const [symbol, price] of Object.entries(prices)) {
    const key = cacheKey('token', 'price', symbol);
    await cacheSet(key, price, 300);
  }
  
  return prices;
}

export function getTokenByAddress(
  tokenized: TokenizedCompany[],
  address: string
): TokenizedCompany | null {
  return tokenized.find(
    t => t.tokenAddress.toLowerCase() === address.toLowerCase()
  ) || null;
}

export async function searchTokens(query: string): Promise<TokenizedCompany[]> {
  const tokenized = await import('./local').then(m => m.getTokenizedBiotech());
  
  const searchLower = query.toLowerCase();
  
  return tokenized.filter(t =>
    t.name.toLowerCase().includes(searchLower) ||
    t.symbol.toLowerCase().includes(searchLower) ||
    t.category.toLowerCase().includes(searchLower)
  );
}
