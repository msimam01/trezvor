"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Shield, Wallet, RefreshCw, CheckCircle2, XCircle, AlertCircle, Search, Clock } from "lucide-react";
import Link from "next/link";

// Mock data for vault balances
const vaultBalances = [
  {
    chain: "Solana",
    symbol: "SOL",
    balance: 125.5,
    address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    status: "healthy",
  },
  {
    chain: "Base",
    symbol: "ETH",
    balance: 8.75,
    address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    status: "healthy",
  },
  {
    chain: "TON",
    symbol: "TON",
    balance: 450.25,
    address: "UQC...x8L",
    status: "warning",
  },
];

// Mock data for orders
const mockOrders = [
  {
    id: "3b194bc4-de57-42cd-b237-a3d9e00728de",
    userId: "user-123",
    chain: "TON",
    amount: 2.319666,
    targetWallet: "UQCI7d2SQ9ili8W41vpsIuaMyVmBMQcsBxEcM01UE5aL-j5l",
    status: "PENDING_LIQUIDITY",
    createdAt: "2024-08-30T10:15:00Z",
    paymentRef: "GAS-lq4x9m-2A5B7C",
  },
  {
    id: "1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p",
    userId: "user-456",
    chain: "SOLANA",
    amount: 0.025,
    targetWallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    status: "DISPENSED_SUCCESS",
    createdAt: "2024-08-30T09:30:00Z",
    paymentRef: "GAS-k3j8h2-9D4E6F",
    txHash: "5H7x...K9Lm",
  },
  {
    id: "9f8e7d6c-5b4a-3f2e-1d0c-9b8a7f6e5d4c",
    userId: "user-789",
    chain: "BASE",
    amount: 0.0015,
    targetWallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    status: "FAILED_REFUND_NEEDED",
    createdAt: "2024-08-30T08:45:00Z",
    paymentRef: "GAS-m5n1p3-7G8H9I",
  },
  {
    id: "2b3c4d5e-6f7g-8h9i-0j1k-2l3m4n5o6p7q",
    userId: "user-101",
    chain: "SOLANA",
    amount: 0.05,
    targetWallet: "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsV",
    status: "DISPENSING_QUEUED",
    createdAt: "2024-08-30T11:00:00Z",
    paymentRef: "GAS-q6r4s8-1J2K3L",
  },
];

type OrderStatus = "PENDING_PAYMENT" | "PAYMENT_VERIFIED" | "DISPENSING_QUEUED" | "PENDING_LIQUIDITY" | "DISPENSED_SUCCESS" | "FAILED_REFUND_NEEDED";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would verify against a real backend
    if (adminSecret === "admin-secret-123") {
      setIsAuthenticated(true);
    } else {
      alert("Invalid admin secret");
    }
  };

  const filteredOrders = mockOrders.filter((order) => {
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesSearch = 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.paymentRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.targetWallet.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: OrderStatus) => {
    const statusConfig = {
      PENDING_PAYMENT: { variant: "secondary" as const, icon: Clock, label: "Pending Payment" },
      PAYMENT_VERIFIED: { variant: "default" as const, icon: CheckCircle2, label: "Payment Verified" },
      DISPENSING_QUEUED: { variant: "outline" as const, icon: RefreshCw, label: "Dispensing" },
      PENDING_LIQUIDITY: { variant: "destructive" as const, icon: AlertCircle, label: "Pending Liquidity" },
      DISPENSED_SUCCESS: { variant: "default" as const, icon: CheckCircle2, label: "Success", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
      FAILED_REFUND_NEEDED: { variant: "destructive" as const, icon: XCircle, label: "Failed" },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Admin Portal
            </CardTitle>
            <CardDescription>Enter admin secret to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Enter admin secret"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button type="submit" className="w-full">
                Access Dashboard
              </Button>
              <Link href="/">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Navigation */}
      <nav className="border-b bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold">Admin Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Monitor vault balances and manage orders
            </p>
          </div>

          {/* Vault Balances */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Wallet className="h-6 w-6" />
              Vault Balances
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {vaultBalances.map((vault) => (
                <Card key={vault.chain}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {vault.chain}
                      {vault.status === "healthy" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      )}
                    </CardTitle>
                    <CardDescription>{vault.symbol} Vault</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Balance</p>
                        <p className="text-2xl font-bold">
                          {vault.balance.toFixed(6)} {vault.symbol}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Address</p>
                        <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                          {vault.address.slice(0, 10)}...{vault.address.slice(-8)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-4">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Orders Management */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Order Management</h2>
            
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by ID, payment ref, or wallet..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === "PENDING_LIQUIDITY" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("PENDING_LIQUIDITY")}
                >
                  Pending Liquidity
                </Button>
                <Button
                  variant={statusFilter === "FAILED_REFUND_NEEDED" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("FAILED_REFUND_NEEDED")}
                >
                  Failed
                </Button>
                <Button
                  variant={statusFilter === "DISPENSED_SUCCESS" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("DISPENSED_SUCCESS")}
                >
                  Success
                </Button>
              </div>
            </div>

            {/* Orders Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Chain</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Target Wallet</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">
                          {order.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.chain}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {order.amount.toFixed(6)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {order.targetWallet.slice(0, 8)}...{order.targetWallet.slice(-4)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(order.status as OrderStatus)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(order.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {order.status === "PENDING_LIQUIDITY" && (
                              <Button size="sm" variant="outline">
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            {order.status === "FAILED_REFUND_NEEDED" && (
                              <>
                                <Button size="sm" variant="outline">
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="outline">
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost">
                              Details
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>© 2024 GasBot Admin Portal. Authorized access only.</p>
        </div>
      </footer>
    </div>
  );
}