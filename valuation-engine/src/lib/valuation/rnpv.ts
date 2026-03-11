import type { rNPVResult, ClinicalPhase, ClinicalTrial } from '../data/types';

const PHASE_SUCCESS_RATES: Record<ClinicalPhase, number> = {
  'Preclinical': 0.10,
  'Phase I': 0.25,
  'Phase II': 0.35,
  'Phase III': 0.55,
  'Approved': 1.0,
};

const PEAK_SALES_ESTIMATES: Record<string, number> = {
  'Oncology': 5000000000,
  'Autoimmune': 3000000000,
  'Cardiovascular': 4000000000,
  'Neurology': 3500000000,
  'Rare Disease': 1500000000,
  'default': 1000000000,
};

const PATENT_YEARS = 15;
const DISCOUNT_RATE = 0.12;
const COMMERCIALIZATION_YEARS = 5;

export function getSuccessRate(phase: ClinicalPhase): number {
  return PHASE_SUCCESS_RATES[phase] || 0.1;
}

export function getPeakSalesEstimate(indication: string): number {
  const upper = indication.toUpperCase();
  
  if (upper.includes('CANCER') || upper.includes('ONCO')) return PEAK_SALES_ESTIMATES['Oncology'];
  if (upper.includes('AUTOIMMUNE') || upper.includes('INFLAMM')) return PEAK_SALES_ESTIMATES['Autoimmune'];
  if (upper.includes('HEART') || upper.includes('CARDIO')) return PEAK_SALES_ESTIMATES['Cardiovascular'];
  if (upper.includes('NEURO') || upper.includes('ALZHEIMER') || upper.includes('PARKINSON')) return PEAK_SALES_ESTIMATES['Neurology'];
  if (upper.includes('RARE') || upper.includes('ORPHAN')) return PEAK_SALES_ESTIMATES['Rare Disease'];
  
  return PEAK_SALES_ESTIMATES['default'];
}

export function calculateTrialNPV(trial: ClinicalTrial, currentYear: number = 2025): {
  nPV: number;
  riskAdjustedNPV: number;
  successRate: number;
  peakSales: number;
} {
  const successRate = getSuccessRate(trial.phase);
  const peakSales = getPeakSalesEstimate(trial.indication);
  
  let launchYear = currentYear + 3;
  if (trial.phase === 'Phase III') launchYear = currentYear + 2;
  if (trial.phase === 'Phase II') launchYear = currentYear + 4;
  if (trial.phase === 'Phase I') launchYear = currentYear + 5;
  
  const yearsToLaunch = launchYear - currentYear;
  
  let totalNPV = 0;
  let riskAdjustedNPV = 0;
  
  const rampUpYears = 3;
  const peakYear = launchYear + rampUpYears;
  
  for (let year = 0; year < PATENT_YEARS; year++) {
    const actualYear = currentYear + year;
    
    let annualRevenue = 0;
    
    if (actualYear >= launchYear) {
      const yearsOnMarket = actualYear - launchYear;
      
      if (yearsOnMarket < rampUpYears) {
        annualRevenue = peakSales * (yearsOnMarket + 1) / rampUpYears;
      } else if (yearsOnMarket < rampUpYears + 2) {
        annualRevenue = peakSales * (1 - (yearsOnMarket - rampUpYears) * 0.1);
      } else {
        annualRevenue = peakSales * 0.7;
      }
    }
    
    const netRevenue = annualRevenue * 0.7;
    const discountFactor = Math.pow(1 + DISCOUNT_RATE, year + 1);
    
    const yearNPV = netRevenue / discountFactor;
    totalNPV += yearNPV;
    
    const cumulativeSuccessRate = successRate * Math.pow(0.95, yearsToLaunch);
    riskAdjustedNPV += yearNPV * cumulativeSuccessRate;
  }
  
  const developmentCost = getDevelopmentCost(trial.phase);
  const costNPV = developmentCost / Math.pow(1 + DISCOUNT_RATE, yearsToLaunch);
  
  const finalNPV = totalNPV - costNPV;
  const finalRiskAdjustedNPV = riskAdjustedNPV - costNPV * successRate;
  
  return {
    nPV: Math.round(finalNPV),
    riskAdjustedNPV: Math.round(finalRiskAdjustedNPV),
    successRate,
    peakSales,
  };
}

function getDevelopmentCost(phase: ClinicalPhase): number {
  const costs: Record<ClinicalPhase, number> = {
    'Preclinical': 5000000,
    'Phase I': 15000000,
    'Phase II': 40000000,
    'Phase III': 150000000,
    'Approved': 0,
  };
  return costs[phase] || 5000000;
}

export function calculatePortfolioNPV(
  trials: ClinicalTrial[],
  marketCap?: number,
  cash?: number,
  debt?: number
): rNPVResult {
  if (trials.length === 0) {
    return {
      method: 'rNPV',
      fairValue: 0,
      upside: '0%',
      pipelineValue: 0,
      successProbability: 0,
      trialContributions: {},
    };
  }

  const trialResults = trials.map((trial, index) => {
    const result = calculateTrialNPV(trial);
    return {
      id: trial.drug || trial.product || `trial_${index}`,
      ...result,
    };
  });

  const pipelineValue = trialResults.reduce((sum, r) => sum + r.riskAdjustedNPV, 0);
  
  let enterpriseValue = pipelineValue;
  
  if (marketCap) {
    enterpriseValue = marketCap;
  } else if (cash !== undefined && debt !== undefined) {
    enterpriseValue = (cash || 0) - (debt || 0) + pipelineValue;
  }

  const totalSuccessProbability = trialResults.reduce((sum, r) => sum + r.successRate, 0) / trialResults.length;
  
  const upside = marketCap ? ((pipelineValue - marketCap) / marketCap) * 100 : 0;

  const trialContributions: Record<string, number> = {};
  trialResults.forEach(r => {
    trialContributions[r.id] = r.riskAdjustedNPV;
  });

  return {
    method: 'rNPV',
    fairValue: Math.round(enterpriseValue),
    upside: `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`,
    pipelineValue: Math.round(pipelineValue),
    successProbability: Math.round(totalSuccessProbability * 100) / 100,
    trialContributions,
  };
}

export function estimateBiotechNPV(
  revenue: number,
  pipelineCount: number,
  phase: ClinicalPhase,
  indication: string
): rNPVResult {
  const trials: ClinicalTrial[] = Array(pipelineCount).fill(null).map((_, i) => ({
    drug: `drug_${i + 1}`,
    indication,
    phase,
  }));

  const mockMarketCap = revenue * 5;
  
  return calculatePortfolioNPV(trials, mockMarketCap);
}
