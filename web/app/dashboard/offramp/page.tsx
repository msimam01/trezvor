"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Info } from "lucide-react";
import { api } from "@/lib/api";

export default function OfframpPage() {
  const [formData, setFormData] = useState({
    token: "",
    amount: "",
    bybitUid: "",
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
  });

  const offrampMutation = useMutation({
    mutationFn: (data: any) => api.submitOfframp(data),
    onSuccess: (data) => {
      alert(`Offramp request submitted! Request ID: ${data.requestId}`);
      setFormData({
        token: "",
        amount: "",
        bybitUid: "",
        bankName: "",
        bankAccountNumber: "",
        bankAccountName: "",
      });
    },
  });

  const handleSubmit = () => {
    if (!formData.token || !formData.amount || !formData.bybitUid || !formData.bankName || !formData.bankAccountNumber || !formData.bankAccountName) {
      alert("Please fill in all fields");
      return;
    }
    offrampMutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount),
    });
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Sell Crypto (Bybit Off-ramp)</h1>
        <p className="text-[#a1a1aa]">Submit your Bybit transfer proof for instant NGN payout</p>
      </div>

      <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6 mb-6">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-[#a1a1aa] mt-0.5" />
          <div className="text-sm text-[#a1a1aa]">
            <p className="font-medium text-white mb-2">How it works:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Transfer your crypto to our Bybit UID</li>
              <li>Submit the transfer details below</li>
              <li>Our team reviews and processes your payout within 24-48 hours</li>
              <li>NGN is sent directly to your bank account</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="bg-[#09090b] border border-[#1f1f1f] rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <DollarSign className="h-5 w-5 text-[#a1a1aa]" />
          <h2 className="text-xl font-bold text-white">Submit Off-ramp Request</h2>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="token" className="text-white">Token</Label>
            <Input
              id="token"
              placeholder="e.g., USDT, USDC"
              value={formData.token}
              onChange={(e) => setFormData({ ...formData, token: e.target.value })}
              className="bg-[#000000] border-[#1f1f1f] text-white"
            />
          </div>
          <div>
            <Label htmlFor="amount" className="text-white">Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="e.g., 100"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="bg-[#000000] border-[#1f1f1f] text-white"
            />
          </div>
          <div>
            <Label htmlFor="bybitUid" className="text-white">Bybit UID</Label>
            <Input
              id="bybitUid"
              placeholder="Your Bybit UID"
              value={formData.bybitUid}
              onChange={(e) => setFormData({ ...formData, bybitUid: e.target.value })}
              className="bg-[#000000] border-[#1f1f1f] text-white"
            />
          </div>
          <div>
            <Label htmlFor="bankName" className="text-white">Bank Name</Label>
            <Input
              id="bankName"
              placeholder="e.g., Access Bank"
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              className="bg-[#000000] border-[#1f1f1f] text-white"
            />
          </div>
          <div>
            <Label htmlFor="accountNumber" className="text-white">Account Number</Label>
            <Input
              id="accountNumber"
              placeholder="Your bank account number"
              value={formData.bankAccountNumber}
              onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
              className="bg-[#000000] border-[#1f1f1f] text-white"
            />
          </div>
          <div>
            <Label htmlFor="accountName" className="text-white">Account Name</Label>
            <Input
              id="accountName"
              placeholder="Account holder name"
              value={formData.bankAccountName}
              onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
              className="bg-[#000000] border-[#1f1f1f] text-white"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={offrampMutation.isPending}
            className="w-full bg-white text-black hover:bg-[#e5e5e5]"
          >
            {offrampMutation.isPending ? "Submitting..." : "Submit Off-ramp Request"}
          </Button>
        </div>
      </div>
    </div>
  );
}
