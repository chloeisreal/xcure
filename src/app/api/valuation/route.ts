import { NextRequest, NextResponse } from 'next/server';
import { calculateDCF } from '@/lib/valuation/dcf';
import { calculateComps } from '@/lib/valuation/comps';
import { calculatePortfolioNPV } from '@/lib/valuation/rnpv';
import { generateAIReport } from '@/lib/valuation/ai';
import { getQuote } from '@/lib/data/stocks';
import { getIPOCompanies, getPreIPOCompanies, getTokenizedBiotech, findTokenBySymbol } from '@/lib/data/local';
import type { ValuationRequest, ValuationResponse, CompanyType, Valuation } from '@/lib/data/types';

export async function POST(request: NextRequest): Promise<NextResponse<ValuationResponse>> {
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
    let companyType: CompanyType = type;
    let pipeline: any[] = [];
    
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
      pipeline = company.prospectus?.pipeline || [];
      companyType = 'ipo';
      dataSources.push('local');
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
    
    if ((type === 'ipo' || type === 'preipo' || type === 'listed') && methods.includes('rnpv') && pipeline.length > 0) {
      const rnpvResult = calculatePortfolioNPV(pipeline, currentPrice);
      if (rnpvResult) {
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
        type: companyType,
        currentPrice,
        currency: 'USD',
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
