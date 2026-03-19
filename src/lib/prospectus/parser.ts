import fs from 'fs';
import path from 'path';

export interface ParsedProspectus {
  rawText: string;
  pageCount: number;
  extractedAt: string;
}

export async function parseProspectusPDF(pdfPath: string): Promise<ParsedProspectus | null> {
  // PDF parsing is disabled for now due to Node.js compatibility issues
  // Pipeline data should be manually added to the database
  console.log('PDF parsing is disabled - using manual database data');
  return null;
}

export async function extractFromLocalProspectus(stockCode: string): Promise<ParsedProspectus | null> {
  const PROSPECTUS_DIR = path.join(process.cwd(), 'data', 'prospectus');
  const pdfPath = path.join(PROSPECTUS_DIR, `${stockCode}.pdf`);
  
  return parseProspectusPDF(pdfPath);
}
