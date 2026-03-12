import type { AIResult, DCFResult, CompsResult, rNPVResult } from '../data/types';
import { cacheGet, cacheSet, cacheKey } from '../data/cache';

const MINIMAX_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2';
const MINIMAX_MODEL = 'MiniMax-M2.5';
const CACHE_TTL = 14400; // 4 hours

const AI_PROMPT = (companyName: string, dcf?: DCFResult, comps?: CompsResult, rnpv?: rNPVResult) => `
You are XCure, an expert biotech AI investment analyst.

Analyze the following company: ${companyName}

Based on the following valuation data, provide a comprehensive AI-driven valuation analysis:

${dcf ? `
## DCF Valuation
- Fair Value: $${dcf.fairValue.toLocaleString()}
- Upside: ${dcf.upside}
- Key Parameters:
  - Revenue: $${dcf.parameters.revenue?.toLocaleString() || 'N/A'}
  - Growth Rate: ${(dcf.parameters.growthRate * 100).toFixed(1)}%
  - WACC: ${(dcf.parameters.wacc * 100).toFixed(1)}%
` : 'DCF: No data available'}

${comps ? `
## Comparable Companies Analysis
- Fair Value: $${comps.fairValue.toLocaleString()}
- Upside: ${comps.upside}
- Comparables: ${comps.comparables?.join(', ') || 'N/A'}
- Average P/E: ${comps.avgPE?.toFixed(1) || 'N/A'}
` : 'Comps: No data available'}

${rnpv ? `
## Risk-Adjusted NPV (rNPV)
- Fair Value: $${rnpv.fairValue.toLocaleString()}
- Pipeline Value: $${rnpv.pipelineValue?.toLocaleString() || 'N/A'}
- Success Probability: ${((rnpv.successProbability || 0) * 100).toFixed(1)}%
` : 'rNPV: No data available'}

Please provide your analysis in JSON format with the following structure:
{
  "recommendation": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell",
  "confidence": 0-100,
  "targetPrice": number,
  "summary": "2-3 paragraph analysis"
}

Be specific, data-driven, and provide a balanced perspective on the investment opportunity.
`;

export async function generateAIValuation(
  companyName: string,
  dcf?: DCFResult,
  comps?: CompsResult,
  rnpv?: rNPVResult
): Promise<AIResult | null> {
  const symbol = companyName.toUpperCase().replace(/\s+/g, '');
  const cacheKeyName = cacheKey('ai:valuation', symbol);
  
  const cached = await cacheGet<AIResult>(cacheKeyName);
  if (cached) {
    return cached;
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  
  console.log('MiniMax API Key present:', !!apiKey);
  console.log('MiniMax API Key length:', apiKey?.length);
  
  if (!apiKey) {
    console.warn('MINIMAX_API_KEY not set, using fallback AI valuation');
    return generateFallbackAIValuation(companyName, dcf, comps, rnpv);
  }

  try {
    const prompt = AI_PROMPT(companyName, dcf, comps, rnpv);
    
    const requestBody: Record<string, any> = {
      model: MINIMAX_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are XCure, an expert biotech AI investment analyst. Provide analysis in JSON format only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
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

    console.log('MiniMax response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MiniMax error response:', errorText);
      throw new Error(`MiniMax API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('MiniMax response data:', JSON.stringify(data).substring(0, 500));
    const responseText = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return generateFallbackAIValuation(companyName, dcf, comps, rnpv);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    const result: AIResult = {
      method: 'AI',
      fairValue: parsed.targetPrice || calculateAverageFairValue(dcf, comps, rnpv),
      recommendation: parsed.recommendation || 'Hold',
      confidence: parsed.confidence || 50,
      summary: parsed.summary || 'AI analysis completed with limited data.',
    };
    
    cacheSet(cacheKeyName, result, CACHE_TTL).catch(console.error);
    
    return result;
  } catch (error) {
    console.error('MiniMax API error:', error);
    return generateFallbackAIValuation(companyName, dcf, comps, rnpv);
  }
}

function calculateAverageFairValue(
  dcf?: DCFResult,
  comps?: CompsResult,
  rnpv?: rNPVResult
): number {
  const values: number[] = [];
  
  if (dcf?.fairValue) values.push(dcf.fairValue);
  if (comps?.fairValue) values.push(comps.fairValue);
  if (rnpv?.fairValue) values.push(rnpv.fairValue);
  
  if (values.length === 0) return 0;
  
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function generateFallbackAIValuation(
  companyName: string,
  dcf?: DCFResult,
  comps?: CompsResult,
  rnpv?: rNPVResult
): AIResult {
  const fairValue = calculateAverageFairValue(dcf, comps, rnpv);
  
  let recommendation: AIResult['recommendation'] = 'Hold';
  let confidence = 50;
  
  const values: number[] = [];
  if (dcf?.fairValue) values.push(dcf.fairValue);
  if (comps?.fairValue) values.push(comps.fairValue);
  if (rnpv?.fairValue) values.push(rnpv.fairValue);
  
  if (values.length >= 2) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = (max - min) / ((min + max) / 2);
    
    if (spread < 0.2) {
      confidence = 75;
      if (values[0] > values[1]) {
        recommendation = 'Buy';
      } else {
        recommendation = 'Hold';
      }
    } else if (spread < 0.4) {
      confidence = 60;
      recommendation = 'Hold';
    } else {
      confidence = 45;
      recommendation = 'Hold';
    }
  }

  const summary = `AI analysis for ${companyName}: Based on ${values.length} valuation method(s), ` +
    `the fair value estimate is $${fairValue.toFixed(2)}. ` +
    `The DCF suggests ${dcf?.upside || 'N/A'}, while Comps indicates ${comps?.upside || 'N/A'}. ` +
    `The rNPV pipeline valuation provides additional context with ${((rnpv?.successProbability || 0) * 100).toFixed(0)}% success probability. ` +
    `Overall recommendation: ${recommendation} with ${confidence}% confidence.`;

  return {
    method: 'AI',
    fairValue: Math.round(fairValue * 100) / 100,
    recommendation,
    confidence,
    summary,
  };
}

export async function generateAIReport(
  companyName: string,
  valuations: {
    dcf?: DCFResult;
    comps?: CompsResult;
    rnpv?: rNPVResult;
  }
): Promise<AIResult> {
  const result = await generateAIValuation(
    companyName,
    valuations.dcf,
    valuations.comps,
    valuations.rnpv
  );
  return result || generateFallbackAIValuation(companyName, valuations.dcf, valuations.comps, valuations.rnpv);
}
