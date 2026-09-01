"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { Wallet, Building2, ArrowRightLeft, BellRing, Check } from "lucide-react";

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: any;
  status: "coming-soon" | "beta" | "launched";
  tags: string[];
  details: string[];
}

const features: Feature[] = [
  {
    id: "web-gas-dispenser",
    title: "Instant Web Gas Dispenser",
    description: "Buy SOL, ETH, TON directly via Web3 wallet connection",
    icon: Wallet,
    status: "coming-soon",
    tags: ["Web3", "Direct", "No bot"],
    details: [
      "Connect a wallet — Phantom, MetaMask, TON Connect",
      "Buy gas instantly with no Telegram required",
      "Real-time balance and transaction monitoring",
      "Support for Solana, Base, and TON networks",
    ],
  },
  {
    id: "virtual-bank-accounts",
    title: "Dedicated Virtual Bank Accounts",
    description: "Get a dedicated NGN transfer account for automatic wallet funding",
    icon: Building2,
    status: "beta",
    tags: ["Banking", "Auto-fund", "NGN"],
    details: [
      "A unique virtual bank account per user",
      "Automatic wallet funding on transfer",
      "Instant NGN-to-crypto conversion",
      "Works with all major Nigerian banks",
    ],
  },
  {
    id: "crypto-offramp",
    title: "Crypto-to-Fiat Offramp",
    description: "Exchange small crypto balances back to NGN instantly",
    icon: ArrowRightLeft,
    status: "coming-soon",
    tags: ["Offramp", "Fiat", "Instant"],
    details: [
      "Sell SOL, ETH, TON for NGN instantly",
      "Deposits go straight to your bank account",
      "Competitive, transparent exchange rates",
      "No minimum withdrawal amount",
    ],
  },
  {
    id: "auto-refill",
    title: "Automated Gas Auto-Refill",
    description: "Subscription-based top-ups so your wallet never runs dry",
    icon: BellRing,
    status: "coming-soon",
    tags: ["Subscription", "Automatic", "Recurring"],
    details: [
      "Schedule recurring gas top-ups",
      "Never run out of gas mid-transaction",
      "Set your own refill threshold",
      "Pause or cancel anytime",
    ],
  },
];

const statusMeta: Record<Feature["status"], { label: string; color: string }> = {
  "coming-soon": { label: "Coming soon", color: "#4A5560" },
  beta: { label: "In beta", color: "#F2B84B" },
  launched: { label: "Launched", color: "#4ADE80" },
};

export default function FeaturesPage() {
  const [notifications, setNotifications] = useState<Record<string, boolean>>({});

  const toggleNotification = (featureId: string) => {
    setNotifications((prev) => ({
      ...prev,
      [featureId]: !prev[featureId],
    }));
  };

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
      `}</style>

      <Navbar />
      <main className="container mx-auto px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 max-w-2xl">
            <p className="font-data text-sm text-[#8B98A5] mb-4">Roadmap</p>
            <h1 className="font-display text-4xl md:text-5xl font-semibold text-white mb-4">
              What&apos;s filling the tank next
            </h1>
            <p className="text-lg text-[#8B98A5]">
              Four things in progress right now, in the order we expect to ship them.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              const isNotified = notifications[feature.id];
              const status = statusMeta[feature.status];

              return (
                <div key={feature.id} className="ticket rounded-md p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <div className="p-2.5 bg-[#0B0F14] border border-[#232C36] rounded-md">
                      <Icon className="h-5 w-5 text-[#FF8A3D]" />
                    </div>
                    <span className="flex items-center gap-2 text-sm text-[#8B98A5]">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: status.color }}
                      />
                      {status.label}
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-[#8B98A5] mb-5">{feature.description}</p>

                  <div className="flex flex-wrap gap-2 mb-5">
                    {feature.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-[#8B98A5] border border-[#232C36] rounded-sm px-2 py-1"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <ul className="space-y-2 mb-6 pb-6 border-b border-dashed border-[#232C36] flex-1">
                    {feature.details.map((detail, index) => (
                      <li key={index} className="flex items-start gap-2.5 text-sm text-[#8B98A5]">
                        <span className="h-1 w-1 rounded-full bg-[#4A5560] mt-2 shrink-0" />
                        {detail}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => toggleNotification(feature.id)}
                    className={
                      isNotified
                        ? "w-full bg-transparent border border-[#4ADE80] text-[#4ADE80] hover:bg-[#4ADE80]/10 rounded-sm"
                        : "w-full bg-[#FF8A3D] hover:bg-[#FF9D5C] text-[#0B0F14] font-semibold rounded-sm"
                    }
                  >
                    {isNotified ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        We&apos;ll notify you
                      </>
                    ) : (
                      <>
                        <BellRing className="h-4 w-4 mr-2" />
                        Notify me
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Community CTA — same quiet banner pattern as the homepage */}
          <div className="mt-16 border border-[#232C36] rounded-md px-8 py-8 text-center max-w-2xl mx-auto">
            <p className="font-display text-xl font-medium text-white mb-2">
              Help decide what ships next
            </p>
            <p className="text-[#8B98A5] mb-6">
              Join the community to vote on the roadmap and get early access to beta releases.
            </p>
            <Button className="bg-[#FF8A3D] hover:bg-[#FF9D5C] text-[#0B0F14] font-semibold rounded-sm px-6">
              Join the community
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}