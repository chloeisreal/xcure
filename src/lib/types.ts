// Company Types
export type CompanyType = 'listed' | 'ipo' | 'preipo' | 'token';
export type ListingType = '18A' | '普通上市' | 'SPAC' | 'Direct Listing';
export type ClinicalPhase = 'Preclinical' | 'Phase I' | 'Phase II' | 'Phase III' | 'Approved';
export type Exchange = 'NASDAQ' | 'NYSE' | 'HKEX' | 'LSE';

// Base Company Interface
export interface BaseCompany {
  id: string;
  name: string;
  nameEn?: string;
  sector: string;
  subsector?: string;
  type: CompanyType;
  lastUpdated: string;
}

// Listed Stock Company
export interface ListedCompany extends BaseCompany {
  type: 'listed';
  symbol: string;
  exchange: Exchange;
  currency: 'USD' | 'HKD' | 'EUR';
  marketCap?: number;
  sector: string;
}

// IPO Filing Company
export interface IPOCompany extends BaseCompany {
  type: 'ipo';
  hkexCode?: string;
  exchange: 'HKEX' | 'NASDAQ' | 'NYSE';
  listingType: ListingType;
  filingDate: string;
  status: 'Pending' | 'Approved' | 'Withdrawn' | 'Listed';
  prospectus: {
    description: string;
    pipeline: ClinicalTrial[];
    lastFinancing?: {
      round: string;
      amount: string;
      valuation: string;
      date: string;
      investors?: string[];
    };
    useOfProceeds?: string[];
  };
  risks?: string[];
}

// Pre-IPO Company
export interface PreIPOCompany extends BaseCompany {
  type: 'preipo';
  founded: number;
  headquarters: string;
  website?: string;
  lastFunding: {
    round: string;
    amount: number;
    currency: 'USD';
    date: string;
    valuation: number;
    investors: string[];
  };
  pipeline: ClinicalTrial[];
  competitors?: string[];
  risks?: string[];
  notes?: string;
}

// Tokenized Biotech Company
export interface TokenizedCompany extends BaseCompany {
  type: 'token';
  symbol: string;
  fullName: string;
  network: string;
  tokenAddress: string;
  tokenType: 'Governance' | 'Utility';
  category: string;
  launchDate: string;
  useCases: string[];
  partnerships: string[];
  fundedProjects: string[];
  tokenomics: {
    totalSupply: number;
    circulatingSupply: number;
    launchPrice: number;
    currentPrice?: number;
    marketCap?: number;
    fdv?: number;
  };
  competitors?: string[];
  risks?: string[];
}

// Clinical Trial
export interface ClinicalTrial {
  drug?: string;
  product?: string;
  indication: string;
  phase: ClinicalPhase;
  status?: string;
  sponsor?: string;
  note?: string;
}

// Quote Data
export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  currency: 'USD' | 'HKD';
  timestamp: string;
}

// Financial Data
export interface FinancialData {
  revenue?: number;
  netIncome?: number;
  grossProfit?: number;
  operatingIncome?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  cashFlow?: number;
  eps?: number;
  peRatio?: number;
  pbRatio?: number;
  beta?: number;
  growthRate?: number;
  year?: number;
}

// Valuation Types
export type ValuationMethod = 'dcf' | 'comps' | 'rnpv' | 'ai';

export interface DCFInput {
  revenue: number;
  growthRate: number;
  wacc: number;
  terminalGrowth: number;
  years: number;
}

export interface DCFResult {
  method: 'DCF';
  fairValue: number;
  upside: string;
  fcfProjection: number[];
  terminalValue: number;
  presentValue: number;
  parameters: DCFInput;
}

export interface CompsResult {
  method: 'Comps';
  fairValue: number;
  upside: string;
  comparables: string[];
  avgPE?: number;
  avgPS?: number;
  avgEVEBITDA?: number;
}

export interface rNPVResult {
  method: 'rNPV';
  fairValue: number;
  upside: string;
  pipelineValue: number;
  successProbability: number;
  trialContributions: Record<string, number>;
}

export interface AIResult {
  method: 'AI';
  fairValue: number;
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
  confidence: number;
  summary: string;
}

export interface Valuation {
  dcf?: DCFResult;
  comps?: CompsResult;
  rnpv?: rNPVResult;
  ai?: AIResult;
}

// API Response Types
export interface ValuationRequest {
  symbol: string;
  type: CompanyType;
  methods?: ValuationMethod[];
  aiSummary?: boolean;
}

export interface ValuationResponse {
  success: boolean;
  data: {
    symbol: string;
    name: string;
    type: CompanyType;
    currentPrice?: number;
    currency?: string;
    valuation: Valuation;
    metadata: {
      timestamp: string;
      dataSources: string[];
      cacheAge?: number;
    };
  } | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export interface QuoteRequest {
  symbol: string;
}

export interface QuoteResponse {
  success: boolean;
  data: Quote | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export interface CompaniesResponse {
  success: boolean;
  data: {
    listed: ListedCompany[];
    ipo: IPOCompany[];
    preipo: PreIPOCompany[];
    token: TokenizedCompany[];
  } | null;
  error: {
    code: string;
    message: string;
  } | null;
}

// Error Codes
export const ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  INVALID_PARAMS: 'INVALID_PARAMS',
  DATA_SOURCE_ERROR: 'DATA_SOURCE_ERROR',
  VALUATION_ERROR: 'VALUATION_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

// Cache Keys
export const CACHE_KEYS = {
  QUOTE: (symbol: string) => `quote:${symbol}`,
  FINANCIALS: (symbol: string) => `financials:${symbol}`,
  COMPANY: (type: string, id: string) => `company:${type}:${id}`,
  VALUATION: (symbol: string, type: string) => `valuation:${type}:${symbol}`,
  TRIALS: (company: string) => `trials:${company}`,
} as const;

// Cache TTL (in seconds)
export const CACHE_TTL = {
  QUOTE: 300, // 5 minutes
  FINANCIALS: 86400, // 24 hours
  COMPANY: 604800, // 1 week
  VALUATION: 3600, // 1 hour
  TRIALS: 604800, // 1 week
} as const;
