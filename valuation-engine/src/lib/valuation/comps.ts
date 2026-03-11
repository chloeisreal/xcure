import { getFinancials, getQuote } from '../data/stocks';
import { cacheGet, cacheSet, cacheKey } from '../data/cache';
import type { CompsResult, FinancialData, Quote } from '../data/types';

const BIOTECH_COMPARABLES: Record<string, string[]> = {
  'MRNA': ['BNTX', 'NVAX', 'VRMA', 'SGEN', 'REGN'],
  'BNTX': ['MRNA', 'NVAX', 'VRMA', 'REGN', 'ILMN'],
  'REGN': ['MRNA', 'SGEN', 'VRTX', 'BIIB', 'ALXN'],
  'VRTX': ['REGN', 'ALXN', 'BMY', 'GILD', 'ABBV'],
  'GILD': ['ABBV', 'BMY', 'MRNA', 'VRTX', 'BIIB'],
  'ILMN': ['DXCM', 'A', 'MTD', 'BRK.B', 'IDXX'],
  'EXAS': ['DXCM', 'ILMN', 'A', 'MTD', 'HOLX'],
  'DXCM': ['EXAS', 'ILMN', 'A', 'MTD', 'IDXX'],
  'BIIB': ['REGN', 'VRTX', 'ALXN', 'BMY', 'GILD'],
  'ALXN': ['VRTX', 'REGN', 'BIIB', 'BMY', 'GILD'],
};

export function getDefaultComparables(symbol: string): string[] {
  return BIOTECH_COMPARABLES[symbol.toUpperCase()] || ['REGN', 'VRTX', 'MRNA', 'GILD', 'BIIB'];
}

export async function getComparableData(symbol: string): Promise<{
  target: { financials: FinancialData; quote: Quote };
  comparables: Array<{ symbol: string; financials: FinancialData; quote: Quote }>;
} | null> {
  const [targetFinancials, targetQuote] = await Promise.all([
    getFinancials(symbol),
    getQuote(symbol),
  ]);

  if (!targetFinancials || !targetQuote) {
    return null;
  }

  const compSymbols = getDefaultComparables(symbol);
  const compResults = await Promise.all(
    compSymbols.map(async (comp) => {
      const [financials, quote] = await Promise.all([
        getFinancials(comp),
        getQuote(comp),
      ]);
      return financials && quote ? { symbol: comp, financials, quote } : null;
    })
  );

  const validComparables = compResults.filter((c): c is NonNullable<typeof c> => c !== null);

  return {
    target: { financials: targetFinancials, quote: targetQuote },
    comparables: validComparables,
  };
}

export function calculateCompsMetrics(
  comparables: Array<{ symbol: string; financials: FinancialData; quote: Quote }>
): { avgPE: number; avgPS: number; avgEVEBITDA: number; avgGrowth: number } {
  const validPE = comparables.filter(c => c.financials.peRatio && c.financials.peRatio > 0);
  const validPS = comparables.filter(c => c.financials.revenue && c.financials.revenue > 0 && c.quote.marketCap);
  const validGrowth = comparables.filter(c => c.financials.growthRate);

  const avgPE = validPE.length > 0
    ? validPE.reduce((sum, c) => sum + (c.financials.peRatio || 0), 0) / validPE.length
    : 0;

  const avgPS = validPS.length > 0
    ? validPS.reduce((sum, c) => sum + ((c.quote.marketCap || 0) / (c.financials.revenue || 1)), 0) / validPS.length
    : 0;

  const avgGrowth = validGrowth.length > 0
    ? validGrowth.reduce((sum, c) => sum + (c.financials.growthRate || 0), 0) / validGrowth.length
    : 0;

  return { avgPE, avgPS, avgGrowth, avgEVEBITDA: 0 };
}

export async function calculateComps(symbol: string): Promise<CompsResult | null> {
  const cacheKeyName = cacheKey('comps', symbol.toUpperCase());
  const cached = await cacheGet<CompsResult>(cacheKeyName);
  
  if (cached) {
    return cached;
  }

  const data = await getComparableData(symbol);
  
  if (!data || data.comparables.length === 0) {
    return null;
  }

  const { target, comparables } = data;
  const metrics = calculateCompsMetrics(comparables);

  let fairValue = target.quote.price;

  if (metrics.avgPE > 0 && target.financials.eps) {
    const peFairValue = target.financials.eps * metrics.avgPE;
    fairValue = (fairValue + peFairValue) / 2;
  }

  if (metrics.avgPS > 0 && target.financials.revenue) {
    const psFairValue = target.financials.revenue * metrics.avgPS / target.quote.marketCap * target.quote.price;
    fairValue = (fairValue + psFairValue) / 2;
  }

  const upside = ((fairValue - target.quote.price) / target.quote.price) * 100;

  const result: CompsResult = {
    method: 'Comps',
    fairValue: Math.round(fairValue * 100) / 100,
    upside: `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`,
    comparables: comparables.map(c => c.symbol),
    avgPE: Math.round(metrics.avgPE * 100) / 100,
    avgPS: Math.round(metrics.avgPS * 100) / 100,
  };

  await cacheSet(cacheKeyName, result, 86400);

  return result;
}
