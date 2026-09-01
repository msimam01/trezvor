"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Check, AlertTriangle, Zap, User, X } from "lucide-react";

interface Notification {
  id: string;
  type: "low-liquidity" | "failed-transaction" | "user-dispute" | "system-alert";
  title: string;
  message: string;
  urgency: "critical" | "high" | "medium" | "low";
  timestamp: string;
  read: boolean;
  metadata?: {
    chain?: string;
    orderId?: string;
    userId?: string;
    amount?: string;
  };
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "low-liquidity",
    title: "Low liquidity warning",
    message: "Solana hot wallet balance is below threshold. Current: 0.5 SOL, threshold: 1.0 SOL",
    urgency: "critical",
    timestamp: "2024-08-31T09:15:00Z",
    read: false,
    metadata: { chain: "SOLANA", amount: "0.5 SOL" },
  },
  {
    id: "2",
    type: "failed-transaction",
    title: "Transaction failed",
    message: "Order ORD-003 failed to dispense TON due to insufficient liquidity",
    urgency: "high",
    timestamp: "2024-08-31T08:45:00Z",
    read: false,
    metadata: { chain: "TON", orderId: "ORD-003" },
  },
  {
    id: "3",
    type: "user-dispute",
    title: "User dispute flagged",
    message: "User #452 has disputed order ORD-002 and it needs manual review",
    urgency: "high",
    timestamp: "2024-08-31T07:30:00Z",
    read: true,
    metadata: { userId: "452", orderId: "ORD-002" },
  },
  {
    id: "4",
    type: "system-alert",
    title: "System performance alert",
    message: "High memory usage detected in the queue processor — worth monitoring",
    urgency: "medium",
    timestamp: "2024-08-31T06:00:00Z",
    read: true,
  },
  {
    id: "5",
    type: "low-liquidity",
    title: "Liquidity warning",
    message: "Base ETH wallet balance is approaching its minimum threshold",
    urgency: "medium",
    timestamp: "2024-08-30T23:00:00Z",
    read: true,
    metadata: { chain: "BASE", amount: "0.01 ETH" },
  },
];

const urgencyColor: Record<Notification["urgency"], string> = {
  critical: "#F2735C",
  high: "#F2B84B",
  medium: "#8B98A5",
  low: "#4A5560",
};

interface NotificationsProps {
  onNotificationClick?: (notification: Notification) => void;
}

export function Notifications({ onNotificationClick }: NotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [filter, setFilter] = useState<"all" | "unread" | "critical">("all");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "critical") return n.urgency === "critical";
    return true;
  });

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "low-liquidity":
        return <Zap className="h-4 w-4" />;
      case "failed-transaction":
        return <AlertTriangle className="h-4 w-4" />;
      case "user-dispute":
        return <User className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <div className="relative">
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap");
        .font-display {
          font-family: "Space Grotesk", sans-serif;
        }
      `}</style>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-[#8B98A5] hover:text-white hover:bg-[#161B22]"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-[#F2735C] text-[10px] text-white font-medium">
            {unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 top-12 w-96 max-h-[80vh] overflow-hidden z-50 rounded-md border border-[#232C36] bg-[#12181F] shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-[#232C36] flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-white">Notifications</h3>
                <p className="text-xs text-[#8B98A5]">{unreadCount} unread</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={markAllAsRead} className="p-1.5 text-[#8B98A5] hover:text-white transition-colors" title="Mark all read">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1.5 text-[#8B98A5] hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="p-2 border-b border-[#232C36] flex gap-1">
              {(["all", "unread", "critical"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 text-sm py-1.5 rounded-sm capitalize transition-colors ${
                    filter === f ? "bg-[#FF8A3D] text-[#0B0F14] font-semibold" : "text-[#8B98A5] hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Notifications List */}
            <div className="max-h-[400px] overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-8 w-8 text-[#4A5560] mx-auto mb-2" />
                  <p className="text-sm text-[#8B98A5]">No notifications</p>
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-[#232C36] hover:bg-[#161B22] transition-colors cursor-pointer ${
                      !notification.read ? "bg-[#161B22]/60" : ""
                    }`}
                    onClick={() => {
                      if (!notification.read) markAsRead(notification.id);
                      onNotificationClick?.(notification);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md bg-[#0B0F14] border border-[#232C36] text-[#8B98A5] shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-white truncate">{notification.title}</h4>
                          <span
                            className="text-xs shrink-0 flex items-center gap-1.5"
                            style={{ color: urgencyColor[notification.urgency] }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: urgencyColor[notification.urgency] }}
                            />
                            {notification.urgency}
                          </span>
                        </div>
                        <p className="text-xs text-[#8B98A5] mb-2 line-clamp-2">{notification.message}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-[#4A5560]">{new Date(notification.timestamp).toLocaleString()}</p>
                          {notification.metadata && (
                            <div className="flex gap-1.5">
                              {notification.metadata.chain && (
                                <span className="text-xs text-[#8B98A5] border border-[#232C36] rounded-sm px-1.5 py-0.5">
                                  {notification.metadata.chain}
                                </span>
                              )}
                              {notification.metadata.orderId && (
                                <span className="text-xs text-[#8B98A5] border border-[#232C36] rounded-sm px-1.5 py-0.5">
                                  {notification.metadata.orderId}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[#232C36]">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full text-sm text-[#8B98A5] hover:text-white transition-colors py-1.5"
              >
                View all notifications
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}