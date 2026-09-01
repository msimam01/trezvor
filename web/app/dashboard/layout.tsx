"use client";

import { ReactNode } from "react";
import { UserSidebar } from "@/components/user/user-sidebar";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAdmin, user } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("auth_token");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white flex">
      <UserSidebar isAdmin={isAdmin} userEmail={user?.email} onLogout={handleLogout} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
