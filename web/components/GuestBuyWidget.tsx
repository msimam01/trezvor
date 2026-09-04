"use client";

import { useEffect, useRef, useState } from "react";
import { Wallet, Loader2, AlertCircle, Radio } from "lucide-react";

type AssetKey = "SOL" | "TON" | "BNB" | "BASE" | "USDT";
type EvmNetwork = "TON" | "SOL" | "BSC" | "BASE";

interface AssetConfig {
  label: string;
  name: string;
  rateNGN: number; // mock NGN price per 1 unit — swap for a live feed
  presets: number[];
  decimals: number;
  color: string;
  networks?: EvmNetwork[];
}

const ASSETS: Record<AssetKey, AssetConfig> = {
  SOL: { label: "SOL", name: "Solana", rateNGN: 140000, presets: [0.05, 0.1, 0.5, 1.0], decimals: 4, color: "#14F195" },
  TON: { label: "TON", name: "TON", rateNGN: 1840, presets: [5, 10, 25, 50], decimals: 2, color: "#0098EA" },
  BNB: { label: "BNB", name: "BNB Chain", rateNGN: 950000, presets: [0.01, 0.05, 0.1, 0.25], decimals: 4, color: "#F0B90B" },
  BASE: { label: "BASE", name: "Base (ETH)", rateNGN: 3600000, presets: [0.001, 0.005, 0.01, 0.05], decimals: 5, color: "#0052FF" },
  USDT: {
    label: "USDT",
    name: "Tether",
    rateNGN: 1550,
    presets: [10, 25, 50, 100],
    decimals: 2,
    color: "#26A17B",
    networks: ["TON", "SOL", "BSC", "BASE"],
  },
};

const FEE_USD = 0.1;
const FEE_NGN = 155; // fixed for now — swap for a live USD/NGN conversion

// Cycles through a few examples until the visitor touches the widget —
// purely a "this thing is alive" demo, frozen the instant someone interacts.
const IDLE_DEMO: { asset: AssetKey; network?: EvmNetwork; quantity: number }[] = [
  { asset: "SOL", quantity: 0.1 },
  { asset: "USDT", network: "TON", quantity: 50 },
  { asset: "BNB", quantity: 0.05 },
  { asset: "BASE", quantity: 0.005 },
];

interface Quote {
  tokenPriceNGN: number;
  feeNGN: number;
  totalNGN: number;
}

// Stand-in for a live pricing endpoint. Tries the real route first so this
// keeps working with zero changes once /api/pricing/quote exists, and falls
// back to a local calculation in the meantime.
async function getQuote(asset: AssetKey, network: EvmNetwork | null, quantity: number): Promise<Quote> {
  try {
    const res = await fetch("/api/pricing/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset, network, quantity }),
    });
    if (!res.ok) throw new Error("quote endpoint unavailable");
    return await res.json();
  } catch {
    const rate = ASSETS[asset].rateNGN;
    const tokenPriceNGN = quantity * rate;
    return { tokenPriceNGN, feeNGN: FEE_NGN, totalNGN: tokenPriceNGN + FEE_NGN };
  }
}

export default function GuestBuyWidget() {
  const [asset, setAsset] = useState<AssetKey>("SOL");
  const [network, setNetwork] = useState<EvmNetwork>("SOL");
  const [quantity, setQuantity] = useState<number>(ASSETS.SOL.presets[1]);
  const [customInput, setCustomInput] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const demoIndex = useRef(0);

  const config = ASSETS[asset];

  // Idle demo — cycles example conversions until the visitor interacts.
  useEffect(() => {
    if (hasInteracted) return;
    const interval = setInterval(() => {
      demoIndex.current = (demoIndex.current + 1) % IDLE_DEMO.length;
      const next = IDLE_DEMO[demoIndex.current];
      setAsset(next.asset);
      if (next.network) setNetwork(next.network);
      setQuantity(next.quantity);
    }, 3600);
    return () => clearInterval(interval);
  }, [hasInteracted]);

  // Recompute the quote whenever the inputs change, lightly debounced.
  useEffect(() => {
    if (!quantity || quantity <= 0) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    const handle = setTimeout(() => {
      getQuote(asset, asset === "USDT" ? network : null, quantity)
        .then(setQuote)
        .finally(() => setQuoteLoading(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [asset, network, quantity]);

  const markInteracted = () => setHasInteracted(true);

  const handleAssetChange = (key: AssetKey) => {
    markInteracted();
    setAsset(key);
    setQuantity(ASSETS[key].presets[1]);
    setCustomInput("");
    setConnectError(null);
    if (key === "USDT") setNetwork("TON");
  };

  const handleCustomChange = (value: string) => {
    markInteracted();
    setCustomInput(value);
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed) && parsed > 0) setQuantity(parsed);
  };

  const isEvm = asset === "BNB" || asset === "BASE" || (asset === "USDT" && (network === "BSC" || network === "BASE"));
  const isSolana = asset === "SOL" || (asset === "USDT" && network === "SOL");

  const connectWallet = async () => {
    markInteracted();
    setConnecting(true);
    setConnectError(null);
    try {
      if (isEvm) {
        const eth = (window as any).ethereum;
        if (!eth) throw new Error("No EVM wallet extension found");
        const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
        setWalletAddress(accounts[0]);
      } else if (isSolana) {
        const provider = (window as any).solana;
        if (!provider?.isPhantom) throw new Error("No Solana wallet extension found");
        const resp = await provider.connect();
        setWalletAddress(resp.publicKey.toString());
      } else {
        setConnectError("One-click TON connect needs @tonconnect/ui-react — paste your address below for now.");
      }
    } catch (err: any) {
      setConnectError(err.message || "Couldn't connect automatically — paste your address below.");
    } finally {
      setConnecting(false);
    }
  };

  const canCheckout = quantity > 0 && walletAddress.trim().length > 0 && !!quote;

  const handleCheckout = () => {
    if (!canCheckout || !quote) return;
    const params = new URLSearchParams({
      asset,
      ...(asset === "USDT" ? { network } : {}),
      quantity: String(quantity),
      wallet: walletAddress,
      amount: String(Math.round(quote.totalNGN)),
    });
    window.open(`/checkout?${params.toString()}`, "_blank");
  };

  return (
    <div className="receipt rounded-md p-6 md:p-7 relative overflow-hidden">
      <style jsx>{`
        @keyframes valuePop {
          0% {
            opacity: 0;
            transform: translateY(3px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .value-pop {
          animation: valuePop 0.25s ease-out;
        }
      `}</style>

      {/* Live indicator */}
      <div className="absolute top-5 right-6 flex items-center gap-1.5 text-[#4ADE80]">
        <Radio className="h-3 w-3 animate-pulse" />
        <span className="font-data text-[10px] tracking-wide">LIVE</span>
      </div>

      {/* Asset tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1 pr-16">
        {(Object.keys(ASSETS) as AssetKey[]).map((key) => (
          <button
            key={key}
            onClick={() => handleAssetChange(key)}
            className={`flex items-center gap-1.5 font-data text-xs px-3 py-1.5 rounded-sm whitespace-nowrap transition-colors ${
              asset === key ? "bg-[#FF8A3D] text-[#0B0F14]" : "text-[#8B98A5] hover:text-[#EDEFEA]"
            }`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: asset === key ? "#0B0F14" : ASSETS[key].color }}
            />
            {key}
          </button>
        ))}
      </div>

      {/* USDT network sub-selector */}
      {asset === "USDT" && config.networks && (
        <div className="flex gap-1 mb-5 border border-[#232C36] rounded-sm p-1 w-fit">
          {config.networks.map((n) => (
            <button
              key={n}
              onClick={() => {
                markInteracted();
                setNetwork(n);
              }}
              className={`text-xs px-2.5 py-1 rounded-sm transition-colors ${
                network === n ? "bg-[#232C36] text-white" : "text-[#8B98A5] hover:text-white"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {/* Quantity */}
      <p className="text-xs text-[#8B98A5] mb-2">Amount of {config.label}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {config.presets.map((preset) => (
          <button
            key={preset}
            onClick={() => {
              markInteracted();
              setQuantity(preset);
              setCustomInput("");
            }}
            className={`font-data text-xs px-3 py-1.5 rounded-sm border transition-colors ${
              quantity === preset && !customInput
                ? "border-[#FF8A3D] text-[#FF8A3D]"
                : "border-[#232C36] text-[#8B98A5] hover:text-white hover:border-[#4A5560]"
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
      <input
        type="number"
        min="0"
        step="any"
        placeholder={`Custom amount in ${config.label}`}
        value={customInput}
        onChange={(e) => handleCustomChange(e.target.value)}
        className="w-full bg-[#0B0F14] border border-[#232C36] rounded-sm px-3 py-2 font-data text-sm text-white placeholder:text-[#4A5560] focus:outline-none focus:border-[#FF8A3D] mb-5 transition-colors"
      />

      {/* Destination wallet */}
      <p className="text-xs text-[#8B98A5] mb-2">Destination wallet</p>
      <div className="flex gap-2 mb-1">
        <input
          type="text"
          placeholder="Paste your receiving address"
          value={walletAddress}
          onFocus={markInteracted}
          onChange={(e) => setWalletAddress(e.target.value)}
          className="flex-1 min-w-0 bg-[#0B0F14] border border-[#232C36] rounded-sm px-3 py-2 font-data text-xs text-white placeholder:text-[#4A5560] focus:outline-none focus:border-[#FF8A3D] transition-colors"
        />
        <button
          onClick={connectWallet}
          disabled={connecting}
          className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 border border-[#232C36] rounded-sm text-[#EDEFEA] hover:bg-[#161B22] hover:border-[#4A5560] transition-colors disabled:opacity-60"
        >
          {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
          Connect
        </button>
      </div>
      {connectError && (
        <p className="text-xs text-[#F2B84B] flex items-start gap-1.5 mb-5">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          {connectError}
        </p>
      )}
      {!connectError && <div className="mb-5" />}

      {/* Live summary */}
      <div className="border-t border-dashed border-[#232C36] pt-4 space-y-2 mb-5">
        <div className="flex justify-between text-sm">
          <span className="text-[#8B98A5]">{config.label} price</span>
          <span key={`price-${quote?.tokenPriceNGN}`} className="font-data text-white value-pop">
            {quoteLoading ? "…" : quote ? `₦${quote.tokenPriceNGN.toLocaleString()}` : "—"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#8B98A5]">Fee</span>
          <span className="font-data text-white">
            ${FEE_USD.toFixed(2)} (~₦{FEE_NGN})
          </span>
        </div>
        <div className="flex justify-between text-base pt-2 border-t border-[#232C36]">
          <span className="text-white font-medium">Total</span>
          <span
            key={`total-${quote?.totalNGN}`}
            className="font-data text-white font-semibold value-pop"
          >
            {quoteLoading ? "…" : quote ? `₦${Math.round(quote.totalNGN).toLocaleString()}` : "—"}
          </span>
        </div>
      </div>

      <button
        onClick={handleCheckout}
        disabled={!canCheckout}
        className="w-full bg-[#FF8A3D] hover:bg-[#FF9D5C] disabled:opacity-40 disabled:cursor-not-allowed text-[#0B0F14] font-semibold rounded-sm py-2.5 text-sm transition-colors"
      >
        {quote ? `Pay ₦${Math.round(quote.totalNGN).toLocaleString()} via Paystack / bank transfer` : "Enter an amount to continue"}
      </button>
      <p className="text-xs text-[#4A5560] text-center mt-3">No account or sign-in required</p>
    </div>
  );
}