"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BarChart3, Wallet, TrendingUp, Zap } from "lucide-react";

export default function DashboardPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => api.getMyOrders(),
  });

  const totalVolume = orders.reduce((sum, order) => sum + order.fiatAmountNaira, 0);
  const completedOrders = orders.filter((o) => o.status === "DISPENSED_SUCCESS").length;
  const pendingOrders = orders.filter((o) => 
    ["PENDING_PAYMENT", "PAYMENT_VERIFIED", "DISPENSING_QUEUED", "PENDING_LIQUIDITY"].includes(o.status)
  ).length;

  const metrics = [
    { label: "Total Volume", value: `₦${totalVolume.toLocaleString()}`, icon: Wallet },
    { label: "Completed Orders", value: completedOrders, icon: TrendingUp },
    { label: "Pending Orders", value: pendingOrders, icon: Zap },
    { label: "Total Orders", value: orders.length, icon: BarChart3 },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-[#a1a1aa]">Your gas trading activity at a glance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <Icon className="h-5 w-5 text-[#a1a1aa]" />
                <span className="text-xs text-[#52525b] uppercase tracking-wider">Total</span>
              </div>
              <p className="text-2xl font-bold text-white">{metric.value}</p>
              <p className="text-sm text-[#a1a1aa] mt-1">{metric.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
        {isLoading ? (
          <p className="text-[#a1a1aa]">Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-[#a1a1aa]">No orders yet. Start by buying gas!</p>
        ) : (
          <div className="space-y-4">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between py-3 border-b border-[#1f1f1f] last:border-0">
                <div>
                  <p className="text-white font-medium">{order.chain}</p>
                  <p className="text-sm text-[#a1a1aa]">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">₦{order.fiatAmountNaira.toLocaleString()}</p>
                  <p className="text-sm text-[#a1a1aa]">{order.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
