import { NextRequest } from "next/server";
import { cacheGet, cacheSet, cacheKey } from "@/lib/data/cache";

const CACHE_TTL = 7200; // 2 hours
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW = 3600;

async function checkRateLimit(clientId: string): Promise<boolean> {
  const key = cacheKey('ratelimit', clientId);
  const count = await cacheGet<number>(key) || 0;
  
  if (count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  await cacheSet(key, count + 1, RATE_LIMIT_WINDOW);
  return true;
}

const PROMPT = (query: string) => `You are XCure, an expert biotech and DeSci AI investment analyst.
Analyze the following project, company, or token: "${query}"

IMPORTANT RULES:
- If this is a DeSci protocol, DAO, or crypto token (e.g. BIO Protocol, VitaDAO, LabDAO, ResearchHub), do NOT fabricate clinical trial data. Instead, analyze protocol mechanics, on-chain governance, treasury, and scientific coordination credibility.
- If this is a publicly traded pharma/biotech company (e.g. Moderna, BioNTech, Pfizer), analyze based on publicly known real-world data — pipeline stage, approved products, financial health, and R&D focus.
- If this is an early-stage or private company, be explicit that data is limited and avoid inventing specific numbers.
- Do NOT make up specific numbers (trial enrollment counts, exact publication counts, precise wallet percentages, etc.). Use qualitative or approximate language instead.
- Be honest when information is limited or uncertain.

Return a structured report with exactly these 4 sections, using this exact format:

## Scientific Credibility | Score: X/10

[2-3 paragraphs. For DeSci protocols: analyze scientific coordination model, quality of affiliated researchers, and legitimacy of the research thesis. For pharma companies: analyze pipeline credibility, published science, and regulatory track record.]

## Team Background | Tag: [Experienced/Mixed/Early-Stage]

[2-3 paragraphs on founders, advisors, prior exits, and institutional backing. For DeSci DAOs: include governance structure and community quality.]

## Clinical Data Progress | Phase: [Preclinical/Phase I/Phase II/Phase III/Approved/Protocol-Stage]

[2-3 paragraphs. For DeSci/crypto protocols: use "Protocol-Stage" and describe funded research projects, outcomes, or IP NFT activity instead of traditional clinical stages. For pharma: describe actual pipeline status.]

## Tokenomics & Investment Risk | Risk: [Low/Medium/High]

[2-3 paragraphs. For DeSci tokens: analyze token utility, treasury health, vesting, governance power, and market liquidity. For traditional companies: analyze valuation multiples, cash runway, and key binary risks.]

Be balanced, intellectually honest, and avoid generic filler. If you genuinely don't have reliable data on something, say so explicitly.`;

const MOCK_ANALYSIS = (query: string) => `
⚠️ **Sample Analysis** — This is a placeholder. Connect your Gemini API key for real-time AI analysis.

## Scientific Credibility | Score: —/10

${query} is a project in the biotech or DeSci space. Without live AI analysis, a meaningful scientific credibility score cannot be assigned. Generally, credibility assessment would examine the strength of the underlying scientific thesis, the quality and independence of affiliated researchers, peer-reviewed publications supporting the core approach, and whether efficacy claims have been independently validated.

For DeSci protocols, this section would cover the protocol's mechanism for funding and coordinating research, the track record of IP NFTs or research outputs, and how the community vets scientific claims. For pharma companies, it would cover pipeline depth, published trial data, and regulatory designations.

## Team Background | Tag: —

Detailed team information for ${query} requires live data. A thorough assessment would examine founders' prior institutional affiliations, domain expertise, previous exits or publications, and the caliber of advisors and institutional backers. For DAO-based projects, governance participation rates and contributor quality are also relevant signals.

## Clinical Data Progress | Phase: —

Progress stage assessment is not available in sample mode. For traditional biotech companies, this section covers active clinical trials, enrollment status, primary endpoints, and regulatory designations such as Breakthrough Therapy or Fast Track. For DeSci protocols, it describes funded research milestones, IP NFT deal activity, and the maturity of research coordination mechanisms.

## Tokenomics & Investment Risk | Risk: —

Token or investment risk analysis for ${query} is unavailable without live data. Key factors to evaluate include token supply structure and vesting schedules, treasury composition and operational runway, token utility beyond speculation, governance concentration, and liquidity depth across venues. For listed companies, valuation multiples relative to pipeline maturity and cash runway are the primary risk indicators.
`.trim();

function createMockStream(text: string): ReadableStream {
  const encoder = new TextEncoder();
  const chunkSize = 5;
  return new ReadableStream({
    async start(controller) {
      for (let i = 0; i < text.length; i += chunkSize) {
        controller.enqueue(encoder.encode(text.slice(i, i + chunkSize)));
        await new Promise((r) => setTimeout(r, 30));
      }
      controller.close();
    },
  });
}

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() 
    || req.headers.get('cf-connecting-ip') 
    || 'unknown';
  
  const allowed = await checkRateLimit(clientIp);
  if (!allowed) {
    console.log('[analyze] Rate limit exceeded for:', clientIp);
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  const { query } = await req.json();

  console.log('[analyze] Query:', query);
  
  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ error: "query is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const nocache = req.nextUrl.searchParams.get("nocache") === "1";
  const normalizedQuery = query.toLowerCase().trim();
  const cacheKeyName = cacheKey("analyze", normalizedQuery);

  // Check cache first (skipped when ?nocache=1)
  if (!nocache) {
    const cached = await cacheGet<string>(cacheKeyName);
    if (cached) {
      return new Response(createMockStream(cached), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Cache": "HIT",
        },
      });
    }
  }

  let fullText = "";
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey) {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Try up to 2 attempts: first call, then one retry after 2 s on 429
    async function tryGemini(attempt: number): Promise<ReturnType<typeof model.generateContentStream> | null> {
      try {
        console.log(`[analyze] Calling Gemini API for: "${query}" (attempt ${attempt})`);
        return await model.generateContentStream(PROMPT(query));
      } catch (err: any) {
        const is429 = err?.status === 429 || String(err?.message).includes("429");
        if (is429 && attempt === 1) {
          console.warn("[analyze] Gemini 429 — waiting 2 s before retry…");
          await new Promise((r) => setTimeout(r, 2000));
          return tryGemini(2);
        }
        // 429 on retry, or any other error → fall through to mock
        console.error(`[analyze] Gemini API error (attempt ${attempt}):`, {
          message: err?.message,
          status:  err?.status,
        });
        return null;
      }
    }

    const result = await tryGemini(1);

    if (result) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            for await (const chunk of result.stream) {
              const text = chunk.text();
              if (text) {
                fullText += text;
                controller.enqueue(encoder.encode(text));
              }
            }
            if (fullText) {
              cacheSet(cacheKeyName, fullText, CACHE_TTL).catch(console.error);
            }
            controller.close();
          } catch (streamErr) {
            console.error("[analyze] Gemini stream error:", streamErr);
            controller.error(streamErr);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Cache": "MISS",
        },
      });
    }
    // result is null → fall through to mock
  }

  // Mock fallback
  const mockText = MOCK_ANALYSIS(query);
  cacheSet(cacheKeyName, mockText, CACHE_TTL).catch(console.error);
  
  return new Response(createMockStream(mockText), {
    headers: { 
      "Content-Type": "text/plain; charset=utf-8",
      "X-Cache": "MISS"
    },
  });
}
