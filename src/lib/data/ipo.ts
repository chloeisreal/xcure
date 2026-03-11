import fs from 'fs';
import path from 'path';
import { cacheGet, cacheSet, cacheKey } from './cache';
import { searchBiotechFilings, getCompanyFilings, extractProspectusData } from './sec';
import { getRecentHKEXFilings, createIPOCompanyFromHKEX, syncHKEXFilings } from './hkex';
import type { IPOCompany, ListingType } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

function loadJSON<T>(filename: string): T[] {
  const filepath = path.join(DATA_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
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

function saveJSON<T>(filename: string, data: T[]): void {
  const filepath = path.join(DATA_DIR, filename);
  
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error saving ${filename}:`, error);
  }
}

export async function getLocalIPOCompanies(): Promise<IPOCompany[]> {
  const cacheKeyName = cacheKey('ipo', 'local');
  const cached = await cacheGet<IPOCompany[]>(cacheKeyName);
  
  if (cached) {
    return cached;
  }
  
  const data = loadJSON<IPOCompany>('ipo-filings.json');
  await cacheSet(cacheKeyName, data, 604800);
  
  return data;
}

export async function getSECBiotechIPOs(): Promise<Partial<IPOCompany>[]> {
  const cacheKeyName = cacheKey('ipo', 'sec');
  const cached = await cacheGet<Partial<IPOCompany>[]>(cacheKeyName);
  
  if (cached && cached.length > 0) {
    return cached;
  }
  
  try {
    const filings = await searchBiotechFilings();
    
    const ipos: Partial<IPOCompany>[] = filings.map((filing) => ({
      id: `sec-${filing.cik}`,
      name: filing.companyName,
      exchange: 'NASDAQ',
      listingType: (filing.formType.includes('F-1') ? 'F-1' : 'S-1') as ListingType,
      sector: 'Biotechnology',
      subsector: 'Biotech',
      filingDate: filing.filedAt,
      status: 'Pending',
      prospectus: {
        description: `SEC filed ${filing.formType}`,
        pipeline: [],
      },
    }));
    
    if (ipos.length > 0) {
      await cacheSet(cacheKeyName, ipos, 86400);
    }
    
    return ipos;
  } catch (error) {
    console.error('SEC IPO search error:', error);
    return [];
  }
}

export async function getHKEXBiotechIPOs(): Promise<Partial<IPOCompany>[]> {
  const cacheKeyName = cacheKey('ipo', 'hkex');
  const cached = await cacheGet<Partial<IPOCompany>[]>(cacheKeyName);
  
  if (cached && cached.length > 0) {
    return cached;
  }
  
  try {
    const count = await syncHKEXFilings();
    console.log(`Synced ${count} HKEX filings`);
    
    const filings = await getRecentHKEXFilings(['A1'], 20);
    
    const ipos: Partial<IPOCompany>[] = filings.map((filing) => 
      createIPOCompanyFromHKEX(filing)
    );
    
    if (ipos.length > 0) {
      await cacheSet(cacheKeyName, ipos, 86400);
    }
    
    return ipos;
  } catch (error) {
    console.error('HKEX IPO search error:', error);
    return [];
  }
}

export async function getAllIPOCompanies(): Promise<IPOCompany[]> {
  const [local, sec, hkex] = await Promise.all([
    getLocalIPOCompanies(),
    getSECBiotechIPOs(),
    getHKEXBiotechIPOs(),
  ]);
  
  const combined: Record<string, IPOCompany> = {};
  
  local.forEach((company) => {
    combined[company.id] = company;
  });
  
  sec.forEach((company) => {
    if (!combined[company.id!]) {
      combined[company.id!] = company as IPOCompany;
    }
  });
  
  hkex.forEach((company) => {
    if (!combined[company.id!]) {
      combined[company.id!] = company as IPOCompany;
    }
  });
  
  return Object.values(combined);
}

export async function findIPOById(id: string): Promise<IPOCompany | null> {
  const companies = await getAllIPOCompanies();
  return companies.find((c) => c.id === id) || null;
}

export async function findIPOByName(name: string): Promise<IPOCompany | null> {
  const companies = await getAllIPOCompanies();
  const searchName = name.toLowerCase();
  
  return companies.find((c) => 
    c.name.toLowerCase().includes(searchName) ||
    c.nameEn?.toLowerCase().includes(searchName) ||
    c.hkexCode?.includes(name)
  ) || null;
}

export async function findIPOByTicker(ticker: string): Promise<IPOCompany | null> {
  const companies = await getAllIPOCompanies();
  const searchTicker = ticker.toUpperCase();
  
  return companies.find((c) => 
    c.hkexCode === searchTicker
  ) || null;
}

export async function refreshIPODatabase(): Promise<{
  total: number;
  local: number;
  sec: number;
  hkex: number;
}> {
  const [local, sec, hkex] = await Promise.all([
    getLocalIPOCompanies(),
    getSECBiotechIPOs(),
    getHKEXBiotechIPOs(),
  ]);
  
  return {
    total: local.length + sec.length + hkex.length,
    local: local.length,
    sec: sec.length,
    hkex: hkex.length,
  };
}

export { syncHKEXFilings };
