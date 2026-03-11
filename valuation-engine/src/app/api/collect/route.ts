import { NextRequest, NextResponse } from 'next/server';
import { 
  collectCompany, 
  getPendingCompanies, 
  approveCompany, 
  rejectCompany,
  getCollectionStats 
} from '@/lib/data/collector';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, type = 'preipo' } = body;
    
    if (!name) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'INVALID_PARAMS', message: 'Company name is required' }
      }, { status: 400 });
    }
    
    const result = await collectCompany(name, type);
    
    return NextResponse.json({
      success: result.success,
      data: result,
      error: null,
    });
    
  } catch (error) {
    console.error('Collect error:', error);
    return NextResponse.json({
      success: false,
      data: null,
      error: {
        code: 'COLLECT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  try {
    if (action === 'stats') {
      const stats = await getCollectionStats();
      return NextResponse.json({
        success: true,
        data: stats,
        error: null,
      });
    }
    
    const pending = await getPendingCompanies();
    return NextResponse.json({
      success: true,
      data: pending,
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
