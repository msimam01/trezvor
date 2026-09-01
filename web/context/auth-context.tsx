"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  email?: string;
  telegramId?: string;
  username?: string;
  firstName?: string;
  role?: string;
  referralCode?: string;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { secret?: string; email?: string; password?: string; telegramData?: any }) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to decode JWT token
function decodeJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing tokens on mount
    const adminToken = localStorage.getItem("admin_token");
    const userToken = localStorage.getItem("auth_token");

    if (adminToken) {
      setIsAdmin(true);
      // Decode the token to get user info
      const decoded = decodeJWT(adminToken);
      setUser({ 
        id: decoded?.sub || "admin", 
        email: decoded?.email || "admin", 
        role: "ADMIN" 
      });
    } else if (userToken) {
      // Decode the token to get user info and role
      const decoded = decodeJWT(userToken);
      const userRole = decoded?.role || "USER";
      setUser({ 
        id: decoded?.sub || "user", 
        email: decoded?.email, 
        role: userRole 
      });
      setIsAdmin(userRole === "ADMIN");
    }

    setIsLoading(false);
  }, []);

  const login = async (credentials: { secret?: string; email?: string; password?: string; telegramData?: any }) => {
    try {
      if (credentials.email && credentials.password) {
        // Email/password login
        const response = await api.login(credentials.email, credentials.password);
        if (response.access_token) {
          localStorage.setItem("auth_token", response.access_token);
          setUser(response.user || null);
          setIsAdmin(response.user?.role === "ADMIN");
          console.log("Login successful:", response.user);
          return { success: true };
        }
        return { success: false, message: "Invalid credentials" };
      } else if (credentials.secret) {
        // Admin secret login (for backward compatibility)
        const response = await api.adminLogin(credentials.secret);
        if (response.access_token) {
          localStorage.setItem("admin_token", response.access_token);
          setIsAdmin(true);
          setUser({ id: "admin", username: "admin", role: "ADMIN" });
          return { success: true };
        }
        return { success: false, message: "Invalid admin secret" };
      } else if (credentials.telegramData) {
        // Telegram login
        const response = await api.telegramAuth(credentials.telegramData);
        if (response.access_token) {
          localStorage.setItem("auth_token", response.access_token);
          setUser(response.user || null);
          setIsAdmin(response.user?.role === "ADMIN");
          console.log("Telegram login successful:", response.user);
          return { success: true };
        }
        return { success: false, message: "Telegram login failed" };
      }
      return { success: false, message: "Invalid credentials" };
    } catch (error: any) {
      console.error("Login error:", error);
      return { success: false, message: error.response?.data?.message || "Login failed" };
    }
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("auth_token");
    setUser(null);
    setIsAdmin(false);
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isAuthenticated,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}