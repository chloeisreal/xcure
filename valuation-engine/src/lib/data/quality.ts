import { cacheGet, cacheSet } from './cache';
import { getLocalIPOCompanies, getPreIPOCompanies, getTokenizedBiotech } from './local';
import { getQuote, getFinancials } from './stocks';
import { syncClinicalTrialsForCompany } from './clinicaltrials';

interface QualityIssue {
  type: 'missing_data' | 'stale_data' | 'invalid_value' | 'inconsistency';
  severity: 'high' | 'medium' | 'low';
  entity: string;
  field?: string;
  message: string;
  suggestedFix?: string;
}

interface DataQualityReport {
  timestamp: string;
  totalCompanies: number;
  issues: QualityIssue[];
  summary: {
    high: number;
    medium: number;
    low: number;
  };
  coverage: {
    price: number;
    financials: number;
    pipeline: number;
  };
}

export async function checkDataQuality(): Promise<DataQualityReport> {
  const issues: QualityIssue[] = [];
  
  const [ipo, preipo, tokenized] = await Promise.all([
    getLocalIPOCompanies(),
    getPreIPOCompanies(),
    getTokenizedBiotech(),
  ]);

  const allCompanies = [...ipo, ...preipo, ...tokenized];

  for (const company of allCompanies) {
    if (company.type === 'listed' || 'symbol' in company) {
      const symbol = 'symbol' in company ? company.symbol : company.id;
      const quote = await getQuote(symbol);
      
      if (!quote) {
        issues.push({
          type: 'missing_data',
          severity: 'high',
          entity: company.name,
          field: 'price',
          message: `No price data available for ${company.name}`,
          suggestedFix: 'Check if symbol is correct or data source is available',
        });
      }

      if (quote && quote.price <= 0) {
        issues.push({
          type: 'invalid_value',
          severity: 'high',
          entity: company.name,
          field: 'price',
          message: `Invalid price: ${quote.price}`,
          suggestedFix: 'Verify data source',
        });
      }
    }

    if ('prospectus' in company && company.prospectus) {
      if (!company.prospectus.description) {
        issues.push({
          type: 'missing_data',
          severity: 'medium',
          entity: company.name,
          field: 'description',
          message: 'Missing company description',
          suggestedFix: 'Add description from prospectus',
        });
      }
    }

    if ('pipeline' in company && company.pipeline) {
      if (company.pipeline.length === 0) {
        issues.push({
          type: 'missing_data',
          severity: 'low',
          entity: company.name,
          field: 'pipeline',
          message: 'No clinical pipeline data',
          suggestedFix: 'Sync with ClinicalTrials.gov',
        });
      }

      for (const trial of company.pipeline) {
        if (!trial.indication) {
          issues.push({
            type: 'missing_data',
            severity: 'low',
            entity: company.name,
            field: 'trial.indication',
            message: 'Missing trial indication',
          });
        }
      }
    }

    if ('lastFunding' in company && company.lastFunding) {
      if (!company.lastFunding.valuation || company.lastFunding.valuation <= 0) {
        issues.push({
          type: 'invalid_value',
          severity: 'medium',
          entity: company.name,
          field: 'valuation',
          message: 'Invalid or missing valuation',
        });
      }

      if (company.lastFunding.date) {
        const fundingDate = new Date(company.lastFunding.date);
        const monthsAgo = (Date.now() - fundingDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        
        if (monthsAgo > 18) {
          issues.push({
            type: 'stale_data',
            severity: 'medium',
            entity: company.name,
            field: 'lastFunding.date',
            message: `Funding data is ${Math.round(monthsAgo)} months old`,
            suggestedFix: 'Update with latest funding round',
          });
        }
      }
    }
  }

  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;

  const companiesWithPrice = allCompanies.filter(c => 'symbol' in c).length;
  const companiesWithPipeline = allCompanies.filter(c => 'pipeline' in c && (c as any).pipeline?.length > 0).length;

  return {
    timestamp: new Date().toISOString(),
    totalCompanies: allCompanies.length,
    issues,
    summary: {
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    },
    coverage: {
      price: companiesWithPrice / allCompanies.length,
      financials: 0,
      pipeline: companiesWithPipeline / allCompanies.length,
    },
  };
}

export async function runDataHealthCheck(): Promise<{
  healthy: boolean;
  checks: Array<{ name: string; status: 'pass' | 'fail' | 'warn'; message: string }>;
}> {
  const checks = [];

  try {
    const quote = await getQuote('MRNA');
    checks.push({
      name: 'Stock Data Source',
      status: quote ? 'pass' : 'fail',
      message: quote ? ' Able to fetch stock data' : ' Failed to fetch stock data',
    });
  } catch {
    checks.push({
      name: 'Stock Data Source',
      status: 'fail',
      message: ' Exception when fetching stock data',
    });
  }

  try {
    const trials = await syncClinicalTrialsForCompany('Moderna', true);
    checks.push({
      name: 'ClinicalTrials.gov',
      status: trials.synced > 0 ? 'pass' : 'warn',
      message: ` Found ${trials.synced} trials`,
    });
  } catch {
    checks.push({
      name: 'ClinicalTrials.gov',
      status: 'warn',
      message: ' Unable to sync clinical trials',
    });
  }

  try {
    const [ipo, preipo] = await Promise.all([
      getLocalIPOCompanies(),
      getPreIPOCompanies(),
    ]);
    checks.push({
      name: 'Local Data',
      status: ipo.length + preipo.length > 0 ? 'pass' : 'warn',
      message: ` Loaded ${ipo.length} IPO, ${preipo.length} Pre-IPO companies`,
    });
  } catch {
    checks.push({
      name: 'Local Data',
      status: 'fail',
      message: ' Failed to load local data',
    });
  }

  const healthy = checks.filter(c => c.status === 'fail').length === 0;

  return { healthy, checks };
}

export async function getDataCoverageReport(): Promise<{
  totalCompanies: number;
  byType: Record<string, number>;
  withPrice: number;
  withPipeline: number;
  withFinancials: number;
}> {
  const [ipo, preipo, tokenized] = await Promise.all([
    getLocalIPOCompanies(),
    getPreIPOCompanies(),
    getTokenizedBiotech(),
  ]);

  const all = [...ipo, ...preipo, ...tokenized];
  
  let withPrice = 0;
  let withPipeline = 0;
  let withFinancials = 0;

  for (const company of all) {
    const symbol = 'symbol' in company ? company.symbol : null;
    if (symbol) {
      const quote = await getQuote(symbol);
      if (quote) withPrice++;
    }
    
    if ('pipeline' in company && (company as any).pipeline?.length > 0) {
      withPipeline++;
    }
    
    if (symbol) {
      const financials = await getFinancials(symbol);
      if (financials) withFinancials++;
    }
  }

  return {
    totalCompanies: all.length,
    byType: {
      ipo: ipo.length,
      preipo: preipo.length,
      token: tokenized.length,
    },
    withPrice,
    withPipeline,
    withFinancials,
  };
}
