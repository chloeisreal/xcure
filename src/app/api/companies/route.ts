import { NextRequest, NextResponse } from 'next/server';
import { getIPOCompanies, getPreIPOCompanies, getTokenizedBiotech } from '@/lib/data/local';
import type { CompaniesResponse } from '@/lib/data/types';
import fs from 'fs';
import path from 'path';

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

interface IPOCompanyInput {
  id: string;
  name: string;
  nameEn: string;
  hkexCode?: string;
  exchange?: string;
  listingType?: string;
  sector?: string;
  subsector?: string;
  filingDate?: string;
  financials?: any;
  prospectus?: any;
  risks?: string[];
}

function getIPOFilePath(): string {
  return path.join(process.cwd(), 'data', 'ipo-filings.json');
}

function loadIPOData(): any[] {
  const filePath = getIPOFilePath();
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

function saveIPOData(data: any[]): void {
  const filePath = getIPOFilePath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: IPOCompanyInput = await request.json();
    
    const { id, name, nameEn, hkexCode, exchange, listingType, sector, subsector, filingDate, financials, prospectus, risks } = body;
    
    if (!id || !name) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'INVALID_PARAMS', message: 'ID and name are required' }
      }, { status: 400 });
    }
    
    const ipoData = loadIPOData();
    
    const existingIndex = ipoData.findIndex((c: any) => c.id === id || c.name === name);
    if (existingIndex !== -1) {
      return NextResponse.json({
        success: false,
        data: null,
        error: { code: 'ALREADY_EXISTS', message: 'Company already exists in database' }
      }, { status: 409 });
    }
    
    const newCompany = {
      id,
      name,
      nameEn: nameEn || '',
      hkexCode: hkexCode || '',
      exchange: exchange || 'HKEX',
      listingType: listingType || '18A',
      sector: sector || 'biotech',
      subsector: subsector || '',
      filingDate: filingDate || new Date().toISOString().split('T')[0],
      status: 'Pending',
      financials: financials || {},
      prospectus: prospectus || { description: '', pipeline: [], lastFinancing: { round: '', amount: '', valuation: '', date: '' } },
      risks: risks || [],
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    
    ipoData.push(newCompany);
    saveIPOData(ipoData);
    
    return NextResponse.json({
      success: true,
      data: newCompany,
      error: null
    });
    
  } catch (error) {
    console.error('Add company error:', error);
    return NextResponse.json({
      success: false,
      data: null,
      error: { code: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
    }, { status: 500 });
  }
}
