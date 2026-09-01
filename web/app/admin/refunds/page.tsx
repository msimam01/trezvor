"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Check, X, AlertCircle, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";

export default function AdminRefundsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");

  const { data: refundData, isLoading } = useQuery({
    queryKey: ["admin-refunds", statusFilter],
    queryFn: () => api.getAdminRefundRequests({ status: statusFilter }),
  });

  const approveMutation = useMutation({
    mutationFn: ({ requestId, adminNotes }: { requestId: string; adminNotes?: string }) =>
      api.approveRefundRequest(requestId, adminNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
      alert("Refund request approved and processed!");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, adminNotes }: { requestId: string; adminNotes?: string }) =>
      api.rejectRefundRequest(requestId, adminNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
      alert("Refund request rejected!");
    },
  });

  const handleApprove = (requestId: string) => {
    const adminNotes = prompt("Enter admin notes (optional):");
    approveMutation.mutate({ requestId, adminNotes: adminNotes || undefined });
  };

  const handleReject = (requestId: string) => {
    const adminNotes = prompt("Enter rejection reason (optional):");
    rejectMutation.mutate({ requestId, adminNotes: adminNotes || undefined });
  };

  const statusColors = {
    PENDING: "bg-yellow-900/20 text-yellow-400 border-yellow-800",
    APPROVED: "bg-green-900/20 text-green-400 border-green-800",
    REJECTED: "bg-red-900/20 text-red-400 border-red-800",
    PROCESSED: "bg-blue-900/20 text-blue-400 border-blue-800",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Refund Request Queue</h1>
        <p className="text-[#a1a1aa]">Review and process user refund requests</p>
      </div>

      <div className="flex gap-2 mb-6">
        {["PENDING", "APPROVED", "REJECTED", "PROCESSED"].map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? "default" : "outline"}
            onClick={() => setStatusFilter(status)}
            className={
              statusFilter === status
                ? "bg-white text-black hover:bg-[#e5e5e5]"
                : "bg-[#09090b] border-[#1f1f1f] text-[#a1a1aa] hover:text-white"
            }
          >
            {status}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-[#a1a1aa]">Loading refund requests...</p>
      ) : refundData?.requests.length === 0 ? (
        <p className="text-[#a1a1aa]">No refund requests found</p>
      ) : (
        <div className="space-y-4">
          {refundData?.requests.map((request: any) => (
            <div key={request.id} className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColors[request.status as keyof typeof statusColors]}`}>
                      {request.status}
                    </span>
                    <span className="text-sm text-[#52525b]">{request.id.slice(0, 8)}...</span>
                  </div>
                  <p className="text-lg font-bold text-white">{request.order.chain} Order</p>
                  <p className="text-sm text-[#a1a1aa]">{request.user.username || request.user.firstName}</p>
                </div>
                {request.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(request.id)}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleReject(request.id)}
                      disabled={rejectMutation.isPending}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-[#a1a1aa] mt-1" />
                  <div>
                    <p className="text-sm text-[#a1a1aa] mb-1">User Reason:</p>
                    <p className="text-white">{request.reason}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[#a1a1aa]">Order Amount</p>
                  <p className="text-white font-medium">₦{request.order.fiatAmountNaira?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-[#a1a1aa]">Order Status</p>
                  <p className="text-white font-medium">{request.order.status}</p>
                </div>
                <div>
                  <p className="text-[#a1a1aa]">Submitted</p>
                  <p className="text-white font-medium">{new Date(request.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[#a1a1aa]">Order ID</p>
                  <p className="text-white font-medium">{request.orderId.slice(0, 8)}...</p>
                </div>
              </div>

              {request.adminNotes && (
                <div className="mt-4 pt-4 border-t border-[#1f1f1f]">
                  <p className="text-sm text-[#a1a1aa] mb-1">Admin Notes:</p>
                  <p className="text-white">{request.adminNotes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
