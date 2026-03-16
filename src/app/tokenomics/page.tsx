"use client";

import { useEffect, useRef } from "react";

const TOTAL_SUPPLY = 1_000_000_000;

const allocations = [
  { label: "社区奖励 & 生态激励", labelEn: "Community & Ecosystem", pct: 38, color: "#7c3aed", vesting: "按季度线性释放，周期至 2028 年", uses: ["质押奖励", "流动性挖矿", "AI 投研订阅"] },
  { label: "创世分配", labelEn: "Genesis Distribution", pct: 25, color: "#2563eb", vesting: "TGE 时 100% 即时解锁", uses: ["测试网参与者", "早期 Swap 用户", "种子社区"] },
  { label: "团队 & 顾问", labelEn: "Team & Advisors", pct: 20, color: "#9333ea", vesting: "1 年 cliff → 之后 3 年线性月解锁", uses: ["核心开发团队", "战略顾问"] },
  { label: "基金会 / 胡桃资本", labelEn: "Foundation / Walnut Capital", pct: 12, color: "#3b82f6", vesting: "TGE 解锁 20%，余下 2 年线性", uses: ["运营资金", "法律合规", "BD & 市场"] },
  { label: "生态 Grants", labelEn: "Ecosystem Grants", pct: 5, color: "#6366f1", vesting: "按项目里程碑分批释放", uses: ["DeSci 项目", "开发者激励", "社区建设"] },
];

const useCases = [
  { icon: "⛽", title: "Gas 费用", desc: "Cure Chain（Layer 3）网络的原生 gas 代币" },
  { icon: "🗳", title: "治理投票", desc: "持有 $CURE 参与协议参数与升级提案投票" },
  { icon: "🔒", title: "质押挖矿", desc: "质押 $CURE 获取协议收益分红与排放奖励" },
  { icon: "🧬", title: "AI 投研订阅", desc: "订阅 XCure AI BioMed 投研工具的访问权限" },
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
            <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1 rounded-full font-medium">草稿 · 待确认</span>
          </div>
          <p className="text-slate-400 text-sm">Cure Chain（Layer 3）原生代币 · 参考 Hyperliquid $HYPE 结构设计 · 关联公司：胡桃资本</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "总量", value: "1,000,000,000", sub: "$CURE" },
            { label: "VC 融资份额", value: "0%", sub: "零 VC 模型" },
            { label: "TGE 初始流通", value: "~25%", sub: "创世分配即时解锁" },
            { label: "参考原型", value: "$HYPE", sub: "Hyperliquid" },
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
          <h2 className="text-base font-medium text-white mb-5">解锁 & 释放计划</h2>
          <div className="divide-y divide-slate-700/50">
            {allocations.map((a) => (
              <div key={a.label} className="py-4 flex items-start gap-4">
                <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: a.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{a.label}</span>
                    <span className="text-xs text-slate-500">{a.labelEn}</span>
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
          <h2 className="text-base font-medium text-white mb-5">$CURE 用途</h2>
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
          <h2 className="text-base font-medium text-white mb-5">与 $HYPE 对比</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs">
                  <th className="text-left pb-3 font-medium">指标</th>
                  <th className="text-right pb-3 font-medium">$HYPE（参考）</th>
                  <th className="text-right pb-3 font-medium text-purple-400">$CURE（草稿）</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {[
                  ["总量", "1,000,000,000", "1,000,000,000"],
                  ["社区份额", "38.89% + 31% 空投", "38% + 25% 创世"],
                  ["团队份额", "23.80%", "20%"],
                  ["基金会", "6.00%", "12%"],
                  ["VC 份额", "0%", "0%"],
                  ["回购销毁", "97% 协议手续费", "待定"],
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
          <span className="font-medium text-yellow-400">⚠ 草稿说明：</span>
          以上数字参考 $HYPE 结构制定，尚未最终确认。$CURE 总量、分配比例及释放计划需确认后方可写入合约与正式文档。
        </div>

      </div>
    </main>
  );
}