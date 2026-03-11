import type { TokenizedCompany } from '../data/types';
import { getTokenPrice } from '../data/tokens';

interface TokenValuationResult {
  method: string;
  fairValue: number;
  currentPrice: number;
  upside: string;
  confidence: number;
  details: {
    marketCap: number;
    fdv: number;
    utilityScore: number;
    governanceScore: number;
  };
}

export async function calculateTokenValuation(
  company: TokenizedCompany
): Promise<TokenValuationResult | null> {
  const currentPrice = await getTokenPrice(company.symbol);
  
  if (!currentPrice && !company.tokenomics.currentPrice) {
    return null;
  }
  
  const price = currentPrice || company.tokenomics.currentPrice || 0;
  
  const marketCap = price * company.tokenomics.circulatingSupply;
  const fdv = price * company.tokenomics.totalSupply;
  
  const utilityScore = calculateUtilityScore(company);
  const governanceScore = calculateGovernanceScore(company);
  
  const baseScore = (utilityScore + governanceScore) / 2;
  
  const premiumMultiplier = getNetworkPremium(company.network);
  const fairValue = fdv * (baseScore / 100) * premiumMultiplier / 100000000;
  
  const upside = ((fairValue - price) / price) * 100;
  
  const confidence = calculateTokenConfidence(company);
  
  return {
    method: 'Token Valuation',
    fairValue: Math.round(fairValue * 100) / 100,
    currentPrice: price,
    upside: `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`,
    confidence,
    details: {
      marketCap: Math.round(marketCap),
      fdv: Math.round(fdv),
      utilityScore,
      governanceScore,
    },
  };
}

function calculateUtilityScore(company: TokenizedCompany): number {
  let score = 30;
  
  if (company.useCases && company.useCases.length > 0) {
    score += company.useCases.length * 10;
  }
  
  if (company.fundedProjects && company.fundedProjects.length > 0) {
    score += 15;
  }
  
  if (company.partnerships && company.partnerships.length > 0) {
    score += 10;
  }
  
  return Math.min(score, 80);
}

function calculateGovernanceScore(company: TokenizedCompany): number {
  let score = 40;
  
  const network = company.network.toLowerCase();
  if (network === 'ethereum') {
    score += 20;
  } else if (network === 'polygon' || network === 'arbitrum') {
    score += 15;
  } else if (network === 'solana') {
    score += 15;
  }
  
  if (company.tokenType === 'Governance') {
    score += 15;
  }
  
  const circulating = company.tokenomics.circulatingSupply / company.tokenomics.totalSupply;
  if (circulating > 0.5) {
    score += 10;
  } else if (circulating > 0.3) {
    score += 5;
  }
  
  return Math.min(score, 85);
}

function getNetworkPremium(network: string): number {
  const networkPremiums: Record<string, number> = {
    'ethereum': 1.2,
    'polygon': 1.0,
    'arbitrum': 1.0,
    'optimism': 1.0,
    'solana': 1.1,
    'base': 1.0,
  };
  
  return networkPremiums[network.toLowerCase()] || 1.0;
}

function calculateTokenConfidence(company: TokenizedCompany): number {
  let confidence = 40;
  
  if (company.launchDate) {
    const launchYear = parseInt(company.launchDate);
    const yearsSinceLaunch = 2025 - launchYear;
    if (yearsSinceLaunch <= 1) {
      confidence += 10;
    } else if (yearsSinceLaunch >= 3) {
      confidence += 20;
    }
  }
  
  if (company.tokenomics.circulatingSupply / company.tokenomics.totalSupply > 0.5) {
    confidence += 15;
  }
  
  if (company.fundedProjects && company.fundedProjects.length > 2) {
    confidence += 15;
  }
  
  return Math.min(confidence, 85);
}

export function compareTokenToPeers(
  company: TokenizedCompany,
  peers: TokenizedCompany[]
): {
  rank: number;
  percentile: number;
  comparison: string;
} {
  const peerScores = peers.map(p => ({
    symbol: p.symbol,
    score: (calculateUtilityScore(p) + calculateGovernanceScore(p)) / 2,
  }));
  
  const companyScore = (calculateUtilityScore(company) + calculateGovernanceScore(company)) / 2;
  
  const sorted = peerScores.sort((a, b) => b.score - a.score);
  const rank = sorted.findIndex(p => p.symbol === company.symbol) + 1;
  const percentile = ((sorted.length - rank) / sorted.length) * 100;
  
  let comparison = '';
  if (percentile >= 75) {
    comparison = 'Top performer in sector';
  } else if (percentile >= 50) {
    comparison = 'Above average';
  } else if (percentile >= 25) {
    comparison = 'Below average';
  } else {
    comparison = 'Underperformer';
  }
  
  return { rank, percentile: Math.round(percentile), comparison };
}
