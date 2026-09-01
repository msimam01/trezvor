"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Package,
  Users,
  Settings,
  Bell,
  LogOut,
  Zap,
  ArrowLeft,
  DollarSign,
  Handshake,
  AlertCircle,
} from "lucide-react";

interface AdminSidebarProps {
  adminEmail?: string;
  notificationCount?: number;
  onLogout?: () => void;
  onNotificationClick?: () => void;
}

export function AdminSidebar({
  adminEmail = "admin@trezvor.com",
  notificationCount = 0,
  onLogout,
  onNotificationClick,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/orders", label: "Orders & disputes", icon: Package },
    { href: "/admin/users", label: "User management", icon: Users },
    { href: "/admin/offramp", label: "Off-ramp review", icon: DollarSign },
    { href: "/admin/affiliates", label: "Affiliate payouts", icon: Handshake },
    { href: "/admin/refunds", label: "Refund queue", icon: AlertCircle },
    { href: "/admin/settings", label: "Platform settings", icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 h-screen border-r border-[#232C36] bg-[#0B0F14] flex flex-col justify-between p-4 sticky top-0">
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap");
        .font-display {
          font-family: "Space Grotesk", sans-serif;
        }
        .font-data {
          font-family: "IBM Plex Mono", monospace;
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

      <div>
        <div className="flex items-center gap-2 mb-1 px-2">
          <Zap className="h-5 w-5 text-[#FF8A3D]" />
          <span className="font-display text-base font-semibold text-white">Trezvor</span>
          <span className="text-xs text-[#4A5560] font-data ml-auto">admin</span>
        </div>

        {/* System Status */}
        <div className="flex items-center gap-2 mb-6 px-2 mt-4">
          <span className="relative flex h-2 w-2">
            <span className="live-dot absolute inline-flex h-full w-full rounded-full bg-[#4ADE80]" />
          </span>
          <span className="text-xs text-[#8B98A5]">System online</span>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={`w-full justify-start gap-3 rounded-sm ${
                    active
                      ? "bg-[#FF8A3D] text-[#0B0F14] font-semibold hover:bg-[#FF9D5C] hover:text-[#0B0F14]"
                      : "text-[#8B98A5] hover:text-white hover:bg-[#161B22]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Section */}
      <div className="border-t border-[#232C36] pt-4 space-y-3">
        <div className="px-2">
          <p className="text-xs text-[#4A5560] mb-1">Logged in as</p>
          <p className="text-sm text-[#EDEFEA] font-medium truncate">{adminEmail}</p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNotificationClick}
          className="w-full justify-start text-[#8B98A5] hover:text-white hover:bg-[#161B22]"
        >
          <Bell className="h-4 w-4 mr-2" />
          Notifications
          {notificationCount > 0 && (
            <span className="ml-auto font-data text-xs bg-[#FF8A3D] text-[#0B0F14] rounded-full h-5 w-5 flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </Button>

        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-[#8B98A5] hover:text-white hover:bg-[#161B22]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to home
          </Button>
        </Link>

        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="w-full justify-start text-[#8B98A5] hover:text-white hover:bg-[#161B22]"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Log out
        </Button>
      </div>
    </aside>
  );
}