import { NextRequest, NextResponse } from 'next/server';
import { checkDataQuality, runDataHealthCheck, getDataCoverageReport } from '@/lib/data/quality';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'full';
  
  try {
    if (type === 'health') {
      const health = await runDataHealthCheck();
      return NextResponse.json({
        success: true,
        data: health,
        error: null,
      });
    }
    
    if (type === 'coverage') {
      const coverage = await getDataCoverageReport();
      return NextResponse.json({
        success: true,
        data: coverage,
        error: null,
      });
    }
    
    const [quality, health, coverage] = await Promise.all([
      checkDataQuality(),
      runDataHealthCheck(),
      getDataCoverageReport(),
    ]);
    
    return NextResponse.json({
      success: true,
      data: {
        quality,
        health,
        coverage,
      },
      error: null,
    });
    
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      success: false,
      data: null,
      error: {
        code: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}
