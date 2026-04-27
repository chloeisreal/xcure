import { NextRequest, NextResponse } from 'next/server';
import { calculateDCF } from '@/lib/valuation/dcf';
import { calculateComps } from '@/lib/valuation/comps';
import { calculatePortfolioNPV, calculateMedicalDeviceNPV } from '@/lib/valuation/rnpv';
import { generateAIReport } from '@/lib/valuation/ai';
import { getQuote } from '@/lib/data/stocks';
import { getIPOCompanies, getPreIPOCompanies, getTokenizedBiotech, findTokenBySymbol } from '@/lib/data/local';
import { findProspectusPDF, getLocalProspectusPath } from '@/lib/data/prospectus';
import { extractProspectusWithAI } from '@/lib/prospectus/extractor';
import type { ValuationRequest, CompanyType, Valuation, ClinicalPhase, CompanySector } from '@/lib/data/types';
import type { ValuationResponse } from '@/lib/data/types';
import { cacheGet, cacheSet, cacheKey } from '@/lib/data/cache';

const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW = 3600;

async function checkRateLimit(clientId: string): Promise<boolean> {
  const key = cacheKey('ratelimit', clientId);
  const count = await cacheGet<number>(key) || 0;
  
  if (count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  await cacheSet(key, count + 1, RATE_LIMIT_WINDOW);
  return true;
}

type ExtractedTrial = {
  product: string;
  indication: string;
  phase: string;
};

function mapPhase(phase: string): ClinicalPhase {
  const p = phase.toLowerCase();
  if (p.includes('phase iii') || p.includes('phase 3')) return 'Phase III';
  if (p.includes('phase ii') || p.includes('phase 2')) return 'Phase II';
  if (p.includes('phase i') || p.includes('phase 1')) return 'Phase I';
  if (p.includes('preclinical')) return 'Preclinical';
  if (p.includes('approved') || p.includes('已批准') || p.includes('上市') || p.includes('commercialized') || p.includes('商业化')) return 'Approved';
  return 'Phase I';
}

export async function POST(request: NextRequest): Promise<NextResponse<ValuationResponse>> {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() 
    || request.headers.get('cf-connecting-ip') 
    || 'unknown';
  
  const allowed = await checkRateLimit(clientIp);
  if (!allowed) {
    return NextResponse.json({
      success: false,
      data: null,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' }
    }, { status: 429 });
  }
  
  try {
    const body: ValuationRequest = await request.json();
    const { symbol, type = 'listed', methods = ['dcf', 'comps', 'rnpv', 'ai'], aiSummary = true } = body;
    
    if (!symbol) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'INVALID_PARAMS', message: 'Symbol is required' }
      }, { status: 400 });
    }
    
    const dataSources: string[] = [];
    let currentPrice: number | undefined;
    let name = symbol;
    let nameEn = '';
    let companyType: CompanyType = type;
    let pipeline: any[] = [];
    let companySector: CompanySector = 'biotech';
    let financials: any = null;
    let revenue = 0;
    let grossMargin = 0.5;
    let cash = 0;
    let debt = 0;
    let revenueCurrency = 'CNY';
    let vibeScore: number | undefined;
    
    if (type === 'listed') {
      const quote = await getQuote(symbol);
      if (!quote) {
        const [ipoList, preipoList, tokenList] = await Promise.all([
          getIPOCompanies(),
          getPreIPOCompanies(),
          findTokenBySymbol(symbol),
        ]);
        
        const ipoMatch = ipoList.find(c => c.name.includes(symbol) || c.nameEn?.toLowerCase().includes(symbol.toLowerCase()));
        if (ipoMatch) {
          name = ipoMatch.name;
          pipeline = ipoMatch.prospectus?.pipeline || [];
          companyType = 'ipo';
          dataSources.push('local');
        } else {
          const preipoMatch = preipoList.find(c => c.name.includes(symbol) || c.nameEn?.toLowerCase().includes(symbol.toLowerCase()));
          if (preipoMatch) {
            name = preipoMatch.name;
            pipeline = preipoMatch.pipeline || [];
            companyType = 'preipo';
            dataSources.push('local');
          } else {
            const tokenMatch = await findTokenBySymbol(symbol);
            if (tokenMatch || symbol.toUpperCase().includes('VITA') || symbol.toLowerCase().includes('vita')) {
              const token = tokenMatch || await findTokenBySymbol('VITA');
              if (token) {
                currentPrice = token.tokenomics.currentPrice;
                name = token.name;
                companyType = 'token';
                dataSources.push('local');
              } else {
                return NextResponse.json({
                  success: false,
                  data: null,
                  error: { code: 'NOT_FOUND', message: `Company not found: ${symbol}` }
                }, { status: 404 });
              }
            } else {
              return NextResponse.json({
                success: false,
                data: null,
                error: { code: 'NOT_FOUND', message: `Company not found: ${symbol}` }
              }, { status: 404 });
            }
          }
        }
      } else {
        currentPrice = quote.price;
        name = quote.name;
        dataSources.push('stockprices.dev', 'yahoo-finance2');
      }
    } else if (type === 'token') {
      const token = await findTokenBySymbol(symbol);
      if (!token) {
        return NextResponse.json({
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: `Token not found: ${symbol}` }
        }, { status: 404 });
      }
      currentPrice = token.tokenomics.currentPrice;
      name = token.name;
      dataSources.push('local');
    } else if (type === 'ipo') {
      const ipoList = await getIPOCompanies();
      const company = ipoList.find(c => c.id === symbol || c.name.includes(symbol));
      if (!company) {
        return NextResponse.json({
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: `IPO company not found: ${symbol}` }
        }, { status: 404 });
      }
      name = company.name;
      nameEn = company.nameEn || '';
      pipeline = (company.prospectus?.pipeline || []).map((p: any) => ({
        product: p.product,
        indication: p.indication,
        phase: mapPhase(p.stage || p.phase || 'Phase I'),
      }));
      companyType = 'ipo';
      dataSources.push('local');
      
      // Extract company sector, financials, and vibe score
      companySector = (company as any).sector || 'biotech';
      financials = (company as any).financials;
      revenue = financials?.revenue || 0;
      grossMargin = financials?.grossMargin || 0.5;
      cash = financials?.cash || 0;
      debt = financials?.debt || 0;
      revenueCurrency = financials?.revenueCurrency || 'CNY';
      vibeScore = (company as any).vibeScore;

      // Try to find and extract prospectus PDF for IPO companies
      const hkexCode = (company as any).hkexCode;
      if (methods.includes('rnpv') || methods.includes('ai')) {
        try {
          // First try to find local PDF by hkexCode or company ID
          let localPath = hkexCode ? getLocalProspectusPath(hkexCode) : null;
          if (!localPath) {
            localPath = getLocalProspectusPath(company.id);
          }
          
          // If no local PDF and we have hkexCode, try to download
          if (!localPath && hkexCode) {
            const prospectusInfo = await findProspectusPDF(hkexCode);
            if (prospectusInfo?.localPath) {
              localPath = prospectusInfo.localPath;
            }
          }
          
          // If we have PDF, extract data with AI
          if (localPath) {
            const extractKey = hkexCode || company.id;
            const extracted = await extractProspectusWithAI(extractKey, localPath);
            if (extracted && extracted.pipeline.length > 0) {
              pipeline = extracted.pipeline.map((p: ExtractedTrial) => ({
                product: p.product,
                indication: p.indication,
                phase: mapPhase(p.phase),
              }));
              dataSources.push('prospectus-ai');
            }
          }
        } catch (e) {
          console.error('Prospectus extraction error:', e);
        }
      }
    } else if (type === 'preipo') {
      const preipoList = await getPreIPOCompanies();
      const company = preipoList.find(c => c.id === symbol || c.name.toLowerCase().includes(symbol.toLowerCase()));
      if (!company) {
        return NextResponse.json({
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: `Pre-IPO company not found: ${symbol}` }
        }, { status: 404 });
      }
      name = company.name;
      currentPrice = company.lastFunding.valuation;
      pipeline = company.pipeline || [];
      companyType = 'preipo';
      dataSources.push('local');
    }
    
    const valuation: Valuation = {};
    
    if (type === 'listed' && methods.includes('dcf')) {
      const dcfResult = await calculateDCF(symbol);
      if (dcfResult) {
        valuation.dcf = dcfResult;
      }
    }
    
    if (type === 'listed' && methods.includes('comps')) {
      const compsResult = await calculateComps(symbol);
      if (compsResult) {
        valuation.comps = compsResult;
      }
    }
    
    if ((type === 'ipo' || type === 'preipo' || type === 'listed') && methods.includes('rnpv')) {
      // Check if this is a medical device company with revenue data
      const isMedicalDevice = companySector === 'medical-device' || (companySector as string) === 'medical-device';
      const hasRevenue = revenue > 0;
      
      if (isMedicalDevice && hasRevenue) {
        // Use medical device valuation
        const rnpvResult = calculateMedicalDeviceNPV({
          revenue,
          revenueCurrency: revenueCurrency as any,
          grossMargin,
          growthRate: 0.15,
          cash,
          debt,
          years: 5,
          sector: companySector as any,
        });
        valuation.rnpv = rnpvResult;
      } else if (pipeline.length > 0) {
        // Use traditional biotech rNPV
        const rnpvResult = calculatePortfolioNPV(pipeline, currentPrice);
        valuation.rnpv = rnpvResult;
      }
    }
    
    if (aiSummary) {
      const aiResult = await generateAIReport(name, {
        dcf: valuation.dcf,
        comps: valuation.comps,
        rnpv: valuation.rnpv,
      });
      valuation.ai = aiResult;
    }
    
    const response: ValuationResponse = {
      success: true,
      data: {
        symbol,
        name,
        nameEn,
        type: companyType,
        currentPrice,
        currency: 'USD',
        vibeScore: vibeScore || undefined,
        // vibeReasoning removed - internal scoring methodology not exposed
        valuation,
        metadata: {
          timestamp: new Date().toISOString(),
          dataSources: [...new Set(dataSources)],
        }
      },
      error: null
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Valuation error:', error);
    return NextResponse.json({
      success: false,
      data: null,
      error: {
        code: 'VALUATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}
