import { NextRequest, NextResponse } from 'next/server';
import { getIPOCompanies, getPreIPOCompanies, getTokenizedBiotech } from '@/lib/data/local';
import type { CompaniesResponse } from '@/lib/data/types';

export async function GET(request: NextRequest): Promise<NextResponse<CompaniesResponse>> {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const sector = searchParams.get('sector');
  
  try {
    const [ipo, preipo, token] = await Promise.all([
      getIPOCompanies(),
      getPreIPOCompanies(),
      getTokenizedBiotech(),
    ]);
    
    let filteredIpo = ipo;
    let filteredPreipo = preipo;
    let filteredToken = token;
    
    if (sector) {
      const sectorLower = sector.toLowerCase();
      filteredIpo = ipo.filter(c => 
        c.sector.toLowerCase().includes(sectorLower) ||
        c.subsector?.toLowerCase().includes(sectorLower)
      );
      filteredPreipo = preipo.filter(c => 
        c.sector.toLowerCase().includes(sectorLower) ||
        c.subsector?.toLowerCase().includes(sectorLower)
      );
    }
    
    const response: CompaniesResponse = {
      success: true,
      data: {
        listed: [],
        ipo: type === 'ipo' || !type ? filteredIpo : [],
        preipo: type === 'preipo' || !type ? filteredPreipo : [],
        token: type === 'token' || !type ? filteredToken : [],
      },
      error: null
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Companies error:', error);
    return NextResponse.json({
      success: false,
      data: null,
      error: {
        code: 'DATA_SOURCE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch companies'
      }
    }, { status: 500 });
  }
}
