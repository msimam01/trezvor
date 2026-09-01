"use client";

import { useState, useEffect } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isAdmin, user } = useAuth();
  const router = useRouter();
  const [notificationCount, setNotificationCount] = useState(0);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    setIsChecking(false);
  }, []);

  useEffect(() => {
    // Redirect if not authenticated or not admin
    if (!isChecking) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (isAuthenticated && !isAdmin) {
        router.push("/dashboard");
      }
    }
  }, [isAuthenticated, isAdmin, router, isChecking]);

  useEffect(() => {
    // Fetch notification count when authenticated
    if (isAuthenticated && isAdmin) {
      // In production, fetch actual notification count
      setNotificationCount(0);
    }
  }, [isAuthenticated, isAdmin]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("auth_token");
    router.push("/login");
  };

  const handleNotificationClick = () => {
    // In production, this would open the notification drawer
    console.log("Opening notifications");
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="text-white">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#EDEFEA] flex antialiased">
      <AdminSidebar
        adminEmail={user?.email || "admin@gasbot.com"}
        notificationCount={notificationCount}
        onLogout={handleLogout}
        onNotificationClick={handleNotificationClick}
      />
      <main className="flex-1 p-8 overflow-y-auto bg-[#0B0F14]">{children}</main>
    </div>
  );
}