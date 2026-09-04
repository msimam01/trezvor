"use client";

const RATES = [
  { symbol: "SOL", name: "Solana", price: 140000, color: "#14F195", change: "+2.5%" },
  { symbol: "TON", name: "TON", price: 1840, color: "#0098EA", change: "+4.2%" },
  { symbol: "BNB", name: "BNB Chain", price: 950000, color: "#F0B90B", change: "+0.8%" },
  { symbol: "ETH", name: "Base", price: 3600000, color: "#0052FF", change: "+1.8%" },
  { symbol: "USDT", name: "Tether", price: 1550, color: "#26A17B", change: "+0.1%" },
];

function TickerRow() {
  return (
    <div className="flex items-center gap-10 shrink-0 pr-10">
      {RATES.map((r) => (
        <div key={r.symbol} className="flex items-center gap-2.5 whitespace-nowrap">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: r.color, boxShadow: `0 0 8px ${r.color}66` }}
          />
          <span className="font-display text-sm text-white font-medium">{r.symbol}</span>
          <span className="font-data text-sm text-[#8B98A5]">₦{r.price.toLocaleString()}</span>
          <span className="font-data text-xs text-[#4ADE80]">{r.change}</span>
        </div>
      ))}
    </div>
  );
}

export default function LiveRatesTicker() {
  return (
    <div className="border-y border-[#232C36] bg-[#0B0F14] overflow-hidden">
      <style jsx>{`
        @keyframes ticker-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        .ticker-track {
          animation: ticker-scroll 28s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track {
            animation: none;
          }
        }
      `}</style>
      <div className="flex py-3 ticker-track w-max">
        <TickerRow />
        <TickerRow />
      </div>
    </div>
  );
}