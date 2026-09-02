"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Settings, Wallet, Percent, Info } from "lucide-react";
import { api, type FeeSettings, type PlatformSettings } from "@/lib/api";

const inputClass =
  "bg-[#0B0F14] border-[#232C36] text-white font-data focus-visible:ring-[#FF8A3D] focus-visible:ring-offset-0";

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => api.getSettings(),
  });

  const [feeSettings, setFeeSettings] = useState<FeeSettings>({
    platformFeePercentage: 5,
    maxFeeCap: 200,
    referralCommissionRate: 20,
    isVirtualAccountEnabled: false,
  });
  const [liquidityThresholds, setLiquidityThresholds] = useState<{
    SOLANA: { minBalance: number; alertThreshold: number };
    BASE: { minBalance: number; alertThreshold: number };
    TON: { minBalance: number; alertThreshold: number };
  }>({
    SOLANA: { minBalance: 1.0, alertThreshold: 0.5 },
    BASE: { minBalance: 0.01, alertThreshold: 0.005 },
    TON: { minBalance: 10.0, alertThreshold: 5.0 },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Update local state when data is fetched
  useEffect(() => {
    if (settings && !isLoading) {
      if (settings.feeSettings) {
        setFeeSettings({
          platformFeePercentage: settings.feeSettings.platformFeePercentage ?? 5,
          maxFeeCap: settings.feeSettings.maxFeeCap ?? 200,
          referralCommissionRate: settings.feeSettings.referralCommissionRate ?? 20,
          isVirtualAccountEnabled: settings.feeSettings.isVirtualAccountEnabled ?? false,
        });
      }
      if (settings.liquidityThresholds) {
        setLiquidityThresholds(settings.liquidityThresholds);
      }
    }
  }, [settings, isLoading]);

  const handleFeeSettingsChange = (field: keyof FeeSettings, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (!isNaN(numValue)) {
      setFeeSettings((prev) => ({ ...prev, [field]: numValue }));
    }
  };

  const handleLiquidityThresholdChange = (chain: string, field: 'minBalance' | 'alertThreshold', value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (!isNaN(numValue)) {
      setLiquidityThresholds((prev) => ({
        ...prev,
        [chain]: { ...prev[chain as keyof typeof prev], [field]: numValue }
      }));
    }
  };

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: (platformSettings: PlatformSettings) => api.updateSettings(platformSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (error) => {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    },
  });

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const platformSettings: PlatformSettings = {
        feeSettings,
        liquidityThresholds: liquidityThresholds as any, // Type casting to match backend structure
      };
      console.log('Saving settings:', platformSettings);
      await saveMutation.mutateAsync(platformSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

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
        .ticket {
          background: #12181f;
          border: 1px solid #232c36;
        }
      `}</style>

      <div className="mb-10">
        <h1 className="font-display text-3xl font-semibold text-white">Platform settings</h1>
        <p className="text-[#8B98A5]">Fees and liquidity thresholds, applied platform-wide.</p>
      </div>

      <div className="max-w-4xl mx-auto">
        {isLoading ? (
          <div className="text-center text-[#8B98A5] py-8">Loading settings...</div>
        ) : (
          <>
            {/* Fee Configuration */}
            <div className="ticket rounded-md p-6 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Percent className="h-4 w-4 text-[#FF8A3D]" />
                <h2 className="font-display text-lg font-semibold text-white">Fee configuration</h2>
              </div>
              <p className="text-sm text-[#8B98A5] mb-6">Set how much the platform charges per gas transaction</p>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="platformFeePercentage" className="text-[#EDEFEA]">
                    Platform fee percentage
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="platformFeePercentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={feeSettings.platformFeePercentage}
                      onChange={(e) => handleFeeSettingsChange("platformFeePercentage", e.target.value)}
                      className={`max-w-xs ${inputClass}`}
                    />
                    <span className="text-[#8B98A5]">%</span>
                  </div>
                  <p className="text-xs text-[#4A5560]">Charged on each transaction — 5 means 5%</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxFeeCap" className="text-[#EDEFEA]">
                    Maximum fee cap (₦)
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[#8B98A5]">₦</span>
                    <Input
                      id="maxFeeCap"
                      type="number"
                      min="0"
                      step="1"
                      value={feeSettings.maxFeeCap}
                      onChange={(e) => handleFeeSettingsChange("maxFeeCap", e.target.value)}
                      className={`max-w-xs ${inputClass}`}
                    />
                  </div>
                  <p className="text-xs text-[#4A5560]">The most NGN that can be charged on a single order</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referralCommissionRate" className="text-[#EDEFEA]">
                    Referral commission rate (%)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="referralCommissionRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={feeSettings.referralCommissionRate}
                      onChange={(e) => handleFeeSettingsChange("referralCommissionRate", e.target.value)}
                      className={`max-w-xs ${inputClass}`}
                    />
                    <span className="text-[#8B98A5]">%</span>
                  </div>
                  <p className="text-xs text-[#4A5560]">Percentage of platform fee paid to referrers — 20 means 20% of platform fee</p>
                </div>

                <div className="border border-dashed border-[#232C36] rounded-md p-4">
                  <div className="flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-[#8B98A5] mt-0.5 shrink-0" />
                    <div className="text-sm text-[#8B98A5]">
                      <p className="font-medium text-[#EDEFEA] mb-2">
                        Worked example — ₦10,000 order, 5% fee, ₦200 cap
                      </p>
                      <div className="space-y-1 font-data text-xs">
                        <p>Standard fee: ₦10,000 × 5% = ₦500</p>
                        <p>Capped fee: min(₦500, ₦200) = ₦200</p>
                        <p>User's crypto is bought with: ₦10,000 − ₦200 = ₦9,800</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Liquidity Thresholds */}
            <div className="ticket rounded-md p-6 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-[#FF8A3D]" />
                <h2 className="font-display text-lg font-semibold text-white">Vault threshold controls</h2>
              </div>
              <p className="text-sm text-[#8B98A5] mb-6">Set when a hot wallet balance should raise an alert</p>

              <div className="space-y-4">
                {Object.entries(liquidityThresholds).map(([chain, threshold]) => (
                  <div key={chain} className="border border-[#232C36] rounded-md p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-display font-medium text-white">{chain}</h4>
                      <span className="text-xs text-[#8B98A5] border border-[#232C36] rounded-sm px-2 py-1">
                        {chain === 'SOLANA' ? 'SOL' : chain === 'BASE' ? 'ETH' : 'TON'}
                      </span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`minBalance-${chain}`} className="text-[#EDEFEA]">
                          Minimum balance
                        </Label>
                        <Input
                          id={`minBalance-${chain}`}
                          type="number"
                          min="0"
                          step="0.0001"
                          value={threshold.minBalance}
                          onChange={(e) =>
                            handleLiquidityThresholdChange(chain, "minBalance", e.target.value)
                          }
                          className={inputClass}
                        />
                        <p className="text-xs text-[#4A5560]">Required for normal operation</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`alertThreshold-${chain}`} className="text-[#EDEFEA]">
                          Alert threshold
                        </Label>
                        <Input
                          id={`alertThreshold-${chain}`}
                          type="number"
                          min="0"
                          step="0.0001"
                          value={threshold.alertThreshold}
                          onChange={(e) =>
                            handleLiquidityThresholdChange(chain, "alertThreshold", e.target.value)
                          }
                          className={inputClass}
                        />
                        <p className="text-xs text-[#4A5560]">Balance that triggers a notification</p>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="border border-dashed border-[#232C36] rounded-md p-4">
                  <div className="flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-[#8B98A5] mt-0.5 shrink-0" />
                    <div className="text-sm text-[#8B98A5]">
                      <p className="font-medium text-[#EDEFEA] mb-2">When a vault drops below its threshold</p>
                      <ul className="space-y-1 text-xs">
                        <li>Admins get an email alert</li>
                        <li>New orders on that chain move to pending liquidity</li>
                        <li>Affected users are notified of the delay</li>
                        <li>New transactions pause until liquidity is restored</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-[#8B98A5] flex items-center gap-1.5">
                <Settings className="h-4 w-4" />
                Changes apply immediately
              </div>
              <Button
                onClick={handleSaveSettings}
                disabled={isSaving || saveMutation.isPending}
                className={
                  saveSuccess
                    ? "bg-transparent border border-[#4ADE80] text-[#4ADE80] hover:bg-[#4ADE80]/10 rounded-sm"
                    : "bg-[#FF8A3D] hover:bg-[#FF9D5C] text-[#0B0F14] font-semibold rounded-sm"
                }
              >
                {isSaving || saveMutation.isPending ? (
                  <>
                    <Settings className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : saveSuccess ? (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save settings
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}