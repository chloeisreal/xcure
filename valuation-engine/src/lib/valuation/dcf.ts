import { getFinancials, getQuote } from '../data/stocks';
import type { DCFInput, DCFResult, ValuationMethod, FinancialData } from '../data/types';

const DEFAULT_GROWTH_RATE = 0.10;
const DEFAULT_WACC = 0.10;
const DEFAULT_TERMINAL_GROWTH = 0.03;
const DEFAULT_PROJECTION_YEARS = 5;

function calculateFCF(revenue: number, netIncome: number, operatingIncome: number, cashFlow: number): number {
  if (cashFlow && cashFlow > 0) return cashFlow;
  if (operatingIncome && operatingIncome > 0) return operatingIncome * 0.8;
  return revenue * 0.1;
}

function projectFCF(
  baseFCF: number,
  growthRate: number,
  years: number
): number[] {
  const projections: number[] = [];
  let currentFCF = baseFCF;
  
  for (let i = 0; i < years; i++) {
    projections.push(currentFCF);
    currentFCF *= (1 + growthRate);
  }
  
  return projections;
}

function calculateTerminalValue(
  finalFCF: number,
  terminalGrowth: number,
  wacc: number
): number {
  return (finalFCF * (1 + terminalGrowth)) / (wacc - terminalGrowth);
}

function calculatePresentValue(
  cashFlows: number[],
  wacc: number
): { presentValue: number; discountedCashFlows: number[] } {
  let presentValue = 0;
  const discountedCashFlows: number[] = [];
  
  for (let i = 0; i < cashFlows.length; i++) {
    const discountFactor = Math.pow(1 + wacc, i + 1);
    const discounted = cashFlows[i] / discountFactor;
    discountedCashFlows.push(discounted);
    presentValue += discounted;
  }
  
  return { presentValue, discountedCashFlows };
}

function calculateSensitivity(
  baseFCF: number,
  growthRates: number[],
  waccs: number[],
  terminalGrowth: number,
  years: number
): number[][] {
  const results: number[][] = [];
  
  for (const wacc of waccs) {
    const row: number[] = [];
    for (const growth of growthRates) {
      const projections = projectFCF(baseFCF, growth, years);
      const terminalValue = calculateTerminalValue(
        projections[projections.length - 1],
        terminalGrowth,
        wacc
      );
      const { presentValue } = calculatePresentValue(projections, wacc);
      const totalValue = presentValue + terminalValue / Math.pow(1 + wacc, years);
      row.push(totalValue);
    }
    results.push(row);
  }
  
  return results;
}

export async function calculateDCF(
  symbol: string,
  customInput?: Partial<DCFInput>
): Promise<DCFResult | null> {
  const financials = await getFinancials(symbol);
  const quote = await getQuote(symbol);
  
  if (!financials || !quote) {
    console.warn(`Cannot calculate DCF: missing data for ${symbol}`);
    return null;
  }
  
  const input: DCFInput = {
    revenue: financials.revenue || 1000000000,
    growthRate: customInput?.growthRate || DEFAULT_GROWTH_RATE,
    wacc: customInput?.wacc || DEFAULT_WACC,
    terminalGrowth: customInput?.terminalGrowth || DEFAULT_TERMINAL_GROWTH,
    years: customInput?.years || DEFAULT_PROJECTION_YEARS,
  };
  
  const baseFCF = calculateFCF(
    input.revenue,
    financials.netIncome || 0,
    financials.operatingIncome || 0,
    financials.cashFlow || 0
  );
  
  const fcfProjection = projectFCF(baseFCF, input.growthRate, input.years);
  
  const terminalValue = calculateTerminalValue(
    fcfProjection[fcfProjection.length - 1],
    input.terminalGrowth,
    input.wacc
  );
  
  const { presentValue, discountedCashFlows } = calculatePresentValue(
    fcfProjection,
    input.wacc
  );
  
  const terminalValuePV = terminalValue / Math.pow(1 + input.wacc, input.years);
  const fairValue = presentValue + terminalValuePV;
  
  const upside = ((fairValue - quote.price) / quote.price) * 100;
  
  return {
    method: 'DCF',
    fairValue: Math.round(fairValue * 100) / 100,
    upside: `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`,
    fcfProjection: fcfProjection.map(v => Math.round(v)),
    terminalValue: Math.round(terminalValue),
    presentValue: Math.round(presentValue),
    parameters: input,
  };
}

export async function runSensitivityAnalysis(
  symbol: string
): Promise<{
  sensitivity: number[][];
  growthRates: number[];
  waccs: number[];
} | null> {
  const financials = await getFinancials(symbol);
  
  if (!financials) return null;
  
  const baseFCF = calculateFCF(
    financials.revenue || 1000000000,
    financials.netIncome || 0,
    financials.operatingIncome || 0,
    financials.cashFlow || 0
  );
  
  const growthRates = [0.05, 0.10, 0.15, 0.20, 0.25];
  const waccs = [0.06, 0.08, 0.10, 0.12, 0.14];
  
  const sensitivity = calculateSensitivity(
    baseFCF,
    growthRates,
    waccs,
    DEFAULT_TERMINAL_GROWTH,
    DEFAULT_PROJECTION_YEARS
  );
  
  return {
    sensitivity,
    growthRates,
    waccs,
  };
}

export function estimateWACC(
  beta: number = 1.2,
  riskFreeRate: number = 0.04,
  marketRiskPremium: number = 0.06
): number {
  return riskFreeRate + beta * marketRiskPremium;
}

export function estimateGrowthRate(
  historicalGrowth: number[],
  method: 'simple' | 'compound' = 'compound'
): number {
  if (historicalGrowth.length === 0) return DEFAULT_GROWTH_RATE;
  
  if (method === 'simple') {
    return historicalGrowth.reduce((a, b) => a + b, 0) / historicalGrowth.length;
  }
  
  const n = historicalGrowth.length;
  const start = historicalGrowth[0];
  const end = historicalGrowth[n - 1];
  
  return Math.pow(end / start, 1 / n) - 1;
}
