"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Eye, Shield, ShieldAlert } from "lucide-react";
import { api, type User } from "@/lib/api";

const statusMeta: Record<User["status"], { label: string; color: string }> = {
  active: { label: "Active", color: "#4ADE80" },
  suspended: { label: "Suspended", color: "#F2B84B" },
  banned: { label: "Banned", color: "#F2735C" },
};

const selectClass = "bg-[#0B0F14] border-[#232C36] text-white w-[180px]";
const inputClass = "bg-[#0B0F14] border-[#232C36] text-white focus-visible:ring-[#FF8A3D] focus-visible:ring-offset-0";

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  // Fetch users with filters
  const { data: usersResponse, isLoading, refetch } = useQuery({
    queryKey: ["admin-users", statusFilter, searchQuery],
    queryFn: () =>
      api.getUsers({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: searchQuery || undefined,
        pageSize: 100,
      }),
  });

  const users = usersResponse?.users || [];

  // Update user status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "active" | "suspended" | "banned" }) =>
      api.updateUserStatus(userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const handleToggleStatus = async (userId: string, currentStatus: User["status"]) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    updateStatusMutation.mutate({ userId, status: newStatus });
  };

  const handleViewOrders = (userId: string) => {
    // Navigate to orders filtered by user
    window.location.href = `/admin/orders?userId=${userId}`;
  };

  // Calculate stats from fetched users
  const stats = [
    { label: "Total users", value: users.length },
    { label: "Active", value: users.filter((u) => u.status === "active").length },
    { label: "Suspended", value: users.filter((u) => u.status === "suspended").length },
    { label: "Banned", value: users.filter((u) => u.status === "banned").length },
  ];

  // Map API User to UI fields
  const mapUserToUI = (user: User) => ({
    id: user.id,
    telegramHandle: user.username ? `@${user.username}` : user.firstName || "Unknown",
    telegramId: user.telegramId ? user.telegramId.toString() : "N/A",
    joinedDate: user.joinedDate,
    totalOrders: user.totalOrders,
    lifetimeVolume: user.lifetimeVolume,
    status: user.status,
    lastActive: user.lastActive,
  });

  const uiUsers = users.map(mapUserToUI);

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
        <h1 className="font-display text-3xl font-semibold text-white">User management</h1>
        <p className="text-[#8B98A5]">Every registered user, one row each.</p>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-y border-[#232C36] mb-8">
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
              placeholder="Search by handle or ID"
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <div className="ticket rounded-md">
          <div className="p-5 border-b border-[#232C36]">
            <p className="text-sm text-[#8B98A5]">{isLoading ? "Loading..." : `${uiUsers.length} users found`}</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#232C36] hover:bg-transparent">
                  <TableHead className="text-[#8B98A5]">User</TableHead>
                  <TableHead className="text-[#8B98A5]">Handle</TableHead>
                  <TableHead className="text-[#8B98A5]">Telegram ID</TableHead>
                  <TableHead className="text-[#8B98A5]">Status</TableHead>
                  <TableHead className="text-[#8B98A5]">Joined</TableHead>
                  <TableHead className="text-[#8B98A5]">Orders</TableHead>
                  <TableHead className="text-[#8B98A5]">Lifetime volume</TableHead>
                  <TableHead className="text-[#8B98A5]">Last active</TableHead>
                  <TableHead className="text-[#8B98A5]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-[#8B98A5] py-8">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : uiUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-[#8B98A5] py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  uiUsers.map((user) => {
                    const status = statusMeta[user.status];
                    return (
                      <TableRow key={user.id} className="border-b border-[#232C36] hover:bg-[#161B22] transition-colors">
                        <TableCell className="font-data text-xs text-[#8B98A5]">{user.id.slice(0, 8)}...</TableCell>
                        <TableCell className="text-sm text-white font-medium">{user.telegramHandle}</TableCell>
                        <TableCell className="font-data text-xs text-[#8B98A5]">{user.telegramId}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2 text-sm text-[#EDEFEA]">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-[#8B98A5]">
                          {new Date(user.joinedDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-data font-semibold text-white">{user.totalOrders}</TableCell>
                        <TableCell className="font-data font-semibold text-white">
                          ₦{user.lifetimeVolume.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-[#8B98A5]">
                          {new Date(user.lastActive).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleViewOrders(user.id)}
                              className="p-1.5 text-[#8B98A5] hover:text-white transition-colors"
                              title="View orders"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {user.status !== "banned" && (
                              <button
                                onClick={() => handleToggleStatus(user.id, user.status)}
                                disabled={updateStatusMutation.isPending}
                                className="p-1.5 text-[#8B98A5] hover:text-white transition-colors disabled:opacity-50"
                                title={user.status === "active" ? "Suspend user" : "Activate user"}
                              >
                                {user.status === "active" ? (
                                  <ShieldAlert className="h-4 w-4" />
                                ) : (
                                  <Shield className="h-4 w-4" />
                                )}
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