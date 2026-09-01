"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AlertCircle, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";

export default function DisputesPage() {
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [reason, setReason] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => api.getMyOrders(),
  });

  const refundMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      api.submitRefundRequest(orderId, reason),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      alert(`Refund request submitted! Request ID: ${data.requestId}`);
      setSelectedOrderId("");
      setReason("");
    },
  });

  const handleSubmitRefund = () => {
    if (!selectedOrderId || !reason) {
      alert("Please select an order and provide a reason");
      return;
    }
    refundMutation.mutate({ orderId: selectedOrderId, reason });
  };

  const eligibleOrders = orders.filter((order) =>
    ["PENDING_LIQUIDITY", "FAILED_REFUND_NEEDED", "DISPENSING_QUEUED"].includes(order.status)
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Refunds & Disputes</h1>
        <p className="text-[#a1a1aa]">Submit refund requests for pending or failed orders</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders List */}
        <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-[#a1a1aa]" />
            <h2 className="text-xl font-bold text-white">Your Orders</h2>
          </div>

          {isLoading ? (
            <p className="text-[#a1a1aa]">Loading orders...</p>
          ) : eligibleOrders.length === 0 ? (
            <p className="text-[#a1a1aa]">No eligible orders for refund</p>
          ) : (
            <div className="space-y-2">
              {eligibleOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedOrderId === order.id
                      ? "border-white bg-[#1f1f1f]"
                      : "border-[#1f1f1f] hover:border-[#3f3f46]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{order.chain}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-[#1f1f1f] text-[#a1a1aa]">
                      {order.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#a1a1aa]">₦{order.fiatAmountNaira.toLocaleString()}</p>
                  <p className="text-xs text-[#52525b] mt-1">{order.id.slice(0, 8)}...</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Refund Form */}
        <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-[#a1a1aa]" />
            <h2 className="text-xl font-bold text-white">Submit Refund Request</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-[#a1a1aa] mb-2 block">Selected Order</label>
              <div className="bg-[#000000] border border-[#1f1f1f] rounded-lg p-3 text-white">
                {selectedOrderId ? (
                  <div>
                    <p className="text-sm">{eligibleOrders.find((o) => o.id === selectedOrderId)?.chain}</p>
                    <p className="text-xs text-[#52525b]">{selectedOrderId.slice(0, 8)}...</p>
                  </div>
                ) : (
                  <p className="text-[#52525b]">Select an order from the list</p>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm text-[#a1a1aa] mb-2 block">Reason for Refund</label>
              <textarea
                placeholder="Describe why you're requesting a refund..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-[#000000] border border-[#1f1f1f] text-white rounded-lg p-3 min-h-[120px] focus:outline-none focus:border-white"
              />
            </div>
            <Button
              onClick={handleSubmitRefund}
              disabled={!selectedOrderId || !reason || refundMutation.isPending}
              className="w-full bg-white text-black hover:bg-[#e5e5e5]"
            >
              {refundMutation.isPending ? "Submitting..." : "Submit Refund Request"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
