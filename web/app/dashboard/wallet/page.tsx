"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { Wallet, Plus, ArrowDownLeft, Bank, CheckCircle, AlertCircle } from "lucide-react";

interface PaystackBank {
  name: string;
  code: string;
  longcode: string;
  gateway: string;
  pay_with_bank: boolean;
  active: boolean;
  country: string;
  currency: string;
  type: string;
  id: number;
  slug: string;
}

const inputClass =
  "bg-[#0B0F14] border-[#232C36] text-white font-data focus-visible:ring-[#FF8A3D] focus-visible:ring-offset-0";

export default function WalletPage() {
  const queryClient = useQueryClient();
  const [isAddBankModalOpen, setIsAddBankModalOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<PaystackBank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedWithdrawBank, setSelectedWithdrawBank] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Fetch wallet data
  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ["wallet-data"],
    queryFn: () => api.getWalletBalance(),
  });

  // Fetch banks
  const { data: banks, isLoading: banksLoading } = useQuery({
    queryKey: ["banks"],
    queryFn: () => api.getBanks(),
  });

  // Resolve bank account mutation
  const resolveBankMutation = useMutation({
    mutationFn: async (data: { accountNumber: string; bankCode: string }) => {
      setIsResolving(true);
      setResolveError("");
      try {
        return await api.resolveBank(data);
      } finally {
        setIsResolving(false);
      }
    },
    onSuccess: (data) => {
      setAccountName(data.accountName);
      setResolveError("");
      queryClient.invalidateQueries({ queryKey: ["wallet-data"] });
      setIsAddBankModalOpen(false);
      // Reset form
      setSelectedBank(null);
      setAccountNumber("");
      setAccountName("");
    },
    onError: (error: any) => {
      setResolveError(error.response?.data?.message || "Failed to resolve account. Please check the details and try again.");
    },
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: async (data: { amount: number; bankAccountId: string }) => {
      setIsWithdrawing(true);
      try {
        return await api.withdraw(data);
      } finally {
        setIsWithdrawing(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-data"] });
      setWithdrawAmount("");
      setSelectedWithdrawBank(null);
      alert("Withdrawal processed successfully!");
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || "Withdrawal failed. Please try again.");
    },
  });

  const handleAccountNumberChange = (value: string) => {
    setAccountNumber(value);
    setResolveError("");
    
    // Auto-resolve when 10 digits are entered
    if (value.length === 10 && selectedBank) {
      resolveBankMutation.mutate({
        accountNumber: value,
        bankCode: selectedBank.code,
      });
    }
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || !selectedWithdrawBank) {
      alert("Please enter amount and select a bank account");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (amount > (walletData?.nairaBalance || 0)) {
      alert("Insufficient balance");
      return;
    }

    withdrawMutation.mutate({
      amount,
      bankAccountId: selectedWithdrawBank,
    });
  };

  const formatNaira = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (walletLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[#8B98A5]">Loading wallet data...</div>
      </div>
    );
  }

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
      `}</style>

      <div className="mb-10">
        <h1 className="font-display text-3xl font-semibold text-white">Wallet</h1>
        <p className="text-[#8B98A5]">Manage your funds and bank accounts</p>
      </div>

      <div className="space-y-6">
        {/* Balance Card */}
        <Card className="bg-[#12181F] border-[#232C36] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-[#FF8A3D]" />
              <h2 className="font-display text-lg font-semibold text-white">Available Balance</h2>
            </div>
          </div>
          <div className="font-data text-4xl font-bold text-white mb-2">
            {formatNaira(walletData?.nairaBalance || 0)}
          </div>
          <p className="text-sm text-[#8B98A5]">NGN Wallet Balance</p>
        </Card>

        {/* Add Bank Card */}
        <Card className="bg-[#12181F] border-[#232C36] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bank className="h-5 w-5 text-[#FF8A3D]" />
              <h2 className="font-display text-lg font-semibold text-white">Bank Accounts</h2>
            </div>
            <Dialog open={isAddBankModalOpen} onOpenChange={setIsAddBankModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#FF8A3D] hover:bg-[#FF9D5C] text-[#0B0F14] font-semibold rounded-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bank
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#12181F] border-[#232C36] text-white max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display text-xl font-semibold">Add Bank Account</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank-select" className="text-[#EDEFEA]">Select Bank</Label>
                    <select
                      id="bank-select"
                      className={inputClass}
                      value={selectedBank?.code || ""}
                      onChange={(e) => {
                        const bank = banks?.find((b) => b.code === e.target.value);
                        setSelectedBank(bank || null);
                        setResolveError("");
                      }}
                      disabled={banksLoading}
                    >
                      <option value="">Select a bank</option>
                      {banks?.map((bank) => (
                        <option key={bank.code} value={bank.code}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-number" className="text-[#EDEFEA]">Account Number</Label>
                    <Input
                      id="account-number"
                      type="text"
                      maxLength={10}
                      placeholder="Enter 10-digit NUBAN"
                      value={accountNumber}
                      onChange={(e) => handleAccountNumberChange(e.target.value)}
                      className={inputClass}
                      disabled={!selectedBank || isResolving}
                    />
                    {isResolving && (
                      <div className="flex items-center gap-2 text-sm text-[#8B98A5]">
                        <div className="animate-spin h-4 w-4 border-2 border-[#FF8A3D] border-t-transparent rounded-full" />
                        Resolving account...
                      </div>
                    )}
                    {resolveError && (
                      <div className="flex items-center gap-2 text-sm text-red-400">
                        <AlertCircle className="h-4 w-4" />
                        {resolveError}
                      </div>
                    )}
                    {accountName && !resolveError && (
                      <div className="flex items-center gap-2 text-sm text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        {accountName}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAddBankModalOpen(false);
                        setSelectedBank(null);
                        setAccountNumber("");
                        setAccountName("");
                        setResolveError("");
                      }}
                      className="border-[#232C36] text-white hover:bg-[#232C36]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (selectedBank && accountNumber.length === 10 && accountName) {
                          resolveBankMutation.mutate({
                            accountNumber,
                            bankCode: selectedBank.code,
                          });
                        } else if (!selectedBank) {
                          setResolveError("Please select a bank");
                        } else if (accountNumber.length !== 10) {
                          setResolveError("Please enter a valid 10-digit account number");
                        }
                      }}
                      disabled={!selectedBank || accountNumber.length !== 10 || !accountName || isResolving}
                      className="bg-[#FF8A3D] hover:bg-[#FF9D5C] text-[#0B0F14] font-semibold rounded-sm"
                    >
                      Save Bank Account
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Saved Banks List */}
          <div className="space-y-3">
            {walletData?.savedBanks && walletData.savedBanks.length > 0 ? (
              walletData.savedBanks.map((bank) => (
                <div
                  key={bank.id}
                  className="flex items-center justify-between p-4 bg-[#0B0F14] border border-[#232C36] rounded-sm"
                >
                  <div className="flex items-center gap-3">
                    <Bank className="h-4 w-4 text-[#8B98A5]" />
                    <div>
                      <div className="font-medium text-white">{bank.bankName}</div>
                      <div className="text-sm text-[#8B98A5] font-data">
                        {bank.accountNumber} • {bank.accountName}
                      </div>
                    </div>
                  </div>
                  {bank.isVerified && (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-[#8B98A5]">
                No bank accounts added yet. Click "Add Bank" to get started.
              </div>
            )}
          </div>
        </Card>

        {/* Withdrawal Card */}
        {walletData?.savedBanks && walletData.savedBanks.length > 0 && (
          <Card className="bg-[#12181F] border-[#232C36] p-6">
            <div className="flex items-center gap-3 mb-4">
              <ArrowDownLeft className="h-5 w-5 text-[#FF8A3D]" />
              <h2 className="font-display text-lg font-semibold text-white">Withdraw Funds</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="withdraw-amount" className="text-[#EDEFEA]">Amount (NGN)</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder="Enter amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className={inputClass}
                />
                <p className="text-xs text-[#4A5560]">Available: {formatNaira(walletData?.nairaBalance || 0)}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdraw-bank" className="text-[#EDEFEA]">Select Bank Account</Label>
                <select
                  id="withdraw-bank"
                  className={inputClass}
                  value={selectedWithdrawBank || ""}
                  onChange={(e) => setSelectedWithdrawBank(e.target.value)}
                >
                  <option value="">Select a bank account</option>
                  {walletData?.savedBanks?.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.bankName} - {bank.accountNumber}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={handleWithdraw}
                disabled={isWithdrawing || !withdrawAmount || !selectedWithdrawBank}
                className="w-full bg-[#FF8A3D] hover:bg-[#FF9D5C] text-[#0B0F14] font-semibold rounded-sm"
              >
                {isWithdrawing ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-[#0B0F14] border-t-transparent rounded-full mr-2" />
                    Processing...
                  </>
                ) : (
                  "Withdraw"
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}