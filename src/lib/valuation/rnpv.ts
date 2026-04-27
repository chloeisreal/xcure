import type { rNPVResult, ClinicalPhase, ClinicalTrial, Currency, CompanySector } from '../data/types';

const PHASE_SUCCESS_RATES: Record<ClinicalPhase, number> = {
  'Preclinical': 0.10,
  'Phase I': 0.25,
  'Phase II': 0.35,
  'Phase III': 0.55,
  'Approved': 1.0,
};

const MEDICAL_DEVICE_PEAK_SALES: Record<string, number> = {
  'Cardiovascular': 2000000000,
  'Respiratory': 1500000000,
  'Diagnostic': 1000000000,
  'Surgical': 1200000000,
  'default': 800000000,
};

const PEAK_SALES_ESTIMATES: Record<string, number> = {
  'Oncology': 5000000000,
  'Autoimmune': 3000000000,
  'Cardiovascular': 4000000000,
  'Neurology': 3500000000,
  'Rare Disease': 1500000000,
  'default': 1000000000,
};

const INDICATION_MAP: Record<string, string> = {
  '实体瘤': 'Solid Tumors',
  '黑色素瘤': 'Melanoma',
  '非小细胞肺癌': 'NSCLC',
  '伤口愈合': 'Wound Healing',
  '特发性肺纤维化': 'Idiopathic Pulmonary Fibrosis',
  '肿瘤': 'Oncology',
  '多种实体瘤': 'Multiple Solid Tumors',
  '胃食管腺癌': 'Gastric/Esophageal Adenocarcinoma',
  '胆道癌': 'Biliary Cancer',
};

function translateIndication(indication: string): string {
  if (!indication) return indication;
  if (INDICATION_MAP[indication]) return INDICATION_MAP[indication];
  const parts = indication.split('/');
  if (parts.length > 1) {
    return parts.map(p => INDICATION_MAP[p.trim()] || p.trim()).join('/');
  }
  return indication;
}
const DISCOUNT_RATE = 0.12;
const COMMERCIALIZATION_YEARS = 5;
const PATENT_YEARS = 15;

export const CURRENCY_TO_USD: Record<Currency, number> = {
  'USD': 1.0,
  'CNY': 0.14,  // ~7.2 CNY per USD
  'HKD': 0.128, // ~7.8 HKD per USD
  'EUR': 1.08,
};

export function convertToUSD(amount: number, currency: Currency): number {
  return amount * CURRENCY_TO_USD[currency];
}

export function getSuccessRate(phase: ClinicalPhase, sector?: CompanySector): number {
  // Medical devices have higher success rates since products are already approved
  if (sector === 'medical-device') {
    return 1.0;
  }
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
  if (trial.phase === 'Approved') {
    launchYear = currentYear; // Already launched
  } else if (trial.phase === 'Phase III') {
    launchYear = currentYear + 2;
  } else if (trial.phase === 'Phase II') {
    launchYear = currentYear + 4;
  } else if (trial.phase === 'Phase I') {
    launchYear = currentYear + 5;
  }
  
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
  const pipelineItems: { product: string; indication: string; phase: string }[] = [];

  trialResults.forEach(r => {
    trialContributions[r.id] = r.riskAdjustedNPV;
    const trial = trials[trialResults.indexOf(r)];
    pipelineItems.push({
      product: r.id,
      indication: translateIndication(trial?.indication || ''),
      phase: trial?.phase || '',
    });
  });

  return {
    method: 'rNPV',
    fairValue: Math.round(enterpriseValue),
    upside: `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`,
    pipelineValue: Math.round(pipelineValue),
    successProbability: Math.round(totalSuccessProbability * 100) / 100,
    trialContributions,
    pipelineItems,
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

export interface MedicalDeviceValuationParams {
  revenue: number;           // Current annual revenue in local currency
  revenueCurrency: Currency;
  grossMargin: number;       // Gross margin as percentage (e.g., 0.5 for 50%)
  growthRate: number;         // Expected annual growth rate (e.g., 0.2 for 20%)
  cash: number;               // Cash in local currency
  debt: number;               // Debt in local currency
  years: number;              // Forecast years
  sector?: CompanySector;
}

export function calculateMedicalDeviceNPV(params: MedicalDeviceValuationParams): rNPVResult {
  const {
    revenue,
    revenueCurrency,
    grossMargin,
    growthRate = 0.15,
    cash = 0,
    debt = 0,
    years = 5,
    sector = 'medical-device'
  } = params;

  const discountRate = 0.10; // Lower discount rate for established medical devices
  
  let revenueInUSD = convertToUSD(revenue, revenueCurrency);
  let cashInUSD = convertToUSD(cash, revenueCurrency);
  let debtInUSD = convertToUSD(debt, revenueCurrency);
  
  // Use revenue multiple approach for medical devices
  // Typical medical device companies trade at 3-8x revenue
  const revenueMultiple = 5.0; // Conservative 5x revenue
  const terminalMultiple = 6.0;
  
  let totalNPV = 0;
  
  for (let year = 1; year <= years; year++) {
    const projectedRevenue = revenueInUSD * Math.pow(1 + growthRate, year);
    const discountFactor = Math.pow(1 + discountRate, year);
    totalNPV += (projectedRevenue * revenueMultiple) / discountFactor;
  }
  
  // Terminal value
  const terminalRevenue = revenueInUSD * Math.pow(1 + growthRate, years);
  const terminalValue = terminalRevenue * terminalMultiple;
  const terminalDiscountFactor = Math.pow(1 + discountRate, years);
  totalNPV += terminalValue / terminalDiscountFactor;
  
  // Adjust for cash and debt
  const enterpriseValue = totalNPV + cashInUSD - debtInUSD;
  
  // For early-stage medical devices, use 85% success probability
  // This reflects the risk of commercial execution
  const successProbability = 0.85;
  
  const pipelineValue = enterpriseValue * successProbability;
  const upside = 0;
  
  return {
    method: 'rNPV',
    fairValue: Math.round(enterpriseValue),
    upside: `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`,
    pipelineValue: Math.round(pipelineValue),
    successProbability,
    trialContributions: {
      'commercialized-products': Math.round(pipelineValue),
    },
  };
}
