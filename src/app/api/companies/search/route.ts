import { NextRequest, NextResponse } from 'next/server';
import { searchCompanies, type CompanySearchResult } from '@/lib/data/local';

interface SearchResponse {
  success: boolean;
  data: CompanySearchResult[];
  error?: { code: string; message: string };
}

export async function GET(request: NextRequest): Promise<NextResponse<SearchResponse>> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || searchParams.get('query');
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!query || query.trim().length === 0) {
    return NextResponse.json({
      success: false,
      data: [],
      error: { code: 'INVALID_PARAMS', message: 'Query is required' }
    }, { status: 400 });
  }

  try {
    const results = await searchCompanies(query, limit);
    
    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Company search error:', error);
    return NextResponse.json({
      success: false,
      data: [],
      error: {
        code: 'SEARCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to search companies'
      }
    }, { status: 500 });
  }
}
