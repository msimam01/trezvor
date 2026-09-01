"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Check, Wallet, Users } from "lucide-react";
import { api } from "@/lib/api";

export default function AdminAffiliatesPage() {
  const queryClient = useQueryClient();

  const { data: affiliateData, isLoading } = useQuery({
    queryKey: ["admin-affiliates"],
    queryFn: () => api.getAdminAffiliatePayouts(),
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => api.approveAffiliatePayout(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-affiliates"] });
      alert("Affiliate payout approved successfully!");
    },
  });

  const handleApprove = (userId: string, username: string, amount: number) => {
    if (confirm(`Are you sure you want to approve ₦${amount.toLocaleString()} payout for ${username}?`)) {
      approveMutation.mutate(userId);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Affiliate Payout Panel</h1>
        <p className="text-[#a1a1aa]">Manage affiliate earnings and payout requests</p>
      </div>

      {isLoading ? (
        <p className="text-[#a1a1aa]">Loading affiliate data...</p>
      ) : affiliateData?.users.length === 0 ? (
        <p className="text-[#a1a1aa]">No pending affiliate payouts</p>
      ) : (
        <div className="space-y-4">
          {affiliateData?.users.map((user: any) => (
            <div key={user.id} className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-[#a1a1aa]" />
                    <span className="text-sm text-[#52525b]">{user.id.slice(0, 8)}...</span>
                  </div>
                  <p className="text-lg font-bold text-white">{user.username || user.firstName}</p>
                  <p className="text-sm text-[#a1a1aa]">{user.email || 'No email'}</p>
                </div>
                <Button
                  onClick={() => handleApprove(user.id, user.username || user.firstName, user.unpaidAffiliateBalance)}
                  disabled={approveMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve Payout
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-[#a1a1aa]">Unpaid Balance</p>
                  <p className="text-lg font-bold text-white">₦{user.unpaidAffiliateBalance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[#a1a1aa]">Referral Code</p>
                  <p className="text-white font-medium">{user.referralCode}</p>
                </div>
                <div>
                  <p className="text-[#a1a1aa]">Total Referrals</p>
                  <p className="text-white font-medium">{user.referralCount}</p>
                </div>
                <div>
                  <p className="text-[#a1a1aa]">Joined</p>
                  <p className="text-white font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#1f1f1f] flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#a1a1aa]" />
                <p className="text-xs text-[#52525b]">
                  Minimum payout: ₦1,000 • Users with pending balances only
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
