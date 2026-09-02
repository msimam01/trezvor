"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TelegramLinkModal } from "@/components/telegram-link-modal";
import { BarChart3, Package, Handshake, DollarSign, RotateCcw, CreditCard, Shuffle, Star, Settings, LogOut, Wallet } from "lucide-react";

interface UserSidebarProps {
  isAdmin?: boolean;
  userEmail?: string;
  onLogout?: () => void;
}

const navItems = [
  {
    label: "Dashboard & Metrics",
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    label: "My Gas Orders",
    href: "/dashboard/orders",
    icon: Package,
  },
  {
    label: "Wallet & Banking",
    href: "/dashboard/wallet",
    icon: Wallet,
  },
  {
    label: "Referral & Earnings",
    href: "/dashboard/referrals",
    icon: Handshake,
  },
  {
    label: "Sell Crypto (Bybit Off-ramp)",
    href: "/dashboard/offramp",
    icon: DollarSign,
  },
  {
    label: "Refunds & Disputes",
    href: "/dashboard/disputes",
    icon: RotateCcw,
  },
  {
    label: "Account Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
  {
    label: "Virtual NGN Accounts",
    href: "#",
    icon: CreditCard,
    upcoming: true,
  },
  {
    label: "Cross-Chain Swaps",
    href: "#",
    icon: Shuffle,
    upcoming: true,
  },
  {
    label: "Telegram Stars & OTC",
    href: "#",
    icon: Star,
    upcoming: true,
  },
];

export function UserSidebar({ isAdmin = false, userEmail, onLogout }: UserSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#09090b] border-r border-[#1f1f1f] flex flex-col overflow-y-auto">
      <div className="p-6 border-b border-[#1f1f1f] flex-shrink-0">
        <h1 className="text-xl font-bold text-white">GasBot</h1>
        <p className="text-sm text-[#a1a1aa] mt-1">Micro-Gas Platform</p>
      </div>

      <nav className="p-4 space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.upcoming) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 px-4 py-3 rounded-md text-[#52525b] cursor-not-allowed"
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm">{item.label}</span>
                <span className="ml-auto text-xs bg-[#1f1f1f] text-[#52525b] px-2 py-0.5 rounded-full">
                  Coming Soon
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-white text-black font-medium"
                  : "text-[#a1a1aa] hover:text-white hover:bg-[#1f1f1f]"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#1f1f1f]">
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-4 py-3 rounded-md text-sm text-[#a1a1aa] hover:text-white hover:bg-[#1f1f1f] transition-colors mb-2"
          >
            Admin Panel
          </Link>
        )}
        <div className="px-4 mb-2">
          <TelegramLinkModal />
        </div>
        <div className="px-4 mb-2">
          <p className="text-xs text-[#52525b] mb-1">Logged in as</p>
          <p className="text-sm text-[#a1a1aa] truncate">{userEmail || "User"}</p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-md text-sm text-[#ef4444] hover:bg-[#1f1f1f] transition-colors w-full text-left"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
