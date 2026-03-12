import fs from 'fs';
import path from 'path';
import { cacheGet, cacheSet, cacheKey } from './cache';

const PROSPECTUS_DIR = path.join(process.cwd(), 'data', 'prospectus');
const HKEX_PROSPECTUS_BASE = 'https://www1.hkexnews.hk/listedco/listconews/announcement';

interface ProspectusInfo {
  stockCode: string;
  companyName: string;
  pdfUrl?: string;
  localPath?: string;
  downloadedAt?: string;
}

function ensureProspectusDir(): void {
  if (!fs.existsSync(PROSPECTUS_DIR)) {
    fs.mkdirSync(PROSPECTUS_DIR, { recursive: true });
  }
}

export async function findProspectusPDF(stockCode: string): Promise<ProspectusInfo | null> {
  const cacheKeyName = cacheKey('prospectus:info', stockCode);
  const cached = await cacheGet<ProspectusInfo>(cacheKeyName);
  
  if (cached && cached.localPath && fs.existsSync(cached.localPath)) {
    return cached;
  }

  try {
    const pdfUrl = await searchProspectusUrl(stockCode);
    
    if (!pdfUrl) {
      return null;
    }

    const localPath = path.join(PROSPECTUS_DIR, `${stockCode}.pdf`);
    const downloaded = await downloadPDF(pdfUrl, localPath);
    
    const info: ProspectusInfo = {
      stockCode,
      companyName: '',
      pdfUrl,
      localPath: downloaded ? localPath : undefined,
      downloadedAt: downloaded ? new Date().toISOString() : undefined,
    };

    await cacheSet(cacheKeyName, info, 604800 * 4); // 4 weeks
    return info;
  } catch (error) {
    console.error('Error finding prospectus:', error);
    return null;
  }
}

async function searchProspectusUrl(stockCode: string): Promise<string | null> {
  const searchUrl = `https://www1.hkexnews.hk/search/tips?s=1&c=10&o=desc&sortBy=PUBLISH_DATE&docType=PROSP&stockCode=${stockCode}`;
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; XCure/1.0)',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    
    const pdfMatch = html.match(/https:\/\/www1\.hkexnews\.hk\/listedco\/listconews\/announcement\/[vp]\/[\d]+\/[a-zA-Z0-9_]+\.pdf/);
    
    if (pdfMatch) {
      return pdfMatch[0];
    }

    return null;
  } catch (error) {
    console.error('Error searching prospectus URL:', error);
    return null;
  }
}

async function downloadPDF(url: string, localPath: string): Promise<boolean> {
  ensureProspectusDir();

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; XCure/1.0)',
      },
    });

    if (!response.ok) {
      console.error('Failed to download PDF:', response.status);
      return false;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(buffer));
    
    return true;
  } catch (error) {
    console.error('Error downloading PDF:', error);
    return false;
  }
}

export function getLocalProspectusPath(stockCode: string): string | null {
  const localPath = path.join(PROSPECTUS_DIR, `${stockCode}.pdf`);
  return fs.existsSync(localPath) ? localPath : null;
}
