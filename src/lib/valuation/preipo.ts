import type { PreIPOCompany } from '../data/types';

interface PreIPOValuationResult {
  method: string;
  fairValue: number;
  upside: string;
  confidence: number;
  details: {
    dcf?: number;
    marketComps?: number;
    rnpv?: number;
  };
}

const STAGE_MULTIPLIERS: Record<string, number> = {
  'seed': 0.3,
  'A': 0.5,
  'B': 0.7,
  'C': 0.85,
  'D': 1.0,
  'IPO': 1.2,
};

const STAGE_SUCCESS_RATES: Record<string, number> = {
  'seed': 0.15,
  'A': 0.25,
  'B': 0.40,
  'C': 0.55,
  'D': 0.70,
  'IPO': 0.85,
};

export function calculatePreIPOValuation(
  company: PreIPOCompany
): PreIPOValuationResult {
  const lastValuation = company.lastFunding.valuation;
  const stage = normalizeStage(company.lastFunding.round);
  
  const stageMultiplier = STAGE_MULTIPLIERS[stage] || 0.7;
  const successRate = STAGE_SUCCESS_RATES[stage] || 0.4;
  
  let dcfValue = 0;
  if (company.lastFunding.amount && company.lastFunding.valuation) {
    const impliedGrowth = company.lastFunding.valuation / (company.lastFunding.amount * 5);
    const projectedExit = company.lastFunding.valuation * (1 + Math.min(impliedGrowth, 0.3));
    dcfValue = projectedExit / Math.pow(1.15, 5);
  }
  
  const marketCompsValue = estimateMarketComps(company);
  
  const rnpvPipelineValue = company.pipeline.length > 0
    ? calculatePipelineValue(company.pipeline, lastValuation)
    : 0;
  
  const weights = {
    dcf: dcfValue > 0 ? 0.25 : 0,
    marketComps: marketCompsValue > 0 ? 0.35 : 0,
    rnpv: rnpvPipelineValue > 0 ? 0.40 : 0,
  };
  
  const totalWeight = weights.dcf + weights.marketComps + weights.rnpv;
  
  if (totalWeight > 0) {
    weights.dcf /= totalWeight;
    weights.marketComps /= totalWeight;
    weights.rnpv /= totalWeight;
  } else {
    weights.marketComps = 1;
  }
  
  const fairValue = 
    (dcfValue * weights.dcf) +
    (marketCompsValue * weights.marketComps) +
    (rnpvPipelineValue * weights.rnpv);
  
  const riskDiscount = (1 - successRate) * 0.3;
  const adjustedFairValue = fairValue * (1 - riskDiscount);
  
  const upside = ((adjustedFairValue - lastValuation) / lastValuation) * 100;
  
  const confidence = calculateConfidence(company);
  
  return {
    method: 'Pre-IPO Valuation',
    fairValue: Math.round(adjustedFairValue),
    upside: `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`,
    confidence,
    details: {
      dcf: dcfValue > 0 ? Math.round(dcfValue) : undefined,
      marketComps: Math.round(marketCompsValue),
      rnpv: rnpvPipelineValue > 0 ? Math.round(rnpvPipelineValue) : undefined,
    },
  };
}

function normalizeStage(round: string): string {
  const r = round.toUpperCase();
  
  if (r.includes('SEED') || r.includes('PRE-SEED')) return 'seed';
  if (r.includes('SERIES A') || r.includes('A轮')) return 'A';
  if (r.includes('SERIES B') || r.includes('B轮')) return 'B';
  if (r.includes('SERIES C') || r.includes('C轮')) return 'C';
  if (r.includes('SERIES D') || r.includes('D轮')) return 'D';
  if (r.includes('IPO') || r.includes('上市')) return 'IPO';
  
  return 'B';
}

function estimateMarketComps(company: PreIPOCompany): number {
  const avgPublicMarketCap = 5000000000;
  
  const stageMultiplier = STAGE_MULTIPLIERS[normalizeStage(company.lastFunding.round)] || 0.7;
  
  const pipelinePremium = company.pipeline.length * 0.1;
  
  const baseValue = avgPublicMarketCap * stageMultiplier * (1 + pipelinePremium);
  
  return baseValue;
}

function calculatePipelineValue(
  pipeline: Array<{ phase: string; indication?: string }>,
  baseValuation: number
): number {
  const PHASE_VALUES: Record<string, number> = {
    'Preclinical': 50000000,
    'Phase I': 150000000,
    'Phase II': 400000000,
    'Phase III': 1000000000,
    'Approved': 3000000000,
  };
  
  const successWeighted = pipeline.reduce((sum, trial) => {
    const phase = trial.phase || 'Preclinical';
    const successRate = STAGE_SUCCESS_RATES[normalizeStage(phase)] || 0.2;
    const value = PHASE_VALUES[phase] || 50000000;
    return sum + (value * successRate);
  }, 0);
  
  return Math.min(successWeighted, baseValuation * 0.5);
}

function calculateConfidence(company: PreIPOCompany): number {
  let confidence = 50;
  
  if (company.pipeline && company.pipeline.length > 0) {
    confidence += 15;
  }
  
  if (company.lastFunding.investors && company.lastFunding.investors.length > 0) {
    const topInvestors = ['softbank', 'a16z', 'sequoia', 'greylock', 'gv', 'google'];
    const hasTopInvestor = company.lastFunding.investors.some(i =>
      topInvestors.some(ti => i.toLowerCase().includes(ti))
    );
    if (hasTopInvestor) {
      confidence += 15;
    }
  }
  
  if (company.lastFunding.valuation && company.lastFunding.valuation > 1000000000) {
    confidence += 10;
  }
  
  if (company.lastFunding.date) {
    const fundingDate = new Date(company.lastFunding.date);
    const monthsAgo = (Date.now() - fundingDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo < 6) {
      confidence += 10;
    } else if (monthsAgo > 18) {
      confidence -= 10;
    }
  }
  
  return Math.min(Math.max(confidence, 20), 90);
}

export function calculatePreIPOScore(company: PreIPOCompany): {
  score: number;
  grade: string;
  factors: string[];
} {
  let score = 50;
  const factors: string[] = [];
  
  if (company.pipeline && company.pipeline.length >= 3) {
    score += 15;
    factors.push('Rich pipeline (3+ drugs)');
  } else if (company.pipeline && company.pipeline.length > 0) {
    score += 5;
    factors.push('Has clinical pipeline');
  }
  
  const stage = normalizeStage(company.lastFunding.round);
  if (stage === 'C' || stage === 'D') {
    score += 10;
    factors.push('Late stage funding');
  }
  
  if (company.lastFunding.investors && company.lastFunding.investors.length >= 3) {
    score += 10;
    factors.push('Strong investor syndicate');
  }
  
  const valuation = company.lastFunding.valuation;
  if (valuation > 1000000000) {
    score += 10;
    factors.push('Unicorn status ($1B+)');
  } else if (valuation > 500000000) {
    score += 5;
    factors.push('Strong valuation ($500M+)');
  }
  
  const grade = score >= 80 ? 'A' :
                score >= 70 ? 'B' :
                score >= 60 ? 'C' :
                score >= 50 ? 'D' : 'F';
  
  return { score: Math.min(score, 100), grade, factors };
}
