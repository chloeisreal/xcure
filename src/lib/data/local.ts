import fs from 'fs';
import path from 'path';
import { cacheGet, cacheSet } from './cache';
import { 
  IPOCompany, 
  PreIPOCompany, 
  TokenizedCompany, 
  ListedCompany 
} from './types';

export interface CompanySearchResult {
  symbol: string;
  name: string;
  nameEn?: string;
  type: 'ipo' | 'preipo' | 'token' | 'listed';
  exchange?: string;
  id: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');

function loadJSON<T>(filename: string): T[] {
  const filepath = path.join(DATA_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    console.warn(`Data file not found: ${filepath}`);
    return [];
  }
  
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return [];
  }
}

export async function getIPOCompanies(): Promise<IPOCompany[]> {
  const cacheKey = 'data:ipo-companies';
  const cached = await cacheGet<IPOCompany[]>(cacheKey);
  
  if (cached) return cached;
  
  const data = loadJSON<IPOCompany>('ipo-filings.json');
  await cacheSet(cacheKey, data, 604800);
  
  return data;
}

export const getLocalIPOCompanies = getIPOCompanies;

export async function getPreIPOCompanies(): Promise<PreIPOCompany[]> {
  const cacheKey = 'data:preipo-companies';
  const cached = await cacheGet<PreIPOCompany[]>(cacheKey);
  
  if (cached) return cached;
  
  const data = loadJSON<PreIPOCompany>('preipo-companies.json');
  await cacheSet(cacheKey, data, 604800);
  
  return data;
}

export async function getTokenizedBiotech(): Promise<TokenizedCompany[]> {
  const cacheKey = 'data:tokenized-biotech';
  const cached = await cacheGet<TokenizedCompany[]>(cacheKey);
  
  if (cached) return cached;
  
  const data = loadJSON<TokenizedCompany>('tokenized-biotech.json');
  await cacheSet(cacheKey, data, 3600);
  
  return data;
}

export async function findIPOById(id: string): Promise<IPOCompany | null> {
  const companies = await getIPOCompanies();
  return companies.find(c => c.id === id) || null;
}

export async function findIPOByName(name: string): Promise<IPOCompany | null> {
  const companies = await getIPOCompanies();
  const searchName = name.toLowerCase();
  return companies.find(c => 
    c.name.toLowerCase().includes(searchName) ||
    c.nameEn?.toLowerCase().includes(searchName)
  ) || null;
}

export async function findPreIPOById(id: string): Promise<PreIPOCompany | null> {
  const companies = await getPreIPOCompanies();
  return companies.find(c => c.id === id) || null;
}

export async function findPreIPOByName(name: string): Promise<PreIPOCompany | null> {
  const companies = await getPreIPOCompanies();
  const searchName = name.toLowerCase();
  return companies.find(c => 
    c.name.toLowerCase().includes(searchName) ||
    c.nameEn?.toLowerCase().includes(searchName)
  ) || null;
}

export async function findTokenBySymbol(symbol: string): Promise<TokenizedCompany | null> {
  const tokens = await getTokenizedBiotech();
  return tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase()) || null;
}

export async function getAllCompanies() {
  const [ipo, preipo, tokenized] = await Promise.all([
    getIPOCompanies(),
    getPreIPOCompanies(),
    getTokenizedBiotech(),
  ]);
  
  return {
    ipo,
    preipo,
    token: tokenized,
    listed: [] as ListedCompany[],
  };
}

export async function searchCompanies(query: string, limit: number = 10): Promise<CompanySearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const results: CompanySearchResult[] = [];
  const seen = new Set<string>();

  const [ipoCompanies, preipoCompanies, tokens] = await Promise.all([
    getIPOCompanies(),
    getPreIPOCompanies(),
    getTokenizedBiotech(),
  ]);

  function addIfMatch(
    company: { name: string; nameEn?: string; id: string; hkexCode?: string },
    type: 'ipo' | 'preipo' | 'token',
    exchange?: string
  ) {
    const name = company.name;
    const nameEn = company.nameEn || '';
    const matchKey = `${type}-${company.id}`;
    
    if (seen.has(matchKey)) return;
    
    const isMatch = 
      name.toLowerCase().includes(normalizedQuery) ||
      (nameEn && nameEn.toLowerCase().includes(normalizedQuery)) ||
      normalizedQuery.includes(name.toLowerCase()) ||
      normalizedQuery.includes(nameEn.toLowerCase()) ||
      (nameEn && normalizedQuery.includes(nameEn.toLowerCase()));
    
    if (isMatch) {
      seen.add(matchKey);
      results.push({
        symbol: (company as any).hkexCode || (company as any).symbol || company.id,
        name: company.name,
        nameEn: company.nameEn,
        type,
        exchange,
        id: company.id,
      });
    }
  }

  for (const company of ipoCompanies) {
    addIfMatch(company, 'ipo', company.exchange);
  }

  for (const company of preipoCompanies) {
    addIfMatch(company, 'preipo');
  }

  for (const token of tokens) {
    addIfMatch(token, 'token');
  }

  return results.slice(0, limit);
}
