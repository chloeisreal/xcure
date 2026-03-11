import { cacheGet, cacheSet, cacheKey } from './cache';
import type { ClinicalTrial, ClinicalPhase } from './types';

const CLINICALTRIALS_API = 'https://clinicaltrials.gov/api/v2/studies';

interface ClinicalTrialsResponse {
  studies: Array<{
    protocolSection: {
      identificationModule: {
        nctId: string;
        briefTitle: string;
        organization: {
          fullName: string;
        };
      };
      statusModule: {
        overallStatus: string;
      };
      descriptionModule?: {
        briefSummary?: string;
      };
      armsInterventionsModule?: {
        interventions?: Array<{ type: string; name: string }>;
      };
      conditionsModule?: {
        conditions?: string[];
      };
    };
  }>;
  totalCount: number;
}

interface TrialData {
  nctId: string;
  title: string;
  sponsor: string;
  status: string;
  phase: ClinicalPhase;
  conditions: string[];
  intervention: string;
  summary?: string;
}

async function fetchWithTimeout(url: string, timeout = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function searchTrials(
  query: string,
  options?: {
    phases?: string[];
    status?: string[];
    limit?: number;
  }
): Promise<TrialData[]> {
  const params = new URLSearchParams({
    query: { term: query }.term,
    pageSize: String(options?.limit || 20),
    fields: 'NCTId,BriefTitle,OrganizationFullName,OverallStatus,Phase,Conditions,Interventions,BriefSummary',
  });

  try {
    const url = `${CLINICALTRIALS_API}?${params.toString()}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      throw new Error(`ClinicalTrials API error: ${response.status}`);
    }
    
    const data: ClinicalTrialsResponse = await response.json();
    
    return (data.studies || []).map((study) => {
      const identification = study.protocolSection.identificationModule;
      const status = study.protocolSection.statusModule;
      const description = study.protocolSection.descriptionModule;
      const conditions = study.protocolSection.conditionsModule;
      const interventions = study.protocolSection.armsInterventionsModule;
      
      return {
        nctId: identification.nctId,
        title: identification.briefTitle,
        sponsor: identification.organization?.fullName || '',
        status: status.overallStatus,
        phase: normalizePhase(status.overallStatus),
        conditions: conditions?.conditions || [],
        intervention: interventions?.interventions?.[0]?.name || '',
        summary: description?.briefSummary,
      };
    });
  } catch (error) {
    console.error('ClinicalTrials search error:', error);
    return [];
  }
}

export async function getCompanyTrials(companyName: string): Promise<TrialData[]> {
  return searchTrials(companyName, { limit: 50 });
}

function normalizePhase(status: string): ClinicalPhase {
  const s = status.toUpperCase();
  
  if (s.includes('NOT YET') || s.includes('PRECLINICAL')) {
    return 'Preclinical';
  }
  if (s.includes('PHASE 1') || s.includes('PHASE I')) {
    return 'Phase I';
  }
  if (s.includes('PHASE 2') || s.includes('PHASE II')) {
    return 'Phase II';
  }
  if (s.includes('PHASE 3') || s.includes('PHASE III')) {
    return 'Phase III';
  }
  if (s.includes('APPROVED') || s.includes('COMPLETED')) {
    return 'Approved';
  }
  
  return 'Phase I';
}

export async function syncClinicalTrialsForCompany(
  companyName: string,
  force = false
): Promise<{
  synced: number;
  cached: boolean;
}> {
  const cacheKeyName = cacheKey('clinicaltrials', companyName.toLowerCase());
  
  if (!force) {
    const cached = await cacheGet<TrialData[]>(cacheKeyName);
    if (cached && cached.length > 0) {
      return { synced: cached.length, cached: true };
    }
  }
  
  const trials = await getCompanyTrials(companyName);
  
  if (trials.length > 0) {
    await cacheSet(cacheKeyName, trials, 604800);
  }
  
  return { synced: trials.length, cached: false };
}

export async function syncAllKnownCompanies(): Promise<{
  total: number;
  companies: Record<string, number>;
  duration: string;
}> {
  const knownCompanies = [
    'Moderna',
    'BioNTech',
    'Regeneron',
    'Vertex',
    'Gilead',
    'Amgen',
    'Biogen',
    'Illumina',
    'Dexcom',
    'Exact Sciences',
    'Roivant',
    'Recursion',
    'Exscientia',
    'Insilico Medicine',
    'Generate Biomedicines',
  ];

  const results: Record<string, number> = {};
  const startTime = Date.now();

  const promises = knownCompanies.map(async (company) => {
    const result = await syncClinicalTrialsForCompany(company);
    results[company] = result.synced;
  });

  await Promise.allSettled(promises);

  return {
    total: Object.values(results).reduce((sum, count) => sum + count, 0),
    companies: results,
    duration: `${Date.now() - startTime}ms`,
  };
}

export async function getTrialByNCT(nctId: string): Promise<TrialData | null> {
  try {
    const url = `${CLINICALTRIALS_API}/${nctId}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const identification = data.protocolSection.identificationModule;
    const status = data.protocolSection.statusModule;
    const description = data.protocolSection.descriptionModule;
    const conditions = data.protocolSection.conditionsModule;
    const interventions = data.protocolSection.armsInterventionsModule;
    
    return {
      nctId: identification.nctId,
      title: identification.briefTitle,
      sponsor: identification.organization?.fullName || '',
      status: status.overallStatus,
      phase: normalizePhase(status.overallStatus),
      conditions: conditions?.conditions || [],
      intervention: interventions?.interventions?.[0]?.name || '',
      summary: description?.briefSummary,
    };
  } catch (error) {
    console.error(`Trial ${nctId} fetch error:`, error);
    return null;
  }
}

export function extractPipelineFromTrials(trials: TrialData[]): ClinicalTrial[] {
  return trials.map((trial) => ({
    drug: trial.intervention || trial.title,
    indication: trial.conditions[0] || 'Unknown',
    phase: trial.phase,
    status: trial.status,
    note: trial.nctId,
  }));
}
