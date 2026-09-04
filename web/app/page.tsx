"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import GuestBuyWidget from "@/components/GuestBuyWidget";
import FaqSection from "@/components/FaqSection";
import NetworkBackground from "@/components/NetworkBackground";
import LiveRatesTicker from "@/components/LiveRatesTicker";
import {
  Zap,
  ShieldCheck,
  Timer,
  UserX,
  DollarSign,
  Send,
  Layers,
  ArrowRight,
  MessageCircle,
  Code,
  Gift,
  Sparkles,
  Users,
  ChevronDown,
  Globe2,
  LogIn,
} from "lucide-react";

const TRUST_BADGES = [
  { icon: Timer, label: "< 30s delivery" },
  { icon: ShieldCheck, label: "Non-custodial" },
  { icon: UserX, label: "Zero KYC" },
];

const DIFFERENTIATORS = [
  {
    icon: UserX,
    title: "Instant guest checkout",
    copy: "No account, no email, no sign-in wall. Paste a wallet address and pay.",
  },
  {
    icon: DollarSign,
    title: "Transparent USD fees",
    copy: "One flat fee, shown in dollars and Naira before you pay — never buried in the exchange rate.",
  },
  {
    icon: Send,
    title: "Telegram sync",
    copy: "Orders started on the web show up in the bot, and vice versa — one order history either way.",
  },
  {
    icon: Layers,
    title: "Cross-chain engine",
    copy: "One dispensing engine routes every request, so adding a new chain doesn't mean a new system.",
  },
];

const NETWORKS = [
  { chain: "Solana", symbol: "SOL", status: "operational" as const, color: "#14F195", copy: "Memecoins, Jupiter, and Raydium." },
  { chain: "TON", symbol: "TON", status: "operational" as const, color: "#0098EA", copy: "Telegram apps, jettons, and drops." },
  { chain: "BNB Chain", symbol: "BNB", status: "operational" as const, color: "#F0B90B", copy: "PancakeSwap and BSC launches." },
  { chain: "Base", symbol: "ETH", status: "operational" as const, color: "#0052FF", copy: "Coinbase's L2 — fast and cheap." },
  { chain: "USDT", symbol: "Multi-chain", status: "operational" as const, color: "#26A17B", copy: "Bridged across every chain above." },
];

const statusColor: Record<string, string> = {
  operational: "#4ADE80",
  degraded: "#F2B84B",
  down: "#F2735C",
};

const PRODUCTS_MENU = [
  { icon: Zap, title: "Gas dispensing", copy: "Buy SOL, TON, BNB, or Base gas in Naira, delivered in minutes.", href: "#" },
  { icon: Layers, title: "Cross-chain swap", copy: "Convert gas across chains in a single step.", href: "#swap", tag: "Soon" },
  { icon: Send, title: "Telegram bot", copy: "Order gas without leaving Telegram.", href: "https://t.me/YourGasBotHandle" },
  { icon: Gift, title: "Airdrops hub", copy: "Track verified airdrops worth the gas to claim.", href: "/airdrops" },
  { icon: Sparkles, title: "Web dispenser", copy: "Skip Telegram — connect a wallet directly.", href: "/features", tag: "Soon" },
  { icon: Users, title: "Refer & earn", copy: "Get a share of what your friends spend.", href: "/features", tag: "Soon" },
];

export default function Home() {
  const [openMenu, setOpenMenu] = useState<"products" | "networks" | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
        .ticket {
          background: #12181f;
          border: 1px solid #232c36;
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
        @keyframes float-a {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-16px) rotate(10deg);
          }
        }
        @keyframes float-b {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(20px) rotate(-8deg);
          }
        }
        @keyframes float-c {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .float-a {
          animation: float-a 9s ease-in-out infinite;
        }
        .float-b {
          animation: float-b 12s ease-in-out infinite;
        }
        .float-c {
          animation: float-c 7s ease-in-out infinite;
        }
        @keyframes menu-in {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .menu-in {
          animation: menu-in 0.15s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .float-a,
          .float-b,
          .float-c {
            animation: none;
          }
        }
        @keyframes swap-pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
        }
        @keyframes swap-glow {
          0%,
          100% {
            box-shadow: 0 0 20px rgba(255, 138, 61, 0.1);
          }
          50% {
            box-shadow: 0 0 40px rgba(255, 138, 61, 0.3);
          }
        }
        @keyframes swap-arrow {
          0%,
          100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(4px);
          }
        }
        @keyframes swap-fade {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .swap-fade {
          opacity: 0;
          animation: swap-fade 0.6s ease-out forwards;
        }
        .swap-pulse {
          animation: swap-pulse 3s ease-in-out infinite;
        }
        .swap-glow {
          animation: swap-glow 3s ease-in-out infinite;
        }
        .swap-arrow {
          animation: swap-arrow 2s ease-in-out infinite;
        }
        .swap-fade {
          animation: swap-fade 0.6s ease-out forwards;
        }
      `}</style>

      {/* Nav with mega menus */}
      <nav ref={navRef} className="border-b border-[#232C36] bg-[#0B0F14]/85 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#FF8A3D]" />
            <span className="font-display text-lg font-semibold text-white">Trezvor</span>
          </Link>

          <div className="hidden md:flex items-center gap-1 text-sm">
            <button
              onClick={() => setOpenMenu((m) => (m === "products" ? null : "products"))}
              className={`flex items-center gap-1 px-3 py-2 rounded-sm transition-colors ${
                openMenu === "products" ? "text-white bg-[#161B22]" : "text-[#8B98A5] hover:text-white"
              }`}
            >
              Products
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openMenu === "products" ? "rotate-180" : ""}`} />
            </button>
            <button
              onClick={() => setOpenMenu((m) => (m === "networks" ? null : "networks"))}
              className={`flex items-center gap-1 px-3 py-2 rounded-sm transition-colors ${
                openMenu === "networks" ? "text-white bg-[#161B22]" : "text-[#8B98A5] hover:text-white"
              }`}
            >
              Networks
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openMenu === "networks" ? "rotate-180" : ""}`} />
            </button>
            <a href="#faq" className="px-3 py-2 text-[#8B98A5] hover:text-white transition-colors">
              FAQ
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <a href="/login" className="font-data text-xs px-4 py-2 border border-[#232C36] text-[#8B98A5] hover:text-white hover:border-[#4A5560] rounded-sm transition-colors">
              Sign in
            </a>
            <a href="https://t.me/YourGasBotHandle" target="_blank" rel="noopener noreferrer">
              <span className="font-data text-xs px-4 py-2 bg-[#FF8A3D] hover:bg-[#FF9D5C] text-[#0B0F14] font-semibold rounded-sm transition-colors">
                Open the bot
              </span>
            </a>
          </div>
        </div>

        {/* Products mega menu */}
        {openMenu === "products" && (
          <div className="border-t border-[#232C36] bg-[#0B0F14]">
            <div className="container mx-auto px-4 py-6 menu-in">
              <div className="grid md:grid-cols-3 gap-3 max-w-4xl">
                {PRODUCTS_MENU.map(({ icon: Icon, title, copy, href, tag }) => (
                  <a
                    key={title}
                    href={href}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                    onClick={() => setOpenMenu(null)}
                    className="flex items-start gap-3 p-3 rounded-md hover:bg-[#12181F] transition-colors"
                  >
                    <div className="p-2 bg-[#12181F] border border-[#232C36] rounded-md shrink-0">
                      <Icon className="h-4 w-4 text-[#FF8A3D]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-display text-sm font-medium text-white">{title}</p>
                        {tag && <span className="text-[10px] text-[#F2B84B] border border-[#F2B84B]/40 rounded-sm px-1.5">{tag}</span>}
                      </div>
                      <p className="text-xs text-[#8B98A5] mt-0.5">{copy}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Networks mega menu */}
        {openMenu === "networks" && (
          <div className="border-t border-[#232C36] bg-[#0B0F14]">
            <div className="container mx-auto px-4 py-6 menu-in">
              <div className="grid md:grid-cols-3 gap-3 max-w-4xl">
                {NETWORKS.map((n) => (
                  <a
                    key={n.chain}
                    href="#networks"
                    onClick={() => setOpenMenu(null)}
                    className="flex items-start gap-3 p-3 rounded-md hover:bg-[#12181F] transition-colors"
                  >
                    <div
                      className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 font-display text-xs font-semibold"
                      style={{ backgroundColor: `${n.color}1A`, color: n.color }}
                    >
                      {n.symbol.slice(0, 1)}
                    </div>
                    <div>
                      <p className="font-display text-sm font-medium text-white">{n.chain}</p>
                      <p className="text-xs text-[#8B98A5] mt-0.5">{n.copy}</p>
                    </div>
                  </a>
                ))}
                <a
                  href="#networks"
                  onClick={() => setOpenMenu(null)}
                  className="flex items-start gap-3 p-3 rounded-md hover:bg-[#12181F] transition-colors"
                >
                  <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 bg-[#12181F] border border-[#232C36]">
                    <Globe2 className="h-4 w-4 text-[#8B98A5]" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-medium text-white">All networks</p>
                    <p className="text-xs text-[#8B98A5] mt-0.5">Every chain we support today.</p>
                  </div>
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      <LiveRatesTicker />

      <main className="container mx-auto px-4">
        {/* Hero */}
        <div className="relative">
          <NetworkBackground className="absolute inset-0 w-full h-full opacity-70" density={1.1} />

          {/* Floating accents */}
          <div className="absolute -top-4 right-[8%] h-16 w-16 rounded-lg border border-[#232C36] rotate-12 float-a hidden md:block" />
          <div className="absolute top-1/3 right-[2%] h-10 w-10 rounded-full border border-[#232C36] float-b hidden md:block" />
          <div className="absolute bottom-10 left-[6%] h-24 w-24 rounded-full bg-[#FF8A3D]/10 blur-2xl float-c hidden md:block" />

          <div className="relative grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center py-20 md:py-24">
            <div>
              <h1 className="font-display text-5xl md:text-[3.3rem] leading-[1.05] font-semibold mb-6 max-w-xl">
                <span className="text-white">Buy gas in seconds.</span>
                <br />
                <span className="bg-gradient-to-r from-[#FF8A3D] to-[#FFD37D] bg-clip-text text-transparent">
                  No account required.
                </span>
              </h1>
              <p className="text-lg text-[#8B98A5] mb-7 max-w-md leading-relaxed">
                Pick an asset, paste your wallet, pay in Naira. Trezvor sends the gas — nothing else needed.
              </p>
              <div className="flex flex-wrap gap-4">
                {TRUST_BADGES.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="flex items-center gap-2 text-sm text-[#8B98A5] border border-[#232C36] rounded-sm px-3 py-1.5 bg-[#0B0F14]/60 backdrop-blur-sm"
                  >
                    <Icon className="h-3.5 w-3.5 text-[#FF8A3D]" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <GuestBuyWidget />
          </div>
        </div>

        {/* Differentiators */}
        <div className="py-20 border-t border-[#232C36]">
          <h2 className="font-display text-2xl font-semibold text-white mb-10 max-w-md">
            Built to skip every step that isn&apos;t buying gas
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            {DIFFERENTIATORS.map(({ icon: Icon, title, copy }) => (
              <div key={title} className="ticket rounded-md p-6 hover:border-[#4A5560] transition-colors">
                <Icon className="h-4 w-4 text-[#FF8A3D] mb-4" />
                <p className="font-display font-medium text-white mb-2">{title}</p>
                <p className="text-sm text-[#8B98A5] leading-relaxed">{copy}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Supported networks */}
        <div id="networks" className="py-20 border-t border-[#232C36]">
          <h2 className="font-display text-2xl font-semibold text-white mb-2">Supported networks</h2>
          <p className="text-[#8B98A5] mb-10 max-w-lg">Live status, checked continuously.</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-5 border-y border-[#232C36]">
            {NETWORKS.map((n, i) => (
              <div key={n.chain} className={`py-5 px-4 ${i !== 0 ? "md:border-l border-[#232C36]" : ""}`}>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="h-7 w-7 rounded-md flex items-center justify-center font-display text-xs font-semibold"
                    style={{ backgroundColor: `${n.color}1A`, color: n.color }}
                  >
                    {n.symbol.slice(0, 1)}
                  </div>
                  <span className="relative flex h-1.5 w-1.5">
                    <span
                      className="live-dot absolute inline-flex h-full w-full rounded-full"
                      style={{ backgroundColor: statusColor[n.status] }}
                    />
                  </span>
                </div>
                <p className="font-display font-medium text-white">{n.chain}</p>
                <p className="font-data text-xs text-[#4A5560]">{n.symbol}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cross-chain swap preview */}
        <div id="swap" className="py-20 border-t border-[#232C36] relative overflow-hidden">
          {/* Animated background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FF8A3D]/5 rounded-full blur-3xl swap-pulse" />

          <div className="relative grid lg:grid-cols-[1fr_0.9fr] gap-14 items-center">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="font-data text-sm text-[#8B98A5]">Upcoming</p>
                <div className="h-2 w-2 rounded-full bg-[#FF8A3D] swap-pulse" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-white max-w-md mb-4">
                Swap gas across chains directly
              </h2>
              <p className="text-[#8B98A5] max-w-sm leading-relaxed">
                Hold SOL but need TON gas? Skip the manual bridge — swap and dispense in one step.
              </p>
            </div>

            <div className="receipt rounded-md p-6 md:p-8 swap-glow">
              <div className="flex items-center gap-4">
                <div className="flex-1 border border-[#232C36] rounded-md p-4 bg-[#0B0F14]/50 backdrop-blur-sm swap-fade" style={{ animationDelay: '0.1s' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-full bg-[#14F195]/20 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-[#14F195]" />
                    </div>
                    <p className="text-xs text-[#8B98A5]">From</p>
                  </div>
                  <p className="font-display text-white font-medium text-lg">SOL</p>
                  <p className="font-data text-xs text-[#4A5560] mt-1">0.10 SOL</p>
                </div>
                <ArrowRight className="h-5 w-5 text-[#FF8A3D] shrink-0 swap-arrow" />
                <div className="flex-1 border border-[#232C36] rounded-md p-4 bg-[#0B0F14]/50 backdrop-blur-sm swap-fade" style={{ animationDelay: '0.2s' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-full bg-[#0098EA]/20 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-[#0098EA]" />
                    </div>
                    <p className="text-xs text-[#8B98A5]">To</p>
                  </div>
                  <p className="font-display text-white font-medium text-lg">TON gas</p>
                  <p className="font-data text-xs text-[#4A5560] mt-1">≈ 8.15 TON</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-[#12181F] border border-[#232C36] rounded-md swap-fade" style={{ animationDelay: '0.3s' }}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#8B98A5]">Exchange rate</span>
                  <span className="font-data text-white">1 SOL ≈ 81.5 TON</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-[#8B98A5]">Fee</span>
                  <span className="font-data text-[#4ADE80]">0.01 SOL</span>
                </div>
              </div>

              <button
                disabled
                className="w-full mt-6 border border-[#232C36] text-[#4A5560] rounded-sm py-2.5 text-sm cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Coming soon
              </button>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div id="faq" className="py-20 border-t border-[#232C36]">
          <h2 className="font-display text-2xl font-semibold text-white mb-10 text-center">Questions, answered</h2>
          <FaqSection />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#232C36] bg-[#0B0F14]">
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center gap-2 mb-8 text-sm text-[#8B98A5]">
            <span className="relative flex h-2 w-2">
              <span className="live-dot absolute inline-flex h-full w-full rounded-full bg-[#4ADE80]" />
            </span>
            All systems operational
          </div>

          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-[#FF8A3D]" />
                <span className="font-display text-lg font-semibold text-white">Trezvor</span>
              </div>
              <p className="text-sm text-[#8B98A5] max-w-xs">
                Instant micro-gas dispensing for Solana, TON, BNB Chain, and Base — no account required.
              </p>
              <div className="flex gap-3 mt-4">
                <a href="#" className="text-[#8B98A5] hover:text-white transition-colors">
                  <MessageCircle className="h-4 w-4" />
                </a>
                <a href="#" className="text-[#8B98A5] hover:text-white transition-colors">
                  <Send className="h-4 w-4" />
                </a>
                <a href="#" className="text-[#8B98A5] hover:text-white transition-colors">
                  <Code className="h-4 w-4" />
                </a>
              </div>
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
            <div>
              <h4 className="font-display font-medium mb-4 text-white text-sm">Legal</h4>
              <ul className="space-y-2 text-sm text-[#8B98A5]">
                <li><a href="#" className="hover:text-white transition-colors">Terms of service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Risk disclosure</a></li>
              </ul>
            </div>
          </div>
          <div className="text-sm text-[#4A5560] pt-8 border-t border-[#232C36] font-data">
            © 2024 Trezvor. Not financial advice — crypto carries risk.
          </div>
        </div>
      </footer>
    </div>
  );
}