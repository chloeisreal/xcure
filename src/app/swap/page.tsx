import SwapWidget from "@/components/SwapWidget";

export default function SwapPage() {
  return (
    <main className="flex flex-col" style={{ minHeight: "calc(100vh - 57px)" }}>
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-2xl font-bold text-white">Biotech Token Swap</h1>
          <p className="text-slate-400 text-sm">
            Swap between leading biotech and DeSci tokens
          </p>
        </div>
        <SwapWidget />
      </section>

      <footer className="border-t border-slate-800 py-4">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-slate-600">
          XCure — Not financial advice. Research purposes only.
        </div>
      </footer>
    </main>
  );
}
