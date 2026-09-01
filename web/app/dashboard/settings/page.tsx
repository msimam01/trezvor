"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link2, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";

export default function SettingsPage() {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => api.getUserProfile(),
  });

  const linkMutation = useMutation({
    mutationFn: (code: string) => api.linkTelegramAccount(code),
    onSuccess: (data) => {
      setMessage({ type: "success", text: "Account successfully linked!" });
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
    onError: (error: any) => {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to link account. Please try again.",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsSubmitting(true);
    setMessage(null);

    // Format code to match expected format (G-XXXXXX)
    const formattedCode = code.startsWith("G-") ? code : `G-${code}`;
    linkMutation.mutate(formattedCode);
  };

  const isLinked = !!user?.telegramId;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Account Settings</h1>
        <p className="text-[#a1a1aa]">Manage your account preferences and connections</p>
      </div>

      <div className="space-y-6">
        {/* Telegram Account Linking */}
        <Card className="bg-[#09090b] border-[#1f1f1f] p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-[#1f1f1f] rounded-lg">
              <Link2 className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-1">Telegram Account Linking</h2>
              <p className="text-sm text-[#a1a1aa]">
                Link your Telegram account to access your bot orders and wallet in the web dashboard.
              </p>
            </div>
          </div>

          {isLoadingUser ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 text-[#a1a1aa] animate-spin" />
            </div>
          ) : isLinked ? (
            <div className="bg-[#1f1f1f] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-white font-medium">Account Linked</p>
                  <p className="text-sm text-[#a1a1aa]">
                    Your Telegram account (ID: {user.telegramId}) is connected to this web account.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-[#1f1f1f] rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="text-white font-medium mb-1">How to link your account:</p>
                    <ol className="text-sm text-[#a1a1aa] space-y-1 list-decimal list-inside">
                      <li>Open the GasBot Telegram bot</li>
                      <li>Send the <code className="bg-[#09090b] px-1.5 py-0.5 rounded">/link</code> command</li>
                      <li>Copy the 6-digit code from the bot response</li>
                      <li>Enter the code below and click "Link Account"</li>
                    </ol>
                  </div>
                </div>
              </div>

              <form onSubmit={handleLinkAccount} className="space-y-4">
                <div>
                  <Label htmlFor="link-code" className="text-white">
                    Link Code
                  </Label>
                  <Input
                    id="link-code"
                    type="text"
                    placeholder="Enter 6-digit code (e.g., 849201)"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="bg-[#1f1f1f] border-[#2a2a2a] text-white placeholder:text-[#52525b] mt-2"
                    disabled={isSubmitting}
                  />
                </div>

                {message && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-lg ${
                      message.type === "success"
                        ? "bg-green-500/10 text-green-500"
                        : "bg-red-500/10 text-red-500"
                    }`}
                  >
                    {message.type === "success" ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <span className="text-sm">{message.text}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || code.length !== 6}
                  className="w-full bg-white text-black hover:bg-gray-200"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    "Link Account"
                  )}
                </Button>
              </form>
            </div>
          )}
        </Card>

        {/* Account Information */}
        <Card className="bg-[#09090b] border-[#1f1f1f] p-6">
          <h2 className="text-xl font-bold text-white mb-4">Account Information</h2>
          {isLoadingUser ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 text-[#a1a1aa] animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-[#1f1f1f]">
                <span className="text-[#a1a1aa]">Email</span>
                <span className="text-white">{user?.email || "N/A"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1f1f1f]">
                <span className="text-[#a1a1aa]">Username</span>
                <span className="text-white">{user?.username || "N/A"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1f1f1f]">
                <span className="text-[#a1a1aa]">Telegram ID</span>
                <span className="text-white">{user?.telegramId || "Not linked"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1f1f1f]">
                <span className="text-[#a1a1aa]">Referral Code</span>
                <span className="text-white font-mono">{user?.referralCode || "N/A"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[#a1a1aa]">Account Status</span>
                <span className="text-green-500">{user?.status || "Active"}</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
