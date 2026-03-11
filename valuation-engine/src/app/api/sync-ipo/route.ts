import { NextRequest, NextResponse } from 'next/server';
import { refreshIPODatabase, syncHKEXFilings } from '@/lib/data/ipo';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { source, force } = body;
    
    const startTime = Date.now();
    
    if (source === 'hkex') {
      const count = await syncHKEXFilings();
      return NextResponse.json({
        success: true,
        data: {
          source: 'hkex',
          synced: count,
          duration: `${Date.now() - startTime}ms`,
        },
        error: null,
      });
    }
    
    if (source === 'sec') {
      const { searchBiotechFilings } = await import('@/lib/data/sec');
      const filings = await searchBiotechFilings();
      return NextResponse.json({
        success: true,
        data: {
          source: 'sec',
          synced: filings.length,
          duration: `${Date.now() - startTime}ms`,
        },
        error: null,
      });
    }
    
    const result = await refreshIPODatabase();
    
    return NextResponse.json({
      success: true,
      data: {
        total: result.total,
        local: result.local,
        sec: result.sec,
        hkex: result.hkex,
        duration: `${Date.now() - startTime}ms`,
      },
      error: null,
    });
    
  } catch (error) {
    console.error('Sync IPO error:', error);
    return NextResponse.json({
      success: false,
      data: null,
      error: {
        code: 'SYNC_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    data: {
      message: 'POST to sync IPO database',
      sources: ['all', 'hkex', 'sec'],
    },
    error: null,
  });
}
