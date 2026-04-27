import { NextRequest, NextResponse } from 'next/server';
import { searchCompanies } from '@/lib/data/local';
import { getQuote, getQuoteFromYahoo, getQuoteFromFMP } from '@/lib/data/stocks';
import { getTokenPriceFromCoinGecko } from '@/lib/data/tokens';
import { getRecentHKEXFilings } from '@/lib/data/hkex';
import { searchCompany } from '@/lib/data/companies-api';
import type { Quote } from '@/lib/data/types';
import fs from 'fs';
import path from 'path';

export type EntityType = 'us-stock' | 'hk-stock' | 'crypto' | 'hk-ipo' | 'preipo' | 'token' | 'company-name';

export interface SearchResult {
  symbol: string;
  name: string;
  nameEn?: string;
  type: EntityType;
  exchange?: string;
  price?: number;
  currency?: 'USD' | 'HKD';
  prospectusPDF?: string;
  change?: number;
  changePercent?: number;
  marketCap?: number;
  _score?: number;
}

interface SearchResponse {
  success: boolean;
  data: SearchResult[];
  error?: { code: string; message: string };
  meta?: {
    query: string;
    searchType: string;
  };
}

async function searchHKEXAndAddToDatabase(query: string): Promise<SearchResult | null> {
  try {
    const hkexFilings = await getRecentHKEXFilings(['A1'], 50);
    
    const queryLower = query.toLowerCase();
    const matching = hkexFilings.find(f => 
      f.companyName.toLowerCase().includes(queryLower) ||
      f.companyNameEn.toLowerCase().includes(queryLower) ||
      f.companyName.toLowerCase().split('').some(c => queryLower.includes(c))
    );
    
    if (!matching) {
      return null;
    }
    
    const newCompany = {
      id: matching.stockCode ? `hkex-${matching.stockCode}` : `hkex-${Date.now()}`,
      name: matching.companyName,
      nameEn: matching.companyNameEn,
      hkexCode: matching.stockCode,
      exchange: 'HKEX',
      listingType: '18A',
      sector: 'biotech',
      subsector: '',
      filingDate: matching.publishDate,
      status: 'Pending',
      prospectus: {
        description: `Hong Kong IPO: ${matching.companyName}`,
        pipeline: [],
        lastFinancing: { round: 'IPO', amount: 'TBD', valuation: 'TBD', date: matching.publishDate },
        useOfProceeds: []
      },
      risks: [],
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    
    const ipoFilePath = path.join(process.cwd(), 'data', 'ipo-filings.json');
    let ipoData: any[] = [];
    try {
      ipoData = JSON.parse(fs.readFileSync(ipoFilePath, 'utf-8'));
    } catch {}
    
    const exists = ipoData.find((c: any) => c.id === newCompany.id);
    if (!exists) {
      ipoData.push(newCompany);
      fs.writeFileSync(ipoFilePath, JSON.stringify(ipoData, null, 2), 'utf-8');
    }
    
    return {
      symbol: newCompany.id,
      name: newCompany.name,
      nameEn: newCompany.nameEn,
      type: 'hk-ipo' as EntityType,
      exchange: 'HKEX',
      _score: 90,
    };
  } catch (error) {
    console.error('HKEX search error:', error);
    return null;
  }
}

function detectSearchType(query: string): {
  type: EntityType;
  symbol: string;
  exchange?: string;
} {
  const originalTrimmed = query.trim();
  const trimmed = originalTrimmed.toUpperCase();
  
  // Hong Kong stock code (5 digits like 00700, 01810)
  if (/^\d{5}$/.test(trimmed)) {
    return { type: 'hk-stock', symbol: `${trimmed}.HK`, exchange: 'HKEX' };
  }
  
  // Hong Kong stock with .HK suffix
  if (/^\d{4}\.HK$/i.test(trimmed)) {
    return { type: 'hk-stock', symbol: trimmed.toUpperCase(), exchange: 'HKEX' };
  }
  
  // US stock ticker (1-5 uppercase letters) - only if exact match (ASCII only)
  if (/^[A-Z]{1,5}$/.test(trimmed) && /^[A-Za-z]+$/.test(originalTrimmed)) {
    return { type: 'us-stock', symbol: trimmed };
  }
  
  // Crypto symbols (common ones)
  const cryptoSymbols = ['BTC', 'ETH', 'USDT', 'BNB', 'XRP', 'ADA', 'SOL', 'DOGE', 'DOT', 'MATIC'];
  if (cryptoSymbols.includes(trimmed)) {
    return { type: 'crypto', symbol: trimmed };
  }
  
  // Token in local database (VITA, BIO, etc)
  if (trimmed.match(/^(VITA|BIO|HAIR|LON|PSY)$/i)) {
    return { type: 'token', symbol: trimmed.toUpperCase() };
  }
  
  // Default: search as company name in local database first
  return { type: 'company-name', symbol: trimmed };
}

async function searchUSStock(symbol: string): Promise<SearchResult | null> {
  // Try stockprices.dev first
  let quote = await getQuote(symbol);
  
  // Try Yahoo Finance as backup
  if (!quote) {
    quote = await getQuoteFromYahoo(symbol);
  }
  
  // Try FMP as last resort
  if (!quote && process.env.FMP_API_KEY) {
    quote = await getQuoteFromFMP(symbol);
  }
  
  if (quote) {
    return {
      symbol: quote.symbol,
      name: quote.name,
      type: 'us-stock',
      price: quote.price,
      currency: quote.currency,
      change: quote.change,
      changePercent: quote.changePercent,
      marketCap: quote.marketCap,
      _score: 100,
    };
  }
  
  return null;
}

async function searchHKStock(symbol: string): Promise<SearchResult | null> {
  // Try Yahoo Finance for HK stocks
  const quote = await getQuoteFromYahoo(symbol);
  
  if (quote) {
    return {
      symbol: quote.symbol,
      name: quote.name,
      type: 'hk-stock',
      exchange: 'HKEX',
      price: quote.price,
      currency: 'HKD',
      change: quote.change,
      changePercent: quote.changePercent,
      marketCap: quote.marketCap,
      _score: 100,
    };
  }
  
  return null;
}

async function searchCrypto(symbol: string): Promise<SearchResult | null> {
  const price = await getTokenPriceFromCoinGecko(symbol.toLowerCase());
  
  if (price !== null) {
    return {
      symbol: symbol.toUpperCase(),
      name: getCryptoName(symbol),
      type: 'crypto',
      price: price,
      currency: 'USD',
      _score: 100,
    };
  }
  
  return null;
}

function getCryptoName(symbol: string): string {
  const names: Record<string, string> = {
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'USDT': 'Tether',
    'BNB': 'Binance Coin',
    'XRP': 'Ripple',
    'ADA': 'Cardano',
    'SOL': 'Solana',
    'DOGE': 'Dogecoin',
    'DOT': 'Polkadot',
    'MATIC': 'Polygon',
  };
  return names[symbol.toUpperCase()] || symbol;
}

function getErrorMessage(query: string, searchType: EntityType): { code: string; message: string } {
  switch (searchType) {
    case 'us-stock':
      return {
        code: 'NOT_FOUND',
        message: `Stock "${query}" not found. Please check the ticker symbol or try searching by company name.`
      };
    case 'hk-stock':
      return {
        code: 'NOT_FOUND',
        message: `Hong Kong stock "${query}" not found. Please check the stock code (5 digits, e.g., 00700).`
      };
    case 'crypto':
      return {
        code: 'NOT_FOUND',
        message: `Cryptocurrency "${query}" not found. Please check the token symbol.`
      };
    case 'hk-ipo':
      return {
        code: 'NOT_FOUND',
        message: `Hong Kong IPO company "${query}" not found.`
      };
    case 'preipo':
      return {
        code: 'NOT_FOUND',
        message: `Pre-IPO company "${query}" not found.`
      };
    case 'token':
      return {
        code: 'NOT_FOUND',
        message: `Token "${query}" not found.`
      };
    default:
      return {
        code: 'NOT_FOUND',
        message: `No results found for "${query}".`
      };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<SearchResponse>> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || searchParams.get('query');
  
  if (!query || query.trim().length === 0) {
    return NextResponse.json({
      success: false,
      data: [],
      error: { code: 'INVALID_PARAMS', message: 'Query is required' }
    }, { status: 400 });
  }
  
  const trimmed = query.trim();
  
  try {
    const { type, symbol, exchange } = detectSearchType(trimmed);
    const results: SearchResult[] = [];
    
    // For company names, search local database first
    if (type === 'company-name') {
      const localResults = await searchCompanies(trimmed, 10);
      
      for (const item of localResults) {
        results.push({
          symbol: item.symbol,
          name: item.name,
          nameEn: item.nameEn,
          type: item.type as EntityType,
          exchange: item.exchange,
          _score: item._score,
        });
      }
      
      // If no local results, try US stock as fallback
      if (results.length === 0) {
        const fallbackResult = await searchUSStock(trimmed.toUpperCase());
        if (fallbackResult) {
          results.push(fallbackResult);
        }
      }
      
      // If still no results, try HKEX (disclosure website)
      if (results.length === 0) {
        const hkexResult = await searchHKEXAndAddToDatabase(trimmed);
        if (hkexResult) {
          results.push(hkexResult);
        }
      }
    } 
    // If it looks like a direct ticker/symbol, try to get quote
    else if (type === 'us-stock' || type === 'hk-stock' || type === 'crypto') {
      let result: SearchResult | null = null;
      
      if (type === 'us-stock') {
        result = await searchUSStock(symbol);
      } else if (type === 'hk-stock') {
        result = await searchHKStock(symbol);
      } else if (type === 'crypto') {
        result = await searchCrypto(symbol);
      }
      
      if (result) {
        results.push(result);
      } else {
        // Return error with reason
        const error = getErrorMessage(trimmed, type);
        return NextResponse.json({
          success: false,
          data: [],
          error,
          meta: { query: trimmed, searchType: type }
        }, { status: 404 });
      }
    }
    
    // If still no results, try Companies API
      if (results.length === 0) {
        try {
          const companyData = await searchCompany(trimmed);
          if (companyData) {
            results.push({
              symbol: companyData.domain || companyData.name,
              name: companyData.name,
              nameEn: companyData.name,
              type: 'company-name' as EntityType,
              exchange: companyData.location || 'Unknown',
              _score: 10,
            });
          }
        } catch (e) {
          console.error('[Companies API] search error:', e);
        }
      }
      
      // If still no results, return error
      if (results.length === 0) {
        const error = {
          code: 'NOT_FOUND',
          message: `Company "${trimmed}" not found. Try searching by ticker symbol or company name.`
        };
        return NextResponse.json({
          success: false,
          data: [],
          error,
          meta: { query: trimmed, searchType: type }
        }, { status: 404 });
      }
    
    return NextResponse.json({
      success: true,
      data: results,
      meta: { query: trimmed, searchType: type }
    });
    
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({
      success: false,
      data: [],
      error: {
        code: 'SEARCH_ERROR',
        message: error instanceof Error ? error.message : 'Search failed. Please try again later.'
      }
    }, { status: 500 });
  }
}
