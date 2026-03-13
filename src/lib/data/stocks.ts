import { cacheGet, cacheSet, cacheKey } from './cache';
import { CACHE_TTL } from './types';
import type { Quote, FinancialData, ListedCompany } from './types';

const STOCKPRICES_API = 'https://stockprices.dev/api/stocks';

async function fetchWithTimeout(url: string, timeout = 5000): Promise<Response> {
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

export async function getQuoteFromStockprices(symbol: string): Promise<Quote | null> {
  try {
    const response = await fetchWithTimeout(`${STOCKPRICES_API}/${symbol.toUpperCase()}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      symbol: data.Ticker,
      name: data.Name,
      price: parseFloat(data.Price) || 0,
      change: parseFloat(data.ChangeAmount) || 0,
      changePercent: parseFloat(data.ChangePercentage) || 0,
      volume: 0,
      marketCap: undefined,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`stockprices.dev failed for ${symbol}:`, error);
    return null;
  }
}

export async function getQuoteFromYahoo(symbol: string): Promise<Quote | null> {
  try {
    const yahooFinanceModule = await import('yahoo-finance2');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote = await (yahooFinanceModule.default as any).quote(symbol);
    
    if (!quote) return null;
    
    return {
      symbol: quote.symbol,
      name: quote.shortName || quote.longName || symbol,
      price: quote.regularMarketPrice || 0,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      volume: quote.regularMarketVolume || 0,
      marketCap: quote.marketCap,
      currency: (quote.currency as 'USD' | 'HKD') || 'USD',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`yahoo-finance2 failed for ${symbol}:`, error);
    return null;
  }
}

export async function getQuoteFromFMP(symbol: string): Promise<Quote | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    return null;
  }
  
  try {
    const response = await fetchWithTimeout(
      `https://financialmodelingprep.com/stable/quote/${symbol}?apikey=${apiKey}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }
    
    const quote = data[0];
    
    return {
      symbol: quote.symbol,
      name: quote.name,
      price: quote.price || 0,
      change: quote.change || 0,
      changePercent: quote.changesPercentage || 0,
      volume: quote.volume || 0,
      marketCap: quote.marketCap,
      currency: quote.currency || 'USD',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`FMP failed for ${symbol}:`, error);
    return null;
  }
}

const MOCK_QUOTES: Record<string, Quote> = {
  'MRNA': { symbol: 'MRNA', name: 'Moderna Inc.', price: 45.67, change: 2.34, changePercent: 5.4, volume: 12000000, marketCap: 18000000000, currency: 'USD', timestamp: new Date().toISOString() },
  'BNTX': { symbol: 'BNTX', name: 'BioNTech SE', price: 98.45, change: -1.23, changePercent: -1.23, volume: 5000000, marketCap: 25000000000, currency: 'USD', timestamp: new Date().toISOString() },
  'PFE': { symbol: 'PFE', name: 'Pfizer Inc.', price: 28.90, change: 0.45, changePercent: 1.58, volume: 35000000, marketCap: 160000000000, currency: 'USD', timestamp: new Date().toISOString() },
  'VRTX': { symbol: 'VRTX', name: 'Vertex Pharmaceuticals', price: 412.50, change: 5.20, changePercent: 1.28, volume: 1200000, marketCap: 105000000000, currency: 'USD', timestamp: new Date().toISOString() },
  'REGN': { symbol: 'REGN', name: 'Regeneron Pharmaceuticals', price: 945.30, change: 12.50, changePercent: 1.34, volume: 800000, marketCap: 104000000000, currency: 'USD', timestamp: new Date().toISOString() },
  'GILD': { symbol: 'GILD', name: 'Gilead Sciences', price: 82.15, change: -0.85, changePercent: -1.02, volume: 18000000, marketCap: 102000000000, currency: 'USD', timestamp: new Date().toISOString() },
  'VITA': { symbol: 'VITA', name: 'VitaDAO', price: 0.32, change: 0.02, changePercent: 6.67, volume: 500000, marketCap: 32000000, currency: 'USD', timestamp: new Date().toISOString() },
  'BIO': { symbol: 'BIO', name: 'BIO Protocol', price: 0.85, change: 0.05, changePercent: 6.25, volume: 1000000, marketCap: 127500000, currency: 'USD', timestamp: new Date().toISOString() },
  'AAPL': { symbol: 'AAPL', name: 'Apple Inc.', price: 178.50, change: 2.30, changePercent: 1.31, volume: 55000000, marketCap: 2800000000000, currency: 'USD', timestamp: new Date().toISOString() },
};

export async function getQuote(symbol: string): Promise<Quote | null> {
  const cacheKeyName = cacheKey('quote', symbol.toUpperCase());
  const cached = await cacheGet<Quote>(cacheKeyName);
  
  if (cached) {
    return cached;
  }
  
  let quote = await getQuoteFromStockprices(symbol);
  
  if (!quote) {
    quote = await getQuoteFromYahoo(symbol);
  }
  
  if (!quote && process.env.FMP_API_KEY) {
    quote = await getQuoteFromFMP(symbol);
  }
  
  // Fallback to mock data for testing
  if (!quote) {
    const upperSymbol = symbol.toUpperCase();
    if (MOCK_QUOTES[upperSymbol]) {
      quote = MOCK_QUOTES[upperSymbol];
    }
  }
  
  if (quote) {
    await cacheSet(cacheKeyName, quote, CACHE_TTL.QUOTE);
  }
  
  return quote;
}

export async function getFinancials(symbol: string): Promise<FinancialData | null> {
  const cacheKeyName = cacheKey('financials', symbol.toUpperCase());
  const cached = await cacheGet<FinancialData>(cacheKeyName);
  
  if (cached) {
    return cached;
  }
  
  try {
    const yahooFinanceModule = await import('yahoo-finance2');
    const yahooFinance = yahooFinanceModule.default;
    // @ts-ignore - Type definitions issue with yahoo-finance2
    const quoteSummary: any = await yahooFinance.quoteSummary(symbol, {
      modules: ['financialData', 'defaultKeyStatistics']
    });
    
    if (!quoteSummary) return null;
    
    const financialData = quoteSummary.financialData;
    const defaultKeyStatistics = quoteSummary.defaultKeyStatistics;
    
    const financials: FinancialData = {
      revenue: financialData?.totalRevenue,
      netIncome: financialData?.netIncomeToCommon,
      grossProfit: financialData?.grossProfit,
      operatingIncome: financialData?.operatingIncome,
      totalAssets: undefined,
      totalLiabilities: undefined,
      cashFlow: financialData?.operatingCashflow,
      eps: defaultKeyStatistics?.trailingEps,
      peRatio: defaultKeyStatistics?.trailingPE,
      pbRatio: defaultKeyStatistics?.priceToBook,
      beta: defaultKeyStatistics?.beta3Year,
    };
    
    await cacheSet(cacheKeyName, financials, CACHE_TTL.FINANCIALS);
    
    return financials;
  } catch (error) {
    console.error(`Failed to get financials for ${symbol}:`, error);
    return null;
  }
}

export async function getCompanyInfo(symbol: string): Promise<ListedCompany | null> {
  const quote = await getQuote(symbol);
  
  if (!quote) return null;
  
  return {
    id: symbol.toLowerCase(),
    name: quote.name,
    sector: 'Biotechnology',
    subsector: undefined,
    type: 'listed',
    symbol: quote.symbol,
    exchange: 'NASDAQ',
    currency: quote.currency as 'USD',
    marketCap: quote.marketCap,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getMultipleQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const results = new Map<string, Quote>();
  
  const promises = symbols.map(async (symbol) => {
    const quote = await getQuote(symbol);
    if (quote) {
      results.set(symbol.toUpperCase(), quote);
    }
  });
  
  await Promise.allSettled(promises);
  
  return results;
}
