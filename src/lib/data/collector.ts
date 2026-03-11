import fs from 'fs';
import path from 'path';
import { cacheGet, cacheSet, cacheKey } from './cache';
import { searchTrials } from './clinicaltrials';
import { searchRecentFilings, extractProspectusData } from './sec';
import { getRecentHKEXFilings } from './hkex';
import type { IPOCompany, PreIPOCompany, ClinicalTrial } from './types';

const PENDING_DIR = path.join(process.cwd(), 'data', 'pending');
const COLLECTION_CACHE_KEY = 'collector:pending';

interface CollectedCompany {
  id: string;
  name: string;
  type: 'ipo' | 'preipo';
  sources: string[];
  data: Partial<IPOCompany | PreIPOCompany>;
  collectedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  aiAnalysis?: string;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getPendingFile(): string {
  ensureDir(PENDING_DIR);
  return path.join(PENDING_DIR, 'companies.json');
}

function loadPending(): CollectedCompany[] {
  const file = getPendingFile();
  if (!fs.existsSync(file)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function savePending(companies: CollectedCompany[]): void {
  const file = getPendingFile();
  fs.writeFileSync(file, JSON.stringify(companies, null, 2), 'utf-8');
}

export async function collectCompany(
  name: string,
  type: 'ipo' | 'preipo'
): Promise<{
  success: boolean;
  id: string;
  message: string;
}> {
  const id = `collected-${Date.now()}-${name.toLowerCase().replace(/\s+/g, '-')}`;
  
  const sources: string[] = [];
  const collectedData: Partial<IPOCompany | PreIPOCompany> = {
    id,
    name,
    lastUpdated: new Date().toISOString(),
  };

  try {
    const trials = await searchTrials(name, { limit: 10 });
    if (trials.length > 0) {
      sources.push('clinicaltrials.gov');
      (collectedData as any).pipeline = trials.map(t => ({
        drug: t.intervention,
        indication: t.conditions[0] || 'Unknown',
        phase: t.phase,
        status: t.status,
        note: t.nctId,
      })) as ClinicalTrial[];
    }
  } catch (error) {
    console.error('ClinicalTrials collection error:', error);
  }

  try {
    const secFilings = await searchRecentFilings(['S-1', 'F-1'], undefined, undefined);
    const matchingFiling = secFilings.find(f => 
      f.companyName.toLowerCase().includes(name.toLowerCase())
    );
    if (matchingFiling) {
      sources.push('sec.gov');
      const prospectus = await extractProspectusData(matchingFiling.cik);
      if (prospectus) {
        (collectedData as any).prospectus = {
          description: prospectus.description,
          pipeline: (collectedData as any).pipeline || [],
        };
        (collectedData as any).exchange = 'NASDAQ';
        (collectedData as any).listingType = prospectus.formType;
        (collectedData as any).filingDate = prospectus.filedAt;
        (collectedData as any).status = 'Pending';
      }
    }
  } catch (error) {
    console.error('SEC collection error:', error);
  }

  try {
    const hkexFilings = await getRecentHKEXFilings(['A1'], 20);
    const matchingHKEX = hkexFilings.find(f => 
      f.companyName.includes(name) || name.includes(f.companyName)
    );
    if (matchingHKEX) {
      sources.push('hkexnews.hk');
      (collectedData as any).hkexCode = matchingHKEX.stockCode;
      (collectedData as any).exchange = 'HKEX';
      (collectedData as any).listingType = '18A';
      (collectedData as any).filingDate = matchingHKEX.publishDate;
      (collectedData as any).status = 'Pending';
    }
  } catch (error) {
    console.error('HKEX collection error:', error);
  }

  const pending = loadPending();
  
  const newCompany: CollectedCompany = {
    id,
    name,
    type,
    sources,
    data: collectedData,
    collectedAt: new Date().toISOString(),
    status: 'pending',
  };

  pending.push(newCompany);
  savePending(pending);

  return {
    success: true,
    id,
    message: sources.length > 0 
      ? `Company collected from ${sources.join(', ')}`
      : 'Company added to pending list for manual review',
  };
}

export async function getPendingCompanies(): Promise<CollectedCompany[]> {
  return loadPending();
}

export async function approveCompany(id: string): Promise<boolean> {
  const pending = loadPending();
  const index = pending.findIndex(c => c.id === id);
  
  if (index === -1) {
    return false;
  }

  pending[index].status = 'approved';
  savePending(pending);

  return true;
}

export async function rejectCompany(id: string): Promise<boolean> {
  const pending = loadPending();
  const index = pending.findIndex(c => c.id === id);
  
  if (index === -1) {
    return false;
  }

  pending[index].status = 'rejected';
  savePending(pending);

  return true;
}

export async function getCollectionStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}> {
  const pending = loadPending();
  
  return {
    total: pending.length,
    pending: pending.filter(c => c.status === 'pending').length,
    approved: pending.filter(c => c.status === 'approved').length,
    rejected: pending.filter(c => c.status === 'rejected').length,
  };
}

export async function autoCollectAndSave(
  name: string,
  type: 'ipo' | 'preipo'
): Promise<{
  collected: boolean;
  data?: Partial<IPOCompany | PreIPOCompany>;
}> {
  const result = await collectCompany(name, type);
  
  if (result.success && result.message.includes('collected from')) {
    const pending = loadPending();
    const company = pending.find(c => c.id === result.id);
    
    if (company) {
      return {
        collected: true,
        data: company.data,
      };
    }
  }
  
  return { collected: false };
}
