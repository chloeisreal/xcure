import fs from 'fs';
import path from 'path';
import { cacheGet, cacheSet } from './cache';
import { 
  IPOCompany, 
  PreIPOCompany, 
  TokenizedCompany, 
  ListedCompany 
} from './types';

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
