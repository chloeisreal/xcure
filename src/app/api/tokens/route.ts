import { NextRequest, NextResponse } from 'next/server';
import { getTokenPrice, refreshTokenPrices } from '@/lib/data/tokens';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  
  if (symbol) {
    try {
      const price = await getTokenPrice(symbol);
      
      if (!price) {
        return NextResponse.json({
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: `Token price not found for ${symbol}` }
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        data: { symbol: symbol.toUpperCase(), price },
        error: null,
      });
    } catch (error) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      }, { status: 500 });
    }
  }
  
  return NextResponse.json({
    success: false,
    data: null,
    error: { code: 'INVALID_PARAMS', message: 'Symbol is required' }
  }, { status: 400 });
}

export async function POST(): Promise<NextResponse> {
  try {
    const prices = await refreshTokenPrices();
    
    return NextResponse.json({
      success: true,
      data: prices,
      error: null,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      data: null,
      error: { code: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
    }, { status: 500 });
  }
}
