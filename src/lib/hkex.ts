import { cacheGet, cacheSet, cacheKey } from './cache';
import type { IPOCompany, ClinicalTrial } from './types';

const HKEX_SEARCH_URL = 'https://www1.hkexnews.hk/search';

const ENABLE_HKEX_FETCH = process.env.ENABLE_HKEX_FETCH === 'true';

interface HKEXFiling {
  stockCode: string;
  companyName: string;
  companyNameEn: string;
  documentType: string;
  publishDate: string;
  url: string;
}

async function fetchHKEX(url: string): Promise<string> {
  if (!ENABLE_HKEX_FETCH) {
    return '';
  }
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; XCure/1.0)',
      'Accept': 'text/html,application/json',
    },
  });
  
  if (!response.ok) {
    console.log(`HKEX fetch error: ${response.status}`);
    return '';
  }
  
  return response.text();
}

export async function getRecentHKEXFilings(
  documentTypes: string[] = ['A1', 'A2', 'PROSP'],
  limit: number = 50
): Promise<HKEXFiling[]> {
  if (!ENABLE_HKEX_FETCH) {
    console.log('[HKEX] Fetch disabled. Set ENABLE_HKEX_FETCH=true to enable.');
    return [];
  }
  
  const filings: HKEXFiling[] = [];
  
  for (const docType of documentTypes) {
    try {
      const url = `${HKEX_SEARCH_URL}/tips?s=1&c=${limit}&o=desc&sortBy=PUBLISH_DATE&docType=${docType}`;
      const html = await fetchHKEX(url);
      
      if (!html || html.length < 100) {
        continue;
      }
      
      const codeMatch = html.match(/stockCode["']?\s*:\s*["']?(\d+)/g);
      const nameMatch = html.match(/companyName["']?\s*:\s*["']([^"']+)/g);
      const dateMatch = html.match(/publishDate["']?\s*:\s*["']([\d-]+)/g);
      
      const count = Math.min(
        codeMatch?.length || 0,
        nameMatch?.length || 0,
        dateMatch?.length || 0
      );
      
      for (let i = 0; i < count; i++) {
        const stockCode = codeMatch?.[i]?.match(/\d+/)?.[0] || '';
        const companyName = nameMatch?.[i]?.replace(/companyName["']?\s*:\s*["']/, '') || '';
        const publishDate = dateMatch?.[i]?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '';
        
        if (stockCode && companyName) {
          filings.push({
            stockCode,
            companyName,
            companyNameEn: '',
            documentType: docType,
            publishDate,
            url: `https://www1.hkexnews.hk/app/appnews/corpinfo/${stockCode}.html`,
          });
        }
      }
    } catch (error) {
      console.error(`HKEX ${docType} error:`, error);
    }
  }
  
  return filings.slice(0, limit);
}

export function createIPOCompanyFromHKEX(filing: HKEXFiling): Partial<IPOCompany> {
  const sector = guessSector(filing.companyName);
  
  return {
    id: `hkex-${filing.stockCode}`,
    name: filing.companyName,
    nameEn: filing.companyNameEn,
    hkexCode: filing.stockCode,
    exchange: 'HKEX',
    listingType: '18A',
    sector: (sector.category as any) || 'biotech',
    subsector: sector.subsector,
    filingDate: filing.publishDate,
    status: 'Pending',
    prospectus: {
      description: `Hong Kong listed company: ${filing.companyName}`,
      pipeline: [],
      lastFinancing: {
        round: 'IPO',
        amount: 'TBD',
        valuation: 'TBD',
        date: filing.publishDate,
      },
      useOfProceeds: [],
    },
    lastUpdated: new Date().toISOString(),
  };
}

function guessSector(companyName: string): { category: string; subsector: string } {
  const name = companyName.toLowerCase();
  
  if (name.includes('生物') || name.includes('biotech') || name.includes('bio') || 
      name.includes('药') || name.includes('pharma') || name.includes('医')) {
    return { category: '生物科技', subsector: '生物医药' };
  }
  
  if (name.includes('医疗') || name.includes('medical') || name.includes('health')) {
    return { category: '医疗健康', subsector: '医疗器械' };
  }
  
  if (name.includes('科技') || name.includes('tech')) {
    return { category: '科技', subsector: '软件' };
  }
  
  if (name.includes('新能源') || name.includes('energy')) {
    return { category: '新能源', subsector: '清洁能源' };
  }
  
  return { category: '其他', subsector: '综合' };
}

export async function syncHKEXFilings(): Promise<number> {
  if (!ENABLE_HKEX_FETCH) {
    console.log('[HKEX] sync disabled. Set ENABLE_HKEX_FETCH=true to enable.');
    return 0;
  }
  
  const cacheKeyName = cacheKey('hkex', 'filings');
  const cached = await cacheGet<HKEXFiling[]>(cacheKeyName);
  
  if (cached && cached.length > 0) {
    return cached.length;
  }
  
  const filings = await getRecentHKEXFilings(['A1'], 30);
  
  if (filings.length > 0) {
    await cacheSet(cacheKeyName, filings, 604800);
  }
  
  return filings.length;
}