import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "XCure — Biotech AI Investment Research",
  description:
    "XCure provides AI-powered investment research for biotech projects and tokens. Get structured analysis on scientific credibility, team, clinical progress, and tokenomics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} antialiased bg-[#0a0f1e] text-white min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
