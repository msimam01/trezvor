"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "Do I need to sign up or create an account?",
    answer:
      "No. You can buy gas as a guest — pick an asset, enter your wallet address, and pay. An account only matters if you want order history saved to a profile.",
  },
  {
    question: "How fast is delivery?",
    answer:
      "Most orders settle in under 30 seconds once payment clears. Occasionally a chain runs low on liquidity and an order queues — you'll see that status live.",
  },
  {
    question: "Do you ever hold my funds?",
    answer:
      "No. Trezvor is non-custodial — gas is sent directly to the destination wallet you provide. We never take custody of your crypto.",
  },
  {
    question: "Is KYC required?",
    answer:
      "Not for standard gas top-ups. You're buying a small, fixed amount of a network's native token — not opening a trading account.",
  },
  {
    question: "Which networks and assets are supported?",
    answer:
      "Solana, TON, BNB Chain, and Base natively, plus USDT bridged across all four. Cross-chain swaps between them are in progress.",
  },
  {
    question: "What if my transaction fails or liquidity runs out?",
    answer:
      "Failed orders are refunded automatically. If a vault is temporarily low, your order queues as pending and dispenses as soon as liquidity is restored.",
  },
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="max-w-3xl mx-auto">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.question} className="border-b border-[#232C36]">
            <button
              onClick={() => toggle(index)}
              className="w-full flex items-center justify-between gap-4 py-5 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-display text-white font-medium">{item.question}</span>
              <ChevronDown
                className={`h-4 w-4 text-[#8B98A5] shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className="grid transition-all duration-200 ease-in-out"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="text-[#8B98A5] pb-5 pr-8 leading-relaxed">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}