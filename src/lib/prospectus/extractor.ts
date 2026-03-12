import { cacheGet, cacheSet, cacheKey } from '../data/cache';
import { parseProspectusPDF, type ParsedProspectus } from './parser';

export interface ExtractedPipelineItem {
  product: string;
  indication: string;
  phase: string;
  status?: string;
}

export interface ExtractedFinancials {
  revenue?: number;
  cash?: number;
  debt?: number;
  rAndD?: number;
}

export interface ExtractedProspectusData {
  pipeline: ExtractedPipelineItem[];
  financials: ExtractedFinancials;
  marketInfo?: {
    targetIndication?: string;
    addressableMarket?: number;
  };
}

const MINIMAX_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2';
const MINIMAX_MODEL = 'MiniMax-M2.5';

const EXTRACTION_PROMPT = (text: string) => `
Extract structured data from this HKEX IPO prospectus (English). 

Return ONLY valid JSON (no other text):
{
  "pipeline": [
    {"product": "product name", "indication": "disease/condition", "phase": "Preclinical|Phase I|Phase II|Phase III", "status": "ongoing|planned"}
  ],
  "financials": {
    "revenue": number or null,
    "cash": number or null,
    "debt": number or null,
    "rAndD": number or null
  },
  "marketInfo": {
    "addressableMarket": number or null
  }
}

Focus on clinical pipeline products and financial highlights. Use null for missing data.
 prospectus text (first 8000 chars):
${text.substring(0, 8000)}
`;

export async function extractProspectusWithAI(
  stockCode: string,
  pdfPath: string
): Promise<ExtractedProspectusData | null> {
  const cacheKeyName = cacheKey('prospectus:extracted', stockCode);
  const cached = await cacheGet<ExtractedProspectusData>(cacheKeyName);
  
  if (cached) {
    return cached;
  }

  const parsed = await parseProspectusPDF(pdfPath);
  if (!parsed) {
    return null;
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  
  if (!apiKey) {
    console.warn('MINIMAX_API_KEY not set, using basic extraction');
    return basicExtract(parsed.rawText);
  }

  try {
    const prompt = EXTRACTION_PROMPT(parsed.rawText);
    
    const requestBody: Record<string, any> = {
      model: MINIMAX_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a biotech data extraction expert. Return ONLY valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    };

    const groupId = process.env.MINIMAX_GROUP_ID;
    if (groupId) {
      requestBody.group_id = groupId;
    }
    
    const response = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error('MiniMax API error:', response.status);
      return basicExtract(parsed.rawText);
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return basicExtract(parsed.rawText);
    }

    const parsedData = JSON.parse(jsonMatch[0]);
    
    const result: ExtractedProspectusData = {
      pipeline: parsedData.pipeline || [],
      financials: parsedData.financials || {},
      marketInfo: parsedData.marketInfo,
    };

    await cacheSet(cacheKeyName, result, 604800 * 2); // 2 weeks
    
    return result;
  } catch (error) {
    console.error('AI extraction error:', error);
    return basicExtract(parsed.rawText);
  }
}

function basicExtract(text: string): ExtractedProspectusData {
  const pipeline: ExtractedPipelineItem[] = [];
  
  const phasePatterns = [
    /(?:our (?:lead )?(?:product|candidate|drug)?\s*(?:candidate)?\s*(?:is|was|is currently|are currently)\s*(?:in\s+)?(Phase\s+I|Phase\s+II|Phase\s+III|Preclinical|Phase\s+I\/II))/gi,
    /Phase\s+(I|II|III|IV)/gi,
  ];
  
  const lines = text.split('\n');
  for (const line of lines.slice(0, 200)) {
    if (line.length > 20 && line.length < 200) {
      for (const pattern of phasePatterns) {
        const match = line.match(pattern);
        if (match) {
          pipeline.push({
            product: line.substring(0, 50).trim(),
            indication: 'See description',
            phase: match[0] || 'Unknown',
          });
          if (pipeline.length >= 5) break;
        }
      }
    }
    if (pipeline.length >= 5) break;
  }

  return {
    pipeline,
    financials: {},
  };
}
