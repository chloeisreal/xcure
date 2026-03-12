"use client";

import { useState, useCallback } from "react";

export type CompanyType = "listed" | "ipo" | "preipo" | "token";
export type ValuationMethod = "dcf" | "comps" | "rnpv" | "ai";

export interface ValuationRequest {
  symbol: string;
  type: CompanyType;
  methods?: ValuationMethod[];
  aiSummary?: boolean;
}

export interface DCFResult {
  method: "DCF";
  fairValue: number;
  upside: string;
  parameters: {
    revenue: number;
    growthRate: number;
    wacc: number;
    terminalGrowth: number;
  };
}

export interface CompsResult {
  method: "Comps";
  fairValue: number;
  upside: string;
  comparables: string[];
  avgPE?: number;
  avgPS?: number;
}

export interface rNPVResult {
  method: "rNPV";
  fairValue: number;
  upside: string;
  pipelineValue: number;
  successProbability: number;
}

export interface AIResult {
  method: "AI";
  fairValue: number;
  recommendation: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  confidence: number;
  summary: string;
}

export interface ValuationData {
  symbol: string;
  name: string;
  type: CompanyType;
  currentPrice?: number;
  currency: string;
  valuation: {
    dcf?: DCFResult;
    comps?: CompsResult;
    rnpv?: rNPVResult;
    ai?: AIResult;
  };
  metadata: {
    timestamp: string;
    dataSources: string[];
  };
}

export interface ValuationResponse {
  success: boolean;
  data: ValuationData | null;
  error: { code: string; message: string } | null;
}

export function useValuation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValuationData | null>(null);

  const getValuation = useCallback(async (request: ValuationRequest) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errData.error?.message ?? `HTTP ${res.status}`);
      }

      const data: ValuationResponse = await res.json();

      if (!data.success || !data.data) {
        throw new Error(data.error?.message ?? "Unknown error");
      }

      setResult(data.data);
      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getQuote = useCallback(async (symbol: string) => {
    try {
      const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data.data : null;
    } catch {
      return null;
    }
  }, []);

  const getCompanies = useCallback(async (type?: string) => {
    try {
      const url = type ? `/api/companies?type=${type}` : "/api/companies";
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data.data : null;
    } catch {
      return null;
    }
  }, []);

  return {
    loading,
    error,
    result,
    getValuation,
    getQuote,
    getCompanies,
  };
}

export function detectCompanyType(query: string): CompanyType {
  const lower = query.toLowerCase();
  
  if (lower.match(/^(vita|bio|hair|lon|psy)\b/i) || lower.includes('vitadao') || lower.includes('bioprotocol')) {
    return "token";
  }
  
  if (lower.match(/\d{4}|上市|递表|招股|s-1|f-1|ipo|h1|a1/i)) {
    return "ipo";
  }
  
  if (lower.match(/pre-?ipo|私募|融资|a轮|b轮|c轮|series/i)) {
    return "preipo";
  }
  
  return "listed";
}

export function extractSymbol(query: string): string {
  const upper = query.toUpperCase().trim();
  
  const tokenMatch = upper.match(/^(VITA|BIO|HAIR|LON|PSY)\b/);
  if (tokenMatch) return tokenMatch[1];
  
  if (upper.includes('VITADAO')) return 'VITA';
  if (upper.includes('BIOPROTOCOL')) return 'BIO';
  
  const tickerMatch = upper.match(/^[A-Z]{1,5}$/);
  if (tickerMatch) return tickerMatch[0];
  
  return upper.split(/\s+/)[0];
}

export interface CompanySearchResult {
  symbol: string;
  name: string;
  nameEn?: string;
  type: CompanyType;
  exchange?: string;
  id: string;
}

export async function resolveCompanyName(query: string): Promise<CompanySearchResult | null> {
  const trimmed = query.trim();
  
  if (!trimmed) return null;
  
  if (/^[A-Z]{1,5}$/.test(trimmed.toUpperCase())) {
    return {
      symbol: trimmed.toUpperCase(),
      name: trimmed,
      type: detectCompanyType(trimmed),
      id: trimmed.toLowerCase(),
    };
  }
  
  try {
    const res = await fetch(`/api/companies/search?q=${encodeURIComponent(trimmed)}&limit=1`);
    const data = await res.json();
    
    if (data.success && data.data && data.data.length > 0) {
      const result = data.data[0];
      return {
        symbol: result.symbol,
        name: result.name,
        nameEn: result.nameEn,
        type: result.type,
        exchange: result.exchange,
        id: result.id,
      };
    }
  } catch (e) {
    console.error('Company search failed:', e);
  }
  
  return null;
}
