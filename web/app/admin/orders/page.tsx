"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Copy, ClipboardCheck, Search } from "lucide-react";
import { api, type Order } from "@/lib/api";

const statusMeta: Record<string, { label: string; color: string }> = {
  DISPENSED: { label: "Dispensed", color: "#4ADE80" },
  PENDING_LIQUIDITY: { label: "Pending liquidity", color: "#F2B84B" },
  PROCESSING: { label: "Processing", color: "#8B98A5" },
  FAILED: { label: "Failed", color: "#F2735C" },
  REFUNDED: { label: "Refunded", color: "#8B98A5" },
  PENDING_PAYMENT: { label: "Pending payment", color: "#8B98A5" },
  PAYMENT_VERIFIED: { label: "Payment verified", color: "#8B98A5" },
  DISPENSING_QUEUED: { label: "Dispensing", color: "#8B98A5" },
  DISPENSED_SUCCESS: { label: "Success", color: "#4ADE80" },
  FAILED_REFUND_NEEDED: { label: "Failed", color: "#F2735C" },
};

const selectClass = "bg-[#0B0F14] border-[#232C36] text-white w-[180px]";
const inputClass = "bg-[#0B0F14] border-[#232C36] text-white focus-visible:ring-[#FF8A3D] focus-visible:ring-offset-0";

export default function AdminOrdersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [chainFilter, setChainFilter] = useState("all");
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch orders with filters
  const { data: ordersResponse, isLoading, refetch } = useQuery({
    queryKey: ["admin-orders", statusFilter, chainFilter, searchQuery],
    queryFn: () =>
      api.getOrders({
        status: statusFilter === "all" ? undefined : statusFilter,
        chain: chainFilter === "all" ? undefined : chainFilter,
        search: searchQuery || undefined,
        pageSize: 100, // Load more for client-side filtering
      }),
  });

  const orders = ordersResponse?.orders || [];

  // Retry order mutation
  const retryMutation = useMutation({
    mutationFn: (orderId: string) => api.retryOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });

  // Resolve order mutation
  const resolveMutation = useMutation({
    mutationFn: ({ orderId, notes }: { orderId: string; notes?: string }) =>
      api.markOrderResolved(orderId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });

  // Refund order mutation
  const refundMutation = useMutation({
    mutationFn: (orderId: string) => api.refundOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(type);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const handleRetryDispense = async (orderId: string) => {
    retryMutation.mutate(orderId);
  };

  const handleManualResolve = async (orderId: string) => {
    resolveMutation.mutate({ orderId });
  };

  const handleIssueRefund = async (orderId: string) => {
    refundMutation.mutate(orderId);
  };

  // Calculate stats from fetched orders
  const stats = [
    { label: "Total orders", value: orders.length },
    { label: "Dispensed", value: orders.filter((o) => o.status === "DISPENSED_SUCCESS").length },
    { label: "Pending liquidity", value: orders.filter((o) => o.status === "PENDING_LIQUIDITY").length },
    { label: "Failed", value: orders.filter((o) => o.status === "FAILED_REFUND_NEEDED").length },
    { label: "Refunded", value: orders.filter((o) => o.status === "REFUNDED").length },
  ];

  // Map API Order to UI fields
  const mapOrderToUI = (order: Order) => ({
    id: order.id,
    chain: order.chain,
    status: order.status,
    targetWallet: order.targetWallet,
    ngnPaid: order.fiatAmountNaira,
    cryptoOutput: order.cryptoAmount,
    explorerUrl: order.txHash ? `https://explorer.com/tx/${order.txHash}` : null, // This would need chain-specific logic
    createdAt: order.createdAt,
    userId: order.userId,
    telegramHandle: order.user.username ? `@${order.user.username}` : order.user.firstName || "Unknown",
  });

  const uiOrders = orders.map(mapOrderToUI);

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

      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-white">Order management</h1>
        <p className="text-[#8B98A5]">Every gas order, filterable and actionable.</p>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 border-y border-[#232C36] mb-8">
          {stats.map((s, i) => (
            <div key={s.label} className={`py-4 px-3 ${i !== 0 ? "md:border-l border-[#232C36]" : ""}`}>
              <p className="font-data text-2xl font-semibold text-white">{s.value}</p>
              <p className="text-sm text-[#8B98A5]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5560]" />
            <Input
              placeholder="Search by order, wallet, or handle"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 ${inputClass}`}
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value || "all")}>
            <SelectTrigger className={selectClass}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#12181F] border-[#232C36] text-white">
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="DISPENSED_SUCCESS">Dispensed</SelectItem>
              <SelectItem value="PENDING_LIQUIDITY">Pending liquidity</SelectItem>
              <SelectItem value="DISPENSING_QUEUED">Processing</SelectItem>
              <SelectItem value="FAILED_REFUND_NEEDED">Failed</SelectItem>
              <SelectItem value="REFUNDED">Refunded</SelectItem>
            </SelectContent>
          </Select>
          <Select value={chainFilter} onValueChange={(value) => setChainFilter(value || "all")}>
            <SelectTrigger className={selectClass}>
              <SelectValue placeholder="Chain" />
            </SelectTrigger>
            <SelectContent className="bg-[#12181F] border-[#232C36] text-white">
              <SelectItem value="all">All chains</SelectItem>
              <SelectItem value="SOLANA">Solana</SelectItem>
              <SelectItem value="BASE">Base</SelectItem>
              <SelectItem value="TON">TON</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orders Table */}
        <div className="ticket rounded-md">
          <div className="p-5 border-b border-[#232C36]">
            <p className="text-sm text-[#8B98A5]">{isLoading ? "Loading..." : `${uiOrders.length} orders found`}</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#232C36] hover:bg-transparent">
                  <TableHead className="text-[#8B98A5]">Order</TableHead>
                  <TableHead className="text-[#8B98A5]">Chain</TableHead>
                  <TableHead className="text-[#8B98A5]">Status</TableHead>
                  <TableHead className="text-[#8B98A5]">User</TableHead>
                  <TableHead className="text-[#8B98A5]">Target wallet</TableHead>
                  <TableHead className="text-[#8B98A5]">NGN paid</TableHead>
                  <TableHead className="text-[#8B98A5]">Crypto out</TableHead>
                  <TableHead className="text-[#8B98A5]">Date</TableHead>
                  <TableHead className="text-[#8B98A5]">Explorer</TableHead>
                  <TableHead className="text-[#8B98A5]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-[#8B98A5] py-8">
                      Loading orders...
                    </TableCell>
                  </TableRow>
                ) : uiOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-[#8B98A5] py-8">
                      No orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  uiOrders.map((order) => {
                    const status = statusMeta[order.status] ?? { label: order.status, color: "#8B98A5" };
                    return (
                      <TableRow key={order.id} className="border-b border-[#232C36] hover:bg-[#161B22] transition-colors">
                        <TableCell className="font-data text-xs text-[#8B98A5]">{order.id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          <span className="text-xs text-[#8B98A5] border border-[#232C36] rounded-sm px-2 py-1">
                            {order.chain}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 text-sm text-[#EDEFEA]">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-[#8B98A5]">{order.telegramHandle}</TableCell>
                        <TableCell className="font-data text-xs text-[#8B98A5]">
                          <div className="flex items-center gap-2">
                            {order.targetWallet.slice(0, 8)}...{order.targetWallet.slice(-4)}
                            <button
                              className="text-[#8B98A5] hover:text-white transition-colors"
                              onClick={() => copyToClipboard(order.targetWallet, `wallet-${order.id}`)}
                            >
                              {copiedItem === `wallet-${order.id}` ? (
                                <ClipboardCheck className="h-3 w-3 text-[#4ADE80]" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="font-data font-semibold text-white">
                          ₦{order.ngnPaid.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-data font-semibold text-white">
                          {order.cryptoOutput.toFixed(6)}
                        </TableCell>
                        <TableCell className="text-sm text-[#8B98A5]">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {order.explorerUrl ? (
                            <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
                              <button className="text-[#8B98A5] hover:text-white transition-colors">
                                <ExternalLink className="h-4 w-4" />
                              </button>
                            </a>
                          ) : (
                            <span className="text-[#4A5560]">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {order.status === "FAILED_REFUND_NEEDED" && (
                              <button
                                onClick={() => handleRetryDispense(order.id)}
                                disabled={retryMutation.isPending}
                                className="p-1.5 text-[#8B98A5] hover:text-white transition-colors disabled:opacity-50"
                                title="Retry dispense"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            )}
                            {(order.status === "FAILED_REFUND_NEEDED" || order.status === "PENDING_LIQUIDITY") && (
                              <button
                                onClick={() => handleManualResolve(order.id)}
                                disabled={resolveMutation.isPending}
                                className="p-1.5 text-[#8B98A5] hover:text-[#4ADE80] transition-colors disabled:opacity-50"
                                title="Mark resolved"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            )}
                            {(order.status === "FAILED_REFUND_NEEDED" || order.status === "PENDING_LIQUIDITY") && (
                              <button
                                onClick={() => handleIssueRefund(order.id)}
                                disabled={refundMutation.isPending}
                                className="p-1.5 text-[#8B98A5] hover:text-[#F2735C] transition-colors disabled:opacity-50"
                                title="Issue refund"
                              >
                                <AlertCircle className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}