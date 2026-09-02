"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, RefreshCw, Copy, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { api, type VaultBalance, type Order } from "@/lib/api";

const orderStatusMeta: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: "Pending payment", color: "#8B98A5" },
  PAYMENT_VERIFIED: { label: "Payment verified", color: "#8B98A5" },
  DISPENSING_QUEUED: { label: "Dispensing", color: "#8B98A5" },
  PENDING_LIQUIDITY: { label: "Pending liquidity", color: "#F2B84B" },
  DISPENSED_SUCCESS: { label: "Success", color: "#4ADE80" },
  FAILED_REFUND_NEEDED: { label: "Failed", color: "#F2735C" },
};

const vaultStatusMeta: Record<string, { color: string; note?: string }> = {
  healthy: { color: "#4ADE80" },
  warning: { color: "#F2B84B", note: "Running low — consider a refill" },
  critical: { color: "#F2735C", note: "Critically low — refill now" },
};

export default function AdminPage() {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  // Fetch vault balances
  const { data: vaultBalances = [], isLoading: vaultsLoading, refetch: refetchVaults } = useQuery({
    queryKey: ["vault-balances"],
    queryFn: () => api.getVaultBalances(),
  });

  // Fetch recent orders (limit 5)
  const { data: ordersResponse, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ["admin-orders", "recent"],
    queryFn: () => api.getOrders({ pageSize: 5 }),
  });

  const recentOrders = ordersResponse?.orders || [];

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(type);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const handleRefreshVaults = () => {
    refetchVaults();
  };

  return (
    <>
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

      <div className="mb-10">
        <h1 className="font-display text-3xl font-semibold text-white mb-2">Admin</h1>
        <p className="text-[#8B98A5]">Vault health and order activity across every chain.</p>
      </div>

      {/* Vault Balances */}
      <div className="mb-12">
        <h2 className="font-display text-lg font-semibold text-white mb-5 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#8B98A5]" />
          Vault balances
        </h2>
        {vaultsLoading ? (
          <div className="text-[#8B98A5]">Loading vault balances...</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {vaultBalances.map((vault) => {
              const meta = vaultStatusMeta[vault.status] ?? vaultStatusMeta.healthy;
              const isLive = vault.status === "healthy";
              return (
                <div key={vault.chain} className="ticket rounded-md p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-display font-medium text-white">{vault.chain}</p>
                    <span className="relative flex h-2 w-2">
                      <span
                        className={`absolute inline-flex h-full w-full rounded-full ${isLive ? "live-dot" : ""}`}
                        style={{ backgroundColor: meta.color }}
                      />
                    </span>
                  </div>
                  <p className="text-sm text-[#8B98A5] mb-1">{vault.symbol} balance</p>
                  <p className="font-data text-2xl font-semibold text-white mb-4">
                    {Number(vault.balance).toFixed(6)} {vault.symbol}
                  </p>
                  <div className="flex items-center justify-between border-t border-dashed border-[#232C36] pt-4 mb-4">
                    <p className="font-data text-xs text-[#8B98A5]">
                      {vault.address.slice(0, 10)}...{vault.address.slice(-8)}
                    </p>
                    <button
                      className="text-[#8B98A5] hover:text-white transition-colors"
                      onClick={() => copyToClipboard(vault.address, `vault-${vault.chain}`)}
                    >
                      {copiedItem === `vault-${vault.chain}` ? (
                        <ClipboardCheck className="h-3.5 w-3.5 text-[#4ADE80]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {meta.note && (
                    <p className="text-sm mb-4" style={{ color: meta.color }}>
                      {meta.note}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshVaults}
                    className="w-full border-[#232C36] bg-transparent text-[#EDEFEA] hover:bg-[#161B22] rounded-sm"
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Refresh
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-5 mb-12">
        {[
          { href: "/admin/orders", title: "Order management", desc: "View and manage every gas order" },
          { href: "/admin/users", title: "User management", desc: "Manage registered users" },
          { href: "/admin/settings", title: "Platform settings", desc: "Configure fees and thresholds" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="ticket rounded-md p-5 h-full hover:border-[#FF8A3D] transition-colors cursor-pointer">
              <p className="font-display font-medium text-white mb-1.5">{item.title}</p>
              <p className="text-sm text-[#8B98A5]">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold text-white">Recent orders</h2>
          <Link href="/admin/orders">
            <button className="text-sm text-[#8B98A5] hover:text-white transition-colors">View all</button>
          </Link>
        </div>

        <div className="ticket rounded-md">
          {ordersLoading ? (
            <div className="p-8 text-center text-[#8B98A5]">Loading orders...</div>
          ) : recentOrders.length === 0 ? (
            <div className="p-8 text-center text-[#8B98A5]">No recent orders</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#232C36] hover:bg-transparent">
                    <TableHead className="text-[#8B98A5]">Order</TableHead>
                    <TableHead className="text-[#8B98A5]">Telegram ID</TableHead>
                    <TableHead className="text-[#8B98A5]">Chain</TableHead>
                    <TableHead className="text-[#8B98A5]">NGN amount</TableHead>
                    <TableHead className="text-[#8B98A5]">Crypto out</TableHead>
                    <TableHead className="text-[#8B98A5]">Status</TableHead>
                    <TableHead className="text-[#8B98A5]">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((order: Order) => {
                    const status = orderStatusMeta[order.status] ?? { label: order.status, color: "#8B98A5" };
                    return (
                      <TableRow key={order.id} className="border-b border-[#232C36] hover:bg-[#161B22] transition-colors">
                        <TableCell className="font-data text-xs text-[#8B98A5]">{order.id.slice(0, 8)}...</TableCell>
                        <TableCell className="font-data text-xs text-[#8B98A5]">{order.user.telegramId.toString()}</TableCell>
                        <TableCell>
                          <span className="text-xs text-[#8B98A5] border border-[#232C36] rounded-sm px-2 py-1">
                            {order.chain}
                          </span>
                        </TableCell>
                        <TableCell className="font-data font-semibold text-white">
                          ₦{order.fiatAmountNaira.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-data font-semibold text-white">
                          {Number(order.cryptoAmount).toFixed(6)}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 text-sm text-[#EDEFEA]">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-[#8B98A5]">
                          {new Date(order.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}