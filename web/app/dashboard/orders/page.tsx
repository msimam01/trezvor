"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function OrdersPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => api.getMyOrders(),
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">My Gas Orders</h1>
        <p className="text-[#a1a1aa]">View and track all your gas purchases</p>
      </div>

      <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg">
        {isLoading ? (
          <div className="p-8 text-center text-[#a1a1aa]">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-[#a1a1aa]">No orders yet</div>
        ) : (
          <div className="divide-y divide-[#1f1f1f]">
            {orders.map((order) => (
              <div key={order.id} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white font-medium">{order.chain}</p>
                    <p className="text-sm text-[#a1a1aa]">{order.id.slice(0, 8)}...</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#1f1f1f] text-[#a1a1aa]">
                    {order.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-[#a1a1aa]">Amount Paid</p>
                    <p className="text-white font-medium">₦{Number(order.fiatAmountNaira).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[#a1a1aa]">Crypto Received</p>
                    <p className="text-white font-medium">{Number(order.cryptoAmount).toFixed(6)}</p>
                  </div>
                  <div>
                    <p className="text-[#a1a1aa]">Target Wallet</p>
                    <p className="text-white font-medium text-xs">{order.targetWallet.slice(0, 10)}...{order.targetWallet.slice(-4)}</p>
                  </div>
                  <div>
                    <p className="text-[#a1a1aa]">Date</p>
                    <p className="text-white font-medium">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
