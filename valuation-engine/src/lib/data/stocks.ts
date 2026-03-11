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
    const yahooFinance = yahooFinanceModule.default;
    // @ts-ignore - Type definitions issue with yahoo-finance2
    const quote = await yahooFinance.quote(symbol);
    
    if (!quote) return null;
    
    return {
      symbol: quote.symbol,
      name: quote.shortName || quote.longName || symbol,
      price: quote.regularMarketPrice || 0,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      volume: quote.regularMarketVolume || 0,
      marketCap: quote.marketCap,
      currency: quote.currency || 'USD',
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
    const quoteSummary = await yahooFinance.quoteSummary(symbol, {
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
