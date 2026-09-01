"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { Zap, ShieldCheck, Gauge, Radio, ArrowUpRight } from "lucide-react";

// Mock live rates data (in production, this would come from the API)
const CHAINS = {
  SOLANA: { rate: 140000, symbol: "SOL", change: "+2.5%", full: "Solana" },
  BASE: { rate: 3600000, symbol: "ETH", change: "+1.8%", full: "Base" },
  TON: { rate: 1840, symbol: "TON", change: "+4.2%", full: "TON" },
} as const;

type ChainKey = keyof typeof CHAINS;

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeChain, setActiveChain] = useState<ChainKey>("SOLANA");
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setSecondsAgo((s) => (s >= 12 ? 0 : s + 1)), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  const active = CHAINS[activeChain];
  const output = 1000 / active.rate;

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#EDEFEA] antialiased">
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap");
        .font-display {
          font-family: "Space Grotesk", sans-serif;
        }
        .font-data {
          font-family: "IBM Plex Mono", monospace;
          font-variant-numeric: tabular-nums;
        }
        .receipt {
          background: #12181f;
          border: 1px solid #232c36;
          position: relative;
        }
        .receipt::before,
        .receipt::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          height: 8px;
          background: radial-gradient(circle, #0b0f14 4px, transparent 4.5px);
          background-size: 16px 16px;
          background-position: -4px center;
        }
        .receipt::before {
          top: -4px;
        }
        .receipt::after {
          bottom: -4px;
        }
        @keyframes blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.35;
          }
        }
        .live-dot {
          animation: blink 1.6s ease-in-out infinite;
        }
      `}</style>

      <Navbar />

      <main className="container mx-auto px-4 py-20 md:py-28">
        {/* Hero — split layout: copy on the left, a working "pump display" on the right */}
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center mb-28">
          <div>
            <div className="flex items-center gap-2 mb-6 text-sm text-[#8B98A5]">
              <span className="relative flex h-2 w-2">
                <span className="live-dot absolute inline-flex h-full w-full rounded-full bg-[#4ADE80]" />
              </span>
              Dispensing live on Solana, Base and TON
            </div>
            <h1 className="font-display text-5xl md:text-[3.4rem] leading-[1.05] font-semibold mb-6 text-white max-w-xl">
              A dead wallet shouldn&apos;t stop a transaction.
            </h1>
            <p className="text-lg text-[#8B98A5] mb-9 max-w-md leading-relaxed">
              Top up just enough gas to move — in Naira, from Telegram, in under
              five minutes. No exchange account, no minimum trade size.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="https://t.me/YourGasBotHandle" target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  className="bg-[#FF8A3D] hover:bg-[#FF9D5C] text-[#0B0F14] font-semibold rounded-sm px-6"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Open the bot on Telegram
                </Button>
              </a>
              <a href="#how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#232C36] bg-transparent text-[#EDEFEA] hover:bg-[#161B22] rounded-sm px-6"
                >
                  See how dispensing works
                </Button>
              </a>
            </div>
          </div>

          {/* Pump display */}
          <div className="receipt rounded-md p-6 md:p-8">
            <div className="flex gap-1 mb-6 border-b border-[#232C36] pb-4">
              {(Object.keys(CHAINS) as ChainKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveChain(key)}
                  className={`font-data text-xs px-3 py-1.5 rounded-sm transition-colors ${
                    activeChain === key
                      ? "bg-[#FF8A3D] text-[#0B0F14]"
                      : "text-[#8B98A5] hover:text-[#EDEFEA]"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            <p className="text-sm text-[#8B98A5] mb-1">{active.full} · {active.symbol} network</p>
            <p className="font-data text-4xl md:text-5xl font-semibold text-white mb-1 tracking-tight">
              ₦{active.rate.toLocaleString()}
              <span className="text-lg text-[#8B98A5]">/{active.symbol}</span>
            </p>
            <p className="text-sm text-[#4ADE80] mb-6">{active.change} in the last 24h</p>

            <div className="flex items-center justify-between border-t border-dashed border-[#232C36] pt-4">
              <div>
                <p className="text-xs text-[#8B98A5] mb-1">You send</p>
                <p className="font-data text-white">₦1,000</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-[#8B98A5] rotate-90 md:rotate-0" />
              <div className="text-right">
                <p className="text-xs text-[#8B98A5] mb-1">You receive</p>
                <p className="font-data text-white">{output.toFixed(6)} {active.symbol}</p>
              </div>
            </div>

            <p className="font-data text-xs text-[#4A5560] mt-6">
              updated {secondsAgo}s ago
            </p>
          </div>
        </div>

        {/* Rate comparison — receipts, not cards */}
        <div className="mb-28">
          <h2 className="font-display text-2xl font-semibold text-white mb-2">
            Compare a chain before you send
          </h2>
          <p className="text-[#8B98A5] mb-10 max-w-lg">
            Rates come straight from our oracle feed and refresh continuously.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {(Object.entries(CHAINS) as [ChainKey, typeof CHAINS[ChainKey]][]).map(([key, data]) => (
              <div key={key} className="receipt rounded-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-display font-medium text-white">{data.full}</p>
                  <p className="font-data text-xs text-[#4ADE80]">{data.change}</p>
                </div>
                <div className="border-t border-dashed border-[#232C36] pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#8B98A5]">Rate</span>
                    <span className="font-data text-white">₦{data.rate.toLocaleString()}/{data.symbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#8B98A5]">₦1,000 buys</span>
                    <span className="font-data text-white">{(1000 / data.rate).toFixed(6)} {data.symbol}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Web dispenser — quiet banner instead of a competing card */}
        <div className="mb-28 border border-[#232C36] rounded-md px-8 py-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="font-display text-xl font-medium text-white mb-1">
              A browser dispenser is on the way
            </p>
            <p className="text-[#8B98A5] max-w-md">
              Connect a wallet directly and skip Telegram entirely — same delivery speed, more room for usage history.
            </p>
          </div>
          <Link href="/features" className="shrink-0">
            <Button variant="outline" className="border-[#232C36] bg-transparent text-[#EDEFEA] hover:bg-[#161B22] rounded-sm">
              Join the waitlist
            </Button>
          </Link>
        </div>

        {/* Why Trezvor — gauge rows, not icon circles */}
        <div id="how-it-works" className="mb-28">
          <h2 className="font-display text-2xl font-semibold text-white mb-10">
            What keeps a dispenser trustworthy
          </h2>
          <div className="divide-y divide-[#232C36] border-y border-[#232C36]">
            {[
              {
                icon: Gauge,
                title: "Delivery under five minutes",
                copy: "Requests are queued and settled automatically on most networks, with no manual approval step in the way.",
              },
              {
                icon: Radio,
                title: "Rates from more than one source",
                copy: "Pricing pulls from CoinGecko and Binance in parallel, so a single feed going down never means a bad quote.",
              },
              {
                icon: ShieldCheck,
                title: "Liquidity watched around the clock",
                copy: "Vault balances are monitored continuously, and admins are alerted before a chain runs low — before you notice.",
              },
            ].map(({ icon: Icon, title, copy }) => (
              <div key={title} className="flex flex-col md:flex-row gap-4 md:gap-10 py-7">
                <div className="flex items-center gap-3 md:w-64 shrink-0">
                  <Icon className="h-4 w-4 text-[#FF8A3D]" />
                  <p className="font-display text-white font-medium">{title}</p>
                </div>
                <p className="text-[#8B98A5] max-w-lg">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#232C36] bg-[#0B0F14]">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-[#FF8A3D]" />
                <span className="font-display text-lg font-semibold text-white">Trezvor</span>
              </div>
              <p className="text-sm text-[#8B98A5] max-w-xs">
                Instant micro-gas dispensing for Solana, Base, and TON — built for the Naira.
              </p>
            </div>
            <div>
              <h4 className="font-display font-medium mb-4 text-white text-sm">Quick links</h4>
              <ul className="space-y-2 text-sm text-[#8B98A5]">
                <li><Link href="/airdrops" className="hover:text-white transition-colors">Airdrops hub</Link></li>
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/admin" className="hover:text-white transition-colors">Admin portal</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-medium mb-4 text-white text-sm">Support</h4>
              <ul className="space-y-2 text-sm text-[#8B98A5]">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API reference</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact support</a></li>
              </ul>
            </div>
          </div>
          <div className="text-sm text-[#4A5560] pt-8 border-t border-[#232C36] font-data">
            © 2024 Trezvor. Built with Next.js, NestJS, and Telegram.
          </div>
        </div>
      </footer>
    </div>
  );
}