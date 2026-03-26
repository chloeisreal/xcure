"use client";

import { useEffect, useRef } from "react";

const TOTAL_SUPPLY = 1_000_000_000;

const allocations = [
  { label: "Community & Ecosystem", pct: 38, color: "#7c3aed", vesting: "Linear quarterly release through 2028", uses: ["Staking rewards", "Liquidity mining", "AI research subscriptions"] },
  { label: "Genesis Distribution",  pct: 25, color: "#2563eb", vesting: "100% unlocked at TGE",                  uses: ["Testnet participants", "Early swap users", "Seed community"] },
  { label: "Team & Advisors",        pct: 20, color: "#9333ea", vesting: "1-year cliff → 3-year monthly linear",  uses: ["Core dev team", "Strategic advisors"] },
  { label: "Foundation / Walnut Capital", pct: 12, color: "#3b82f6", vesting: "20% at TGE, remaining over 2 years linear", uses: ["Operations", "Legal & compliance", "BD & marketing"] },
  { label: "Ecosystem Grants",       pct: 5,  color: "#6366f1", vesting: "Released per project milestones",       uses: ["DeSci projects", "Developer incentives", "Community building"] },
];

const useCases = [
  { icon: "⛽", title: "Gas Token",        desc: "Native gas token for the Cure Chain (Layer 3) network" },
  { icon: "🗳", title: "Governance",       desc: "Vote on protocol parameters and upgrade proposals with $CURE" },
  { icon: "🔒", title: "Staking",          desc: "Stake $CURE to earn protocol revenue and emission rewards" },
  { icon: "🧬", title: "AI Research Pass", desc: "Subscribe to the XCure AI BioMed research tool" },
];

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}

export default function TokenomicsPage() {
  const chartRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    let destroyed = false;

    import("chart.js").then((ChartModule) => {
      if (destroyed || !chartRef.current) return;
      const { Chart, ArcElement, DoughnutController, Tooltip, Legend } = ChartModule;
      Chart.register(ArcElement, DoughnutController, Tooltip, Legend);
      if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
      chartInstance.current = new Chart(chartRef.current, {
        type: "doughnut",
        data: {
          labels: allocations.map((a) => a.label),
          datasets: [{ data: allocations.map((a) => a.pct), backgroundColor: allocations.map((a) => a.color), borderColor: "#111827", borderWidth: 3, hoverOffset: 8 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: "70%",
          plugins: {
            legend: { display: false },
            tooltip: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              callbacks: { label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed}% — ${fmt(ctx.parsed * (TOTAL_SUPPLY / 100))} $CURE` },
              backgroundColor: "#1e293b", borderColor: "#334155", borderWidth: 1, titleColor: "#f1f5f9", bodyColor: "#94a3b8", padding: 12,
            },
          },
        },
      });
    });

    return () => {
      destroyed = true;
      if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null; }
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#111827] text-white">
      <div className="max-w-5xl mx-auto px-4 py-12">

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-3xl font-semibold tracking-tight">$CURE Tokenomics</h1>
            <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1 rounded-full font-medium">Draft · Pending confirmation</span>
          </div>
          <p className="text-slate-400 text-sm">Cure Chain (Layer 3) native token · Modelled after Hyperliquid $HYPE · Associated entity: Walnut Capital</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Total Supply",     value: "1,000,000,000", sub: "$CURE" },
            { label: "VC Allocation",    value: "0%",            sub: "Zero-VC model" },
            { label: "TGE Circulating",  value: "~25%",          sub: "Genesis unlock at TGE" },
            { label: "Reference Model",  value: "$HYPE",         sub: "Hyperliquid" },
          ].map((m) => (
            <div key={m.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1">{m.label}</div>
              <div className="text-xl font-semibold text-white">{m.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{m.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center">
            <div className="relative w-52 h-52">
              <canvas ref={chartRef} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-2xl font-semibold">1B</div>
                <div className="text-xs text-slate-400">$CURE</div>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 w-full">
              {allocations.map((a) => (
                <div key={a.label} className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: a.color }} />
                  <span className="text-slate-300 flex-1">{a.label}</span>
                  <span className="text-white font-medium">{a.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 justify-center">
            {allocations.map((a) => (
              <div key={a.label}>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-sm text-slate-300">{a.label}</span>
                  <span className="text-sm font-medium text-white">{a.pct}%</span>
                </div>
                <div className="w-full bg-slate-700/50 rounded-full h-2 mb-1">
                  <div className="h-2 rounded-full" style={{ width: `${a.pct}%`, background: a.color }} />
                </div>
                <div className="text-xs text-slate-500">{fmt(a.pct * (TOTAL_SUPPLY / 100))} $CURE</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 mb-10">
          <h2 className="text-base font-medium text-white mb-5">Unlock &amp; Vesting Schedule</h2>
          <div className="divide-y divide-slate-700/50">
            {allocations.map((a) => (
              <div key={a.label} className="py-4 flex items-start gap-4">
                <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: a.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{a.label}</span>
                  </div>
                  <div className="text-xs text-slate-400 mb-2">{a.vesting}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.uses.map((u) => (
                      <span key={u} className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-md">{u}</span>
                    ))}
                  </div>
                </div>
                <div className="text-sm font-semibold text-white flex-shrink-0">{a.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <h2 className="text-base font-medium text-white mb-5">$CURE Utility</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {useCases.map((u) => (
              <div key={u.title} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                <div className="text-2xl mb-3">{u.icon}</div>
                <div className="text-sm font-medium text-white mb-1">{u.title}</div>
                <div className="text-xs text-slate-400 leading-relaxed">{u.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 mb-10">
          <h2 className="text-base font-medium text-white mb-5">Comparison with $HYPE</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs">
                  <th className="text-left pb-3 font-medium">Metric</th>
                  <th className="text-right pb-3 font-medium">$HYPE (reference)</th>
                  <th className="text-right pb-3 font-medium text-purple-400">$CURE (draft)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {[
                  ["Total Supply",      "1,000,000,000",           "1,000,000,000"],
                  ["Community Share",   "38.89% + 31% airdrop",    "38% + 25% genesis"],
                  ["Team Share",        "23.80%",                   "20%"],
                  ["Foundation",        "6.00%",                    "12%"],
                  ["VC Allocation",     "0%",                       "0%"],
                  ["Buyback & Burn",    "97% of protocol fees",     "TBD"],
                ].map(([key, hype, cure]) => (
                  <tr key={key}>
                    <td className="py-3 text-slate-400">{key}</td>
                    <td className="py-3 text-right text-slate-300">{hype}</td>
                    <td className="py-3 text-right text-purple-300 font-medium">{cure}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4 text-sm text-yellow-400/80">
          <span className="font-medium text-yellow-400">⚠ Draft notice: </span>
          The figures above are modelled after the $HYPE structure and have not been finalised.
          Total supply, allocation percentages, and vesting schedules must be confirmed before being encoded in contracts or official documentation.
        </div>

      </div>
    </main>
  );
}