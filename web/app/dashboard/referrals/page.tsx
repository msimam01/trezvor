"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Share2, Wallet } from "lucide-react";
import { api } from "@/lib/api";

export default function ReferralsPage() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: referralInfo, isLoading } = useQuery({
    queryKey: ["referral-info"],
    queryFn: () => api.getReferralInfo(),
  });

  const payoutMutation = useMutation({
    mutationFn: (bankDetails: any) => api.requestPayout(bankDetails),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-info"] });
      alert("Payout request submitted successfully!");
    },
  });

  const [bankDetails, setBankDetails] = useState({
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
  });

  const copyReferralLink = () => {
    if (referralInfo?.referralLink) {
      navigator.clipboard.writeText(referralInfo.referralLink);
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
        <p className="text-[#a1a1aa]">Share your link and earn commissions</p>
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
            <div className="flex gap-2">
              <Input
                value={referralInfo?.referralLink || ""}
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
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <Share2 className="h-5 w-5 text-[#a1a1aa]" />
                <p className="text-[#a1a1aa] text-sm">Total Referrals</p>
              </div>
              <p className="text-2xl font-bold text-white">{referralInfo?.referralCount || 0}</p>
            </div>
            <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-[#a1a1aa]" />
                <p className="text-[#a1a1aa] text-sm">Unpaid Earnings</p>
              </div>
              <p className="text-2xl font-bold text-white">₦{referralInfo?.unpaidEarnings?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-[#a1a1aa]" />
                <p className="text-[#a1a1aa] text-sm">Available for Payout</p>
              </div>
              <p className="text-2xl font-bold text-white">₦{referralInfo?.unpaidEarnings?.toLocaleString() || 0}</p>
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
