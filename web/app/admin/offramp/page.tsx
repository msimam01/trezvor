"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Check, X, DollarSign, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

export default function AdminOfframpPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("PENDING_VERIFICATION");

  const { data: offrampData, isLoading } = useQuery({
    queryKey: ["admin-offramp", statusFilter],
    queryFn: () => api.getAdminOfframpRequests({ status: statusFilter }),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => api.approveOfframp(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-offramp"] });
      alert("Offramp request approved successfully!");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) =>
      api.rejectOfframp(requestId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-offramp"] });
      alert("Offramp request rejected!");
    },
  });

  const handleApprove = (requestId: string) => {
    if (confirm("Are you sure you want to approve this offramp request?")) {
      approveMutation.mutate(requestId);
    }
  };

  const handleReject = (requestId: string) => {
    const reason = prompt("Enter rejection reason (optional):");
    rejectMutation.mutate({ requestId, reason: reason || undefined });
  };

  const statusColors = {
    PENDING_VERIFICATION: "bg-yellow-900/20 text-yellow-400 border-yellow-800",
    APPROVED: "bg-green-900/20 text-green-400 border-green-800",
    REJECTED: "bg-red-900/20 text-red-400 border-red-800",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Off-ramp Review Panel</h1>
        <p className="text-[#a1a1aa]">Review and process Bybit off-ramp requests</p>
      </div>

      <div className="flex gap-2 mb-6">
        {["PENDING_VERIFICATION", "APPROVED", "REJECTED"].map((status) => (
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
        <p className="text-[#a1a1aa]">Loading offramp requests...</p>
      ) : !offrampData?.requests || offrampData.requests.length === 0 ? (
        <p className="text-[#a1a1aa]">No offramp requests found</p>
      ) : (
        <div className="space-y-4">
          {offrampData.requests.map((request: any) => (
            <div key={request.id} className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColors[request.status as keyof typeof statusColors]}`}>
                      {request.status}
                    </span>
                    <span className="text-sm text-[#52525b]">{request.id.slice(0, 8)}...</span>
                  </div>
                  <p className="text-lg font-bold text-white">{request.cryptoAmount} {request.cryptoAsset}</p>
                  <p className="text-sm text-[#a1a1aa]">{request.user?.username || request.user?.firstName || 'Unknown User'}</p>
                </div>
                {request.status === "PENDING_VERIFICATION" && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(request.id)}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve & Pay NGN
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[#a1a1aa]">Crypto Asset</p>
                  <p className="text-white font-medium">{request.cryptoAsset}</p>
                </div>
                <div>
                  <p className="text-[#a1a1aa]">Crypto Amount</p>
                  <p className="text-white font-medium">{request.cryptoAmount}</p>
                </div>
                <div>
                  <p className="text-[#a1a1aa]">NGN Value</p>
                  <p className="text-white font-medium">₦{request.ngnValue?.toLocaleString() || '0'}</p>
                </div>
                <div>
                  <p className="text-[#a1a1aa]">Exchange Rate</p>
                  <p className="text-white font-medium">₦{request.exchangeRate?.toLocaleString() || '0'}</p>
                </div>
                <div>
                  <p className="text-[#a1a1aa]">Bybit UID Used</p>
                  <p className="text-white font-medium">{request.bybitUidUsed}</p>
                </div>
                <div>
                  <p className="text-[#a1a1aa]">User Bybit Tx ID</p>
                  <p className="text-white font-medium">{request.userBybitTxId}</p>
                </div>
                <div>
                  <p className="text-[#a1a1aa]">Payout Destination</p>
                  <p className="text-white font-medium">{request.payoutDestination}</p>
                </div>
                {request.savedBank && (
                  <div>
                    <p className="text-[#a1a1aa]">Bank Details</p>
                    <p className="text-white font-medium">{request.savedBank.bankName} - {request.savedBank.accountNumber}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-[#1f1f1f] text-xs text-[#52525b]">
                <p>Submitted: {new Date(request.createdAt).toLocaleString()}</p>
                {request.rejectionReason && (
                  <p className="mt-1 text-red-400">Rejection Reason: {request.rejectionReason}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
