import { NextRequest } from "next/server";
import { cacheGet, cacheSet, cacheKey } from "@/lib/data/cache";

const CACHE_TTL = 86400; // 24 hours

const PROMPT = (query: string) => `You are XCure, an expert biotech AI investment analyst.
Analyze the following project/token: "${query}"

Return a structured report with exactly these 4 sections, using this exact format:

## Scientific Credibility | Score: X/10

[2-3 paragraphs analyzing the scientific basis, publications, patents, and credibility of claims]

## Team Background | Tag: [Experienced/Mixed/Early-Stage]

[2-3 paragraphs on founders, advisors, prior exits, academic credentials]

## Clinical Data Progress | Phase: [Preclinical/Phase I/Phase II/Phase III/Approved]

[2-3 paragraphs on trial status, endpoints, enrollment, regulatory designations]

## Tokenomics & Investment Risk | Risk: [Low/Medium/High]

[2-3 paragraphs on token supply, vesting, utility, treasury, valuation, and key risks]

Be specific, data-driven, and balanced. Use realistic biotech industry language.`;

const MOCK_ANALYSIS = (query: string) => `
## Scientific Credibility | Score: 7/10

${query} demonstrates a moderately strong scientific foundation. The underlying mRNA delivery mechanism is well-established in peer-reviewed literature, with over 120 published studies supporting the core technology. Key patents filed in 2021-2023 cover novel lipid nanoparticle formulations that show improved cellular uptake in preclinical models. However, some efficacy claims around long-term immune memory have yet to be validated in larger cohort studies. Independent replication of Phase I results by two academic institutions strengthens credibility, though the methodology for measuring biomarker endpoints remains contested within the field.

## Team Background | Tag: Experienced

The founding team brings deep domain expertise from leading institutions. The CEO previously led oncology R&D at a major pharmaceutical company for 8 years and holds 14 patents in targeted drug delivery. The CSO completed post-doctoral research at MIT's Koch Institute and co-authored 30+ publications in Nature Medicine and Cell. The CMO has shepherded three drugs through FDA approval. Advisory board includes two former FDA officials and a Nobel laureate in Chemistry (2019). The company retains a core of 18 full-time researchers, supplemented by CRO partnerships for clinical operations. Notably, two co-founders departed in 2022, though the company attributes this to strategic pivots rather than internal conflict.

## Clinical Data Progress | Phase: Phase II

${query} is currently in Phase II trials across three sites in the US and EU. Phase I data (N=42) published in January 2024 showed acceptable safety profile with no dose-limiting toxicities at the therapeutic dose range and promising pharmacokinetics. The ongoing Phase II trial (N=180) targets a primary endpoint of objective response rate at 24 weeks with interim data expected Q3 2025. Enrollment is 73% complete. Companion diagnostic development is running in parallel under a co-development agreement with a diagnostics partner. The regulatory path appears clear—the FDA granted Breakthrough Therapy designation in December 2023, which should accelerate review timelines. IND approval obtained without clinical holds.

## Tokenomics & Investment Risk | Risk: Medium

The project's token (${query.toUpperCase()}) launched in 2023 with a total supply of 500 million tokens. Current circulating supply is approximately 180 million (36%), with the remainder locked in a 4-year vesting schedule for team (15%), treasury (25%), and ecosystem incentives (24%). Token utility is tied to governance voting, staking for data access, and fee payments on the platform. Valuation at current FDV implies a 3.2x premium to comparable biotech tokens. Treasury holds 18 months of operational runway in stablecoins, reducing near-term dilution risk. Key risks include regulatory uncertainty around tokenized biotech assets (SEC guidance pending), concentration risk with top 10 wallets holding 41% of supply, and the binary nature of clinical trial outcomes. Liquidity is adequate on major DEXs but thin on CEXs. Overall risk profile is moderate, suitable for investors with high-risk biotech tolerance.
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
  const { query } = await req.json();

  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ error: "query is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const normalizedQuery = query.toLowerCase().trim();
  const cacheKeyName = cacheKey("analyze", normalizedQuery);

  // Check cache first
  const cached = await cacheGet<string>(cacheKeyName);
  if (cached) {
    return new Response(createMockStream(cached), {
      headers: { 
        "Content-Type": "text/plain; charset=utf-8",
        "X-Cache": "HIT"
      },
    });
  }

  let fullText = "";
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey) {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContentStream(PROMPT(query));

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullText += text;
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      },
    });

    // Save to cache after streaming completes
    if (fullText) {
      cacheSet(cacheKeyName, fullText, CACHE_TTL).catch(console.error);
    }

    return new Response(stream, {
      headers: { 
        "Content-Type": "text/plain; charset=utf-8",
        "X-Cache": "MISS"
      },
    });
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
