import { NextRequest, NextResponse } from 'next/server';
import { getQuote } from '@/lib/data/stocks';
import type { QuoteResponse } from '@/lib/data/types';

export async function GET(request: NextRequest): Promise<NextResponse<QuoteResponse>> {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  
  if (!symbol) {
    return NextResponse.json({
      success: false,
      data: null,
      error: { code: 'INVALID_PARAMS', message: 'Symbol is required' }
    }, { status: 400 });
  }
  
  try {
    const quote = await getQuote(symbol);
    
    if (!quote) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: `Quote not found for ${symbol}` }
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: quote,
      error: null
    });
    
  } catch (error) {
    console.error('Quote error:', error);
    return NextResponse.json({
      success: false,
      data: null,
      error: {
        code: 'DATA_SOURCE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch quote'
      }
    }, { status: 500 });
  }
}
