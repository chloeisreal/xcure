import fs from 'fs';
import path from 'path';
import * as pdfParseLib from 'pdf-parse';

type PdfParseFunction = (buffer: Buffer) => Promise<{
  text: string;
  numpages: number;
}>;

let pdfParse: PdfParseFunction | null = null;

async function loadPdfParse(): Promise<PdfParseFunction> {
  if (!pdfParse) {
    pdfParse = pdfParseLib as unknown as PdfParseFunction;
  }
  return pdfParse;
}

export interface ParsedProspectus {
  rawText: string;
  pageCount: number;
  extractedAt: string;
}

export async function parseProspectusPDF(pdfPath: string): Promise<ParsedProspectus | null> {
  if (!fs.existsSync(pdfPath)) {
    return null;
  }

  try {
    const pdf = await loadPdfParse();
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);

    return {
      rawText: data.text,
      pageCount: data.numpages,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return null;
  }
}

export async function extractFromLocalProspectus(stockCode: string): Promise<ParsedProspectus | null> {
  const PROSPECTUS_DIR = path.join(process.cwd(), 'data', 'prospectus');
  const pdfPath = path.join(PROSPECTUS_DIR, `${stockCode}.pdf`);
  
  return parseProspectusPDF(pdfPath);
}
