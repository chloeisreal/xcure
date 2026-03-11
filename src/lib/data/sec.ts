import { cacheGet, cacheSet, cacheKey } from './cache';
import type { IPOCompany } from './types';

const SEC_API_BASE = 'https://data.sec.gov';
const EDGAR_SEARCH = 'https://efts.sec.gov/LATEST/search-index';

interface SECFiling {
  id: string;
  cik: string;
  companyName: string;
  formType: string;
  filedAt: string;
  acceptedAt: string;
}

interface SECCompanyInfo {
  name: string;
  cik: string;
  ticker?: string;
  exchange?: string;
  sic?: string;
  stateOfIncorporation?: string;
}

const USER_AGENT = 'XCure valuation contact@xcure.ai';

async function fetchWithHeaders(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`SEC API error: ${response.status}`);
  }
  
  return response;
}

export async function searchRecentFilings(
  formTypes: string[] = ['S-1', 'F-1', 'S-1/A', 'F-1/A'],
  startDate?: string,
  endDate?: string
): Promise<SECFiling[]> {
  const params = new URLSearchParams({
    q: '*',
    dateRange: 'custom',
    startdt: startDate || '2024-01-01',
    enddt: endDate || new Date().toISOString().split('T')[0],
    forms: formTypes.join(','),
  });

  const url = `${EDGAR_SEARCH}?${params.toString()}`;
  
  try {
    const response = await fetchWithHeaders(url);
    const data = await response.json();
    
    if (!data.hits?.hits) {
      return [];
    }

    return data.hits.hits.map((hit: any) => ({
      id: hit._id,
      cik: hit._source.cik,
      companyName: hit._source.companyNames?.[0] || hit._source.companyName,
      formType: hit._source.form,
      filedAt: hit._source.filedAt,
      acceptedAt: hit._source.acceptedAt,
    }));
  } catch (error) {
    console.error('SEC search error:', error);
    return [];
  }
}

export async function getCompanyFilings(cik: string): Promise<SECCompanyInfo | null> {
  const paddedCIK = cik.padStart(10, '0');
  const url = `${SEC_API_BASE}/submissions/CIK${paddedCIK}.json`;

  try {
    const response = await fetchWithHeaders(url);
    const data = await response.json();
    
    if (!data.name) {
      return null;
    }

    return {
      name: data.name,
      cik: data.cik,
      ticker: data.tickers?.[0],
      exchange: data.exchanges?.[0],
      sic: data.sic,
      stateOfIncorporation: data.stateOfIncorporation,
    };
  } catch (error) {
    console.error('SEC company info error:', error);
    return null;
  }
}

export async function getCompanyFilingsList(cik: string): Promise<{
  recentFilings: Array<{ form: string; filedAt: string; description: string }>;
}> {
  const paddedCIK = cik.padStart(10, '0');
  const url = `${SEC_API_BASE}/submissions/CIK${paddedCIK}.json`;

  try {
    const response = await fetchWithHeaders(url);
    const data = await response.json();
    
    const recentFilings = (data.recent?.form || [])
      .slice(0, 20)
      .map((form: string, index: number) => ({
        form,
        filedAt: data.recent.filedAt?.[index] || '',
        description: data.recent.description?.[index] || form,
      }));

    return { recentFilings };
  } catch (error) {
    console.error('SEC filings list error:', error);
    return { recentFilings: [] };
  }
}

export async function getS1Content(cik: string): Promise<string | null> {
  const paddedCIK = cik.padStart(10, '0');
  const url = `${SEC_API_BASE}/submissions/CIK${paddedCIK}.json`;

  try {
    const response = await fetchWithHeaders(url);
    const data = await response.json();
    
    const s1Filings = data.recent?.form?.filter((f: string) => f === 'S-1' || f === 'F-1') || [];
    
    if (s1Filings.length === 0) {
      return null;
    }

    const latestS1Index = 0;
    const accessionNumber = data.recent.accessionNumber?.[latestS1Index];
    const primaryDocument = data.recent.primaryDocument?.[latestS1Index];
    
    if (!primaryDocument) {
      return null;
    }

    const filingUrl = `${SEC_API_BASE}/Archives/edgar/data/${paddedCIK}/${accessionNumber.replace(/-/g, '')}/${primaryDocument}`;
    
    const filingResponse = await fetch(filingUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });

    return await filingResponse.text();
  } catch (error) {
    console.error('S-1 content error:', error);
    return null;
  }
}

export async function extractProspectusData(cik: string): Promise<{
  companyName: string;
  formType: string;
  filedAt: string;
  estimatedProceeds?: number;
  description?: string;
} | null> {
  const companyInfo = await getCompanyFilings(cik);
  
  if (!companyInfo) {
    return null;
  }

  const { recentFilings } = await getCompanyFilingsList(cik);
  const s1Filing = recentFilings.find((f: any) => f.form === 'S-1' || f.form === 'F-1');

  return {
    companyName: companyInfo.name,
    formType: s1Filing?.form || 'S-1',
    filedAt: s1Filing?.filedAt || '',
    estimatedProceeds: undefined,
    description: undefined,
  };
}

export async function searchBiotechFilings(): Promise<Array<{
  companyName: string;
  cik: string;
  formType: string;
  filedAt: string;
  ticker?: string;
}>> {
  const filings = await searchRecentFilings(['S-1', 'F-1', 'S-1/A', 'F-1/A']);
  
  const biotechKeywords = [
    'biotech', 'biopharma', 'pharma', 'therapeutics', 'drug',
    'cancer', 'oncology', 'gene', 'cell', 'bio', 'medicine',
    'health', 'clinical', 'bioscience', 'life science'
  ];

  const biotechFilings = filings.filter((filing) => {
    const name = filing.companyName.toLowerCase();
    return biotechKeywords.some((keyword) => name.includes(keyword));
  });

  const results = await Promise.all(
    biotechFilings.slice(0, 20).map(async (filing) => {
      const info = await getCompanyFilings(filing.cik);
      return {
        companyName: filing.companyName,
        cik: filing.cik,
        formType: filing.formType,
        filedAt: filing.filedAt,
        ticker: info?.ticker,
      };
    })
  );

  return results.filter(r => r.companyName);
}

export function cikFromTicker(ticker: string): Promise<string | null> {
  return (async () => {
    try {
      const url = `${SEC_API_BASE}/submissions/CIK${ticker.toUpperCase()}.json`;
      const response = await fetchWithHeaders(url);
      const data = await response.json();
      return data.cik || null;
    } catch {
      return null;
    }
  })();
}
