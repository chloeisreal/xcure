import { NextRequest, NextResponse } from 'next/server';
import { syncAllKnownCompanies, syncClinicalTrialsForCompany } from '@/lib/data/clinicaltrials';
import { checkDataQuality, runDataHealthCheck, getDataCoverageReport } from '@/lib/data/quality';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { company, force = false } = body;
    
    const startTime = Date.now();
    
    if (company) {
      const result = await syncClinicalTrialsForCompany(company, force);
      return NextResponse.json({
        success: true,
        data: {
          company,
          ...result,
          duration: `${Date.now() - startTime}ms`,
        },
        error: null,
      });
    }
    
    const result = await syncAllKnownCompanies();
    
    return NextResponse.json({
      success: true,
      data: {
        ...result,
        duration: `${Date.now() - startTime}ms`,
      },
      error: null,
    });
    
  } catch (error) {
    console.error('Sync trials error:', error);
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
  try {
    const [healthCheck, coverage] = await Promise.all([
      runDataHealthCheck(),
      getDataCoverageReport(),
    ]);
    
    return NextResponse.json({
      success: true,
      data: {
        health: healthCheck,
        coverage,
      },
      error: null,
    });
    
  } catch (error) {
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
