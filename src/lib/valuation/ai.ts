import type { AIResult, DCFResult, CompsResult, rNPVResult } from '../data/types';
import { cacheGet, cacheSet, cacheKey } from '../data/cache';

const MINIMAX_API_URL = 'https://api.minimaxi.com/anthropic/v1/messages';
const MINIMAX_MODEL = 'MiniMax-M2.7';
const GEMINI_MODEL = 'gemini-2.0-flash';
const CACHE_TTL = 14400; // 4 hours

const AI_PROMPT = (companyName: string, dcf?: DCFResult, comps?: CompsResult, rnpv?: rNPVResult) => `
You are XCure, an expert biotech AI investment analyst.

Analyze the following company: ${companyName}

Based on the following valuation data (if available), provide a comprehensive AI-driven valuation analysis:

${dcf ? `
## DCF Valuation
- Fair Value: $${dcf.fairValue.toLocaleString()}
- Upside: ${dcf.upside}
- Key Parameters:
  - Revenue: $${dcf.parameters.revenue?.toLocaleString() || 'N/A'}
  - Growth Rate: ${(dcf.parameters.growthRate * 100).toFixed(1)}%
  - WACC: ${(dcf.parameters.wacc * 100).toFixed(1)}%
` : '## DCF Valuation\n- Data: Not available'}

${comps ? `
## Comparable Companies Analysis
- Fair Value: $${comps.fairValue.toLocaleString()}
- Upside: ${comps.upside}
- Comparables: ${comps.comparables?.join(', ') || 'N/A'}
- Average P/E: ${comps.avgPE?.toFixed(1) || 'N/A'}
` : '## Comparable Companies Analysis\n- Data: Not available'}

${rnpv ? `
## Risk-Adjusted NPV (rNPV)
- Fair Value: $${rnpv.fairValue.toLocaleString()}
- Pipeline Value: $${rnpv.pipelineValue?.toLocaleString() || 'N/A'}
- Success Probability: ${((rnpv.successProbability || 0) * 100).toFixed(1)}%
` : '## Risk-Adjusted NPV (rNPV)\n- Data: Not available'}

Please provide your analysis in JSON format with the following structure:
{
  "recommendation": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell",
  "confidence": 0-100,
  "targetPrice": number (or 0 if no data available),
  "summary": "2-3 paragraph analysis"
}

IMPORTANT:
- Respond in English only (NO Chinese, NO other languages)
- Do NOT include any non-ASCII characters in your response
- If no valuation data is available, provide a qualitative analysis based on the company name/type and industry
- Be specific, data-driven, and provide a balanced perspective
- Always return valid JSON
`;

// ============================================================================
// T1: MiniMax API (Primary - Paid)
// ============================================================================

async function callMiniMax(
  companyName: string,
  dcf?: DCFResult,
  comps?: CompsResult,
  rnpv?: rNPVResult
): Promise<AIResult | null> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.log('[AI] T1: No MiniMax API key');
    return null;
  }

  console.log('[AI] T1: Calling MiniMax API...');
  
  try {
    const prompt = AI_PROMPT(companyName, dcf, comps, rnpv);
    
    const response = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    console.log('[AI] T1: MiniMax response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI] T1: MiniMax error:', response.status, errorText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    console.log('[AI] T1: Response type:', data.type);
    
    let responseText = '';
    if (data.type === 'message' && data.content) {
      for (const block of data.content) {
        if (block.type === 'text') {
          responseText += block.text;
        } else if (block.type === 'thinking') {
          responseText += block.text || '';
        }
      }
    }
    
    console.log('[AI] T1: Response length:', responseText.length);
    
    if (!responseText) {
      console.log('[AI] T1: Empty response');
      return null;
    }
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[AI] T1: No JSON found in response');
      console.log('[AI] T1: Response preview:', responseText.substring(0, 200));
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log('[AI] T1: Parsed result:', parsed.recommendation, parsed.confidence);
    
    return {
      method: 'AI',
      fairValue: parsed.targetPrice || 0,
      recommendation: parsed.recommendation || 'Hold',
      confidence: parsed.confidence || 50,
      summary: parsed.summary || 'AI analysis completed.',
    };
  } catch (error) {
    console.error('[AI] T1: Exception:', error);
    return null;
  }
}

// ============================================================================
// T2: Gemini 2.0 Flash (Free Fallback)
// ============================================================================

async function callGeminiFlash(
  companyName: string,
  dcf?: DCFResult,
  comps?: CompsResult,
  rnpv?: rNPVResult
): Promise<AIResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('[AI] T2: No Gemini API key');
    return null;
  }

  console.log('[AI] T2: Calling Gemini 2.0 Flash...');
  
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const prompt = AI_PROMPT(companyName, dcf, comps, rnpv);
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    console.log('[AI] T2: Response length:', responseText.length);
    
    if (!responseText) {
      console.log('[AI] T2: Empty response');
      return null;
    }
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[AI] T2: No JSON found');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      method: 'AI',
      fairValue: parsed.targetPrice || 0,
      recommendation: parsed.recommendation || 'Hold',
      confidence: parsed.confidence || 50,
      summary: parsed.summary || 'AI analysis completed via Gemini.',
    };
  } catch (error) {
    console.error('[AI] T2: Exception:', error);
    return null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateAverageFairValue(
  dcf?: DCFResult,
  comps?: CompsResult,
  rnpv?: rNPVResult
): number {
  const values: number[] = [];
  
  if (dcf?.fairValue && dcf.fairValue > 0) values.push(dcf.fairValue);
  if (comps?.fairValue && comps.fairValue > 0) values.push(comps.fairValue);
  if (rnpv?.fairValue && rnpv.fairValue > 0) values.push(rnpv.fairValue);
  
  if (values.length === 0) return 0;
  
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ============================================================================
// T3: Local Rule-Based Engine (Final Fallback)
// ============================================================================

function generateRuleBasedValuation(
  companyName: string,
  dcf?: DCFResult,
  comps?: CompsResult,
  rnpv?: rNPVResult
): AIResult {
  const fairValue = calculateAverageFairValue(dcf, comps, rnpv);
  
  let recommendation: AIResult['recommendation'] = 'Hold';
  let confidence = 50;
  let summary = '';
  
  const values: number[] = [];
  if (dcf?.fairValue && dcf.fairValue > 0) values.push(dcf.fairValue);
  if (comps?.fairValue && comps.fairValue > 0) values.push(comps.fairValue);
  if (rnpv?.fairValue && rnpv.fairValue > 0) values.push(rnpv.fairValue);
  
  if (values.length >= 2) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = (max - min) / ((min + max) / 2);
    
    if (spread < 0.2) {
      confidence = 75;
      recommendation = values[0] > values[1] ? 'Buy' : 'Hold';
    } else if (spread < 0.4) {
      confidence = 60;
    } else {
      confidence = 45;
    }
  }

  summary = `AI analysis for ${companyName}: Based on ${values.length} valuation method(s), ` +
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

// ============================================================================
// Main Entry Point - Always try LLM first, fallback only if all fail
// ============================================================================

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
    console.log('[AI] Cache hit for:', symbol);
    return cached;
  }

  let lastError = '';

  // === T1: MiniMax (Primary - Paid) ===
  const minimaxKey = process.env.MINIMAX_API_KEY;
  if (minimaxKey) {
    console.log('[AI] T1: Trying MiniMax...');
    const result = await callMiniMax(companyName, dcf, comps, rnpv);
    if (result) {
      console.log('[AI] T1: Success!');
      cacheSet(cacheKeyName, result, CACHE_TTL).catch(console.error);
      return result;
    }
    lastError = 'MiniMax failed';
  }

  // === T2: Gemini 2.0 Flash (Free Fallback) ===
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    console.log('[AI] T2: Trying Gemini 2.0 Flash...');
    const result = await callGeminiFlash(companyName, dcf, comps, rnpv);
    if (result) {
      console.log('[AI] T2: Success!');
      cacheSet(cacheKeyName, result, CACHE_TTL).catch(console.error);
      return result;
    }
    lastError += ', Gemini failed';
  }

  // === T3: Local Rule Engine (Final Fallback - only when ALL LLM APIs fail) ===
  console.log('[AI] All AI APIs failed (' + lastError + '), T3: Using local rule engine...');
  const result = generateRuleBasedValuation(companyName, dcf, comps, rnpv);
  cacheSet(cacheKeyName, result, CACHE_TTL).catch(console.error);
  return result;
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
  return result || generateRuleBasedValuation(
    companyName,
    valuations.dcf,
    valuations.comps,
    valuations.rnpv
  );
}