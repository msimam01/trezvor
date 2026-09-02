"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Share2, Wallet, Users, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";

export default function ReferralsPage() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: referralStats, isLoading } = useQuery({
    queryKey: ["referral-stats"],
    queryFn: () => api.getReferralStats(),
  });

  const payoutMutation = useMutation({
    mutationFn: (bankDetails: any) => api.requestPayout(bankDetails),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-stats"] });
      alert("Payout request submitted successfully!");
    },
  });

  const [bankDetails, setBankDetails] = useState({
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
  });

  const copyReferralLink = () => {
    if (referralStats?.referralLink) {
      navigator.clipboard.writeText(referralStats.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyReferralCode = () => {
    if (referralStats?.referralCode) {
      navigator.clipboard.writeText(referralStats.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePayout = () => {
    if (!bankDetails.bankName || !bankDetails.bankAccountNumber || !bankDetails.bankAccountName) {
      alert("Please fill in all bank details");
      return;
    }
    payoutMutation.mutate(bankDetails);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Referral & Earnings</h1>
        <p className="text-[#a1a1aa]">Share your link and earn ₦200 for each first deposit</p>
      </div>

      {isLoading ? (
        <p className="text-[#a1a1aa]">Loading...</p>
      ) : (
        <div className="space-y-6">
          {/* Referral Link Card */}
          <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Share2 className="h-5 w-5 text-[#a1a1aa]" />
              <h2 className="text-xl font-bold text-white">Your Referral Link</h2>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={referralStats?.referralLink || ""}
                  readOnly
                  className="bg-[#000000] border-[#1f1f1f] text-white"
                />
                <Button
                  onClick={copyReferralLink}
                  className="bg-white text-black hover:bg-[#e5e5e5]"
                >
                  {copied ? <Copy className="h-4 w-4" /> : "Copy"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  value={referralStats?.referralCode || ""}
                  readOnly
                  placeholder="Referral Code"
                  className="bg-[#000000] border-[#1f1f1f] text-white"
                />
                <Button
                  onClick={copyReferralCode}
                  variant="outline"
                  className="border-[#1f1f1f] text-white hover:bg-[#1f1f1f]"
                >
                  {copied ? <Copy className="h-4 w-4" /> : "Copy Code"}
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-[#a1a1aa]" />
                <p className="text-[#a1a1aa] text-sm">Total Referred</p>
              </div>
              <p className="text-2xl font-bold text-white">{referralStats?.totalReferred || 0}</p>
            </div>
            <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-[#a1a1aa]" />
                <p className="text-[#a1a1aa] text-sm">Total Earned</p>
              </div>
              <p className="text-2xl font-bold text-white">₦{Number(referralStats?.totalPaidBonuses || 0).toLocaleString()}</p>
            </div>
            <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-[#a1a1aa]" />
                <p className="text-[#a1a1aa] text-sm">Pending Bonuses</p>
              </div>
              <p className="text-2xl font-bold text-white">₦{Number(referralStats?.pendingBonuses || 0).toLocaleString()}</p>
            </div>
            <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-[#a1a1aa]" />
                <p className="text-[#a1a1aa] text-sm">Unpaid Balance</p>
              </div>
              <p className="text-2xl font-bold text-white">₦{Number(referralStats?.unpaidBalance || 0).toLocaleString()}</p>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">How it works</h2>
            <div className="space-y-3 text-[#a1a1aa]">
              <div className="flex items-start gap-3">
                <span className="text-white font-bold">1.</span>
                <p>Share your referral link with friends and family</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-white font-bold">2.</span>
                <p>When they sign up and make their first deposit, you earn ₦200</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-white font-bold">3.</span>
                <p>Withdraw your earnings to your bank account anytime</p>
              </div>
            </div>
          </div>

          {/* Payout Form */}
          <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Request Payout</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="bankName" className="text-white">Bank Name</Label>
                <Input
                  id="bankName"
                  value={bankDetails.bankName}
                  onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                  className="bg-[#000000] border-[#1f1f1f] text-white"
                />
              </div>
              <div>
                <Label htmlFor="accountNumber" className="text-white">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={bankDetails.bankAccountNumber}
                  onChange={(e) => setBankDetails({ ...bankDetails, bankAccountNumber: e.target.value })}
                  className="bg-[#000000] border-[#1f1f1f] text-white"
                />
              </div>
              <div>
                <Label htmlFor="accountName" className="text-white">Account Name</Label>
                <Input
                  id="accountName"
                  value={bankDetails.bankAccountName}
                  onChange={(e) => setBankDetails({ ...bankDetails, bankAccountName: e.target.value })}
                  className="bg-[#000000] border-[#1f1f1f] text-white"
                />
              </div>
              <Button
                onClick={handlePayout}
                disabled={payoutMutation.isPending}
                className="w-full bg-white text-black hover:bg-[#e5e5e5]"
              >
                {payoutMutation.isPending ? "Processing..." : "Request Payout"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
