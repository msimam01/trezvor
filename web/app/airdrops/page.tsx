"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/filter-bar";
import { ArrowUpRight, Gift, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";

// Extended airdrop data with more details
const airdrops = [
  {
    id: 1,
    name: "LayerZero",
    network: "Multi-chain",
    estimatedReward: "$500-$2,000",
    status: "live",
    difficulty: "Advanced",
    requirements: ["Bridge assets", "Use dApps", "Provide liquidity", "Deploy contracts"],
    joinLink: "https://layerzero.network",
    verified: true,
    hot: true,
    icon: "🌐",
  },
  {
    id: 2,
    name: "Starknet",
    network: "Ethereum L2",
    estimatedReward: "$300-$1,500",
    status: "live",
    difficulty: "Advanced",
    requirements: ["Deploy contracts", "Use bridge", "Interact with protocols", "NFT minting"],
    joinLink: "https://starknet.io",
    verified: true,
    hot: true,
    icon: "⚡",
  },
  {
    id: 3,
    name: "ZkSync",
    network: "Ethereum L2",
    estimatedReward: "$200-$800",
    status: "upcoming",
    difficulty: "Medium",
    requirements: ["Bridge assets", "Use dApps", "NFT minting", "Social tasks"],
    joinLink: "https://zksync.io",
    verified: true,
    hot: false,
    icon: "🔒",
  },
  {
    id: 4,
    name: "Scroll",
    network: "Ethereum L2",
    estimatedReward: "$100-$500",
    status: "live",
    difficulty: "Medium",
    requirements: ["Bridge tokens", "Use DeFi protocols", "NFT interactions", "Social actions"],
    joinLink: "https://scroll.io",
    verified: true,
    hot: false,
    icon: "📜",
  },
  {
    id: 5,
    name: "Linea",
    network: "Ethereum L2",
    estimatedReward: "$150-$600",
    status: "upcoming",
    difficulty: "Easy",
    requirements: ["Bridge assets", "Use swap", "NFT marketplace", "Simple tasks"],
    joinLink: "https://linea.build",
    verified: false,
    hot: false,
    icon: "🔗",
  },
  {
    id: 6,
    name: "Base",
    network: "Coinbase L2",
    estimatedReward: "$50-$200",
    status: "live",
    difficulty: "Easy",
    requirements: ["Use Base bridge", "Interact with dApps", "Social actions", "NFT minting"],
    joinLink: "https://base.org",
    verified: true,
    hot: true,
    icon: "🔵",
  },
  {
    id: 7,
    name: "Solana Saga",
    network: "Solana",
    estimatedReward: "$100-$400",
    status: "live",
    difficulty: "Medium",
    requirements: ["Use Saga device", "Mobile dApps", "NFT interactions", "DeFi protocols"],
    joinLink: "https://solanamobile.com",
    verified: true,
    hot: false,
    icon: "📱",
  },
  {
    id: 8,
    name: "Ton Space",
    network: "TON",
    estimatedReward: "$50-$150",
    status: "upcoming",
    difficulty: "Easy",
    requirements: ["Use TON wallet", "Play games", "NFT collection", "Social tasks"],
    joinLink: "https://ton.org",
    verified: true,
    hot: false,
    icon: "💎",
  },
];

const networkOptions = [
  { value: "all", label: "All Networks" },
  { value: "Multi-chain", label: "Multi-chain" },
  { value: "Ethereum L2", label: "Ethereum L2" },
  { value: "Solana", label: "Solana" },
  { value: "TON", label: "TON" },
  { value: "Coinbase L2", label: "Coinbase L2" },
];

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "live", label: "Live" },
  { value: "upcoming", label: "Upcoming" },
];

const difficultyOptions = [
  { value: "all", label: "All Difficulty" },
  { value: "Easy", label: "Easy" },
  { value: "Medium", label: "Medium" },
  { value: "Advanced", label: "Advanced" },
];

const difficultyColor: Record<string, string> = {
  Easy: "#4ADE80",
  Medium: "#F2B84B",
  Advanced: "#F2735C",
};

export default function AirdropsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");

  const filteredAirdrops = airdrops.filter((airdrop) => {
    const matchesSearch =
      airdrop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      airdrop.network.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesNetwork = networkFilter === "all" || airdrop.network === networkFilter;
    const matchesStatus = statusFilter === "all" || airdrop.status === statusFilter;
    const matchesDifficulty = difficultyFilter === "all" || airdrop.difficulty === difficultyFilter;

    return matchesSearch && matchesNetwork && matchesStatus && matchesDifficulty;
  });

  const activeFilters = [];
  if (networkFilter !== "all") activeFilters.push({ key: "network", value: networkFilter, label: "Network" });
  if (statusFilter !== "all") activeFilters.push({ key: "status", value: statusFilter, label: "Status" });
  if (difficultyFilter !== "all") activeFilters.push({ key: "difficulty", value: difficultyFilter, label: "Difficulty" });

  const clearFilter = (key: string) => {
    if (key === "network") setNetworkFilter("all");
    if (key === "status") setStatusFilter("all");
    if (key === "difficulty") setDifficultyFilter("all");
  };

  const clearAllFilters = () => {
    setNetworkFilter("all");
    setStatusFilter("all");
    setDifficultyFilter("all");
    setSearchQuery("");
  };

  const stats = [
    { label: "Tracked", value: airdrops.length },
    { label: "Live now", value: airdrops.filter((a) => a.status === "live").length },
    { label: "Verified", value: airdrops.filter((a) => a.verified).length },
    { label: "Trending", value: airdrops.filter((a) => a.hot).length },
  ];

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
      <main className="container mx-auto px-4 py-24">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-12 max-w-2xl">
            <div className="flex items-center gap-2 mb-5 text-sm text-[#8B98A5]">
              <span className="relative flex h-2 w-2">
                <span className="live-dot absolute inline-flex h-full w-full rounded-full bg-[#4ADE80]" />
              </span>
              {stats[1].value} live right now
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4 text-white">
              Airdrops worth your gas
            </h1>
            <p className="text-lg text-[#8B98A5]">
              A running list of verified opportunities, sorted by network and how much work they take to claim.
            </p>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-y border-[#232C36] mb-10">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`py-5 px-1 ${i !== 0 ? "md:border-l border-[#232C36]" : ""} ${
                  i % 2 !== 0 ? "border-l md:border-l-0 border-[#232C36]" : ""
                }`}
              >
                <p className="font-data text-3xl font-semibold text-white">{s.value}</p>
                <p className="text-sm text-[#8B98A5]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filter Bar */}
          <FilterBar
            searchPlaceholder="Search airdrops by name or network..."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            filters={[
              {
                key: "network",
                label: "Network",
                options: networkOptions,
                value: networkFilter,
                onChange: setNetworkFilter,
              },
              {
                key: "status",
                label: "Status",
                options: statusOptions,
                value: statusFilter,
                onChange: setStatusFilter,
              },
              {
                key: "difficulty",
                label: "Difficulty",
                options: difficultyOptions,
                value: difficultyFilter,
                onChange: setDifficultyFilter,
              },
            ]}
            activeFilters={activeFilters}
            onClearFilter={clearFilter}
            onClearAll={clearAllFilters}
          />

          {/* Airdrops grid — tickets, not cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            {filteredAirdrops.map((airdrop) => (
              <div key={airdrop.id} className="ticket rounded-md p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl leading-none">{airdrop.icon}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-display font-medium text-white">{airdrop.name}</p>
                        {airdrop.verified && <CheckCircle2 className="h-3.5 w-3.5 text-[#8B98A5]" />}
                      </div>
                      <p className="text-xs text-[#8B98A5]">{airdrop.network}</p>
                    </div>
                  </div>
                  {airdrop.hot && (
                    <span className="text-xs text-[#FF8A3D] whitespace-nowrap">Trending</span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-[#8B98A5] mb-4 pb-4 border-b border-dashed border-[#232C36]">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        airdrop.status === "live" ? "bg-[#4ADE80]" : "bg-[#4A5560]"
                      }`}
                    />
                    {airdrop.status === "live" ? "Live" : "Upcoming"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: difficultyColor[airdrop.difficulty] }}
                    />
                    {airdrop.difficulty}
                  </span>
                </div>

                <p className="text-xs text-[#8B98A5] mb-1">Estimated reward</p>
                <p className="font-data text-lg font-semibold text-white mb-4">
                  {airdrop.estimatedReward}
                </p>

                <ul className="space-y-1.5 mb-5 flex-1">
                  {airdrop.requirements.slice(0, 3).map((req, index) => (
                    <li key={index} className="text-sm text-[#8B98A5] flex items-start gap-2">
                      <span className="text-[#4A5560] mt-1.5 h-1 w-1 rounded-full bg-[#4A5560] shrink-0" />
                      {req}
                    </li>
                  ))}
                  {airdrop.requirements.length > 3 && (
                    <li className="text-sm text-[#4A5560] pl-3">
                      +{airdrop.requirements.length - 3} more tasks
                    </li>
                  )}
                </ul>

                <a href={airdrop.joinLink} target="_blank" rel="noopener noreferrer" className="w-full">
                  <Button className="w-full bg-[#FF8A3D] hover:bg-[#FF9D5C] text-[#0B0F14] font-semibold rounded-sm">
                    Claim this airdrop
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </div>
            ))}
          </div>

          {filteredAirdrops.length === 0 && (
            <div className="text-center py-16">
              <Gift className="h-10 w-10 text-[#4A5560] mx-auto mb-4" />
              <h3 className="font-display text-lg font-medium mb-2 text-white">No airdrops match those filters</h3>
              <p className="text-[#8B98A5]">Try widening your search or clearing a filter.</p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="mt-16 border border-[#232C36] rounded-md p-6">
            <p className="font-display font-medium text-white mb-2">Before you claim anything</p>
            <p className="text-sm text-[#8B98A5] leading-relaxed">
              Airdrops carry real risk. Research a project before committing time or funds, and never share a
              private key or seed phrase — no legitimate airdrop asks for one. Trezvor aggregates public
              information only and isn&apos;t responsible for the outcome of any airdrop. Estimated rewards are
              drawn from historical data and can vary significantly.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#232C36] bg-[#0B0F14] mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-[#4A5560] font-data">
          © 2024 Trezvor. Airdrop information is provided for educational purposes.
        </div>
      </footer>
    </div>
  );
}