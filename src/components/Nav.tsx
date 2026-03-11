"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-800 bg-[#0d1425] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="XCure"
            width={40}
            height={40}
            className="rounded-lg object-contain"
            priority
          />
          <p className="text-xs text-slate-400 hidden sm:block">Biotech AI Investment Research</p>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/"
                ? "bg-blue-600/20 text-blue-400"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            Analyze
          </Link>
          <Link
            href="/swap"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/swap"
                ? "bg-blue-600/20 text-blue-400"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            Swap
          </Link>
        </nav>
      </div>
    </header>
  );
}
