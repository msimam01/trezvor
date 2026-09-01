"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Mail, Lock, ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [method, setMethod] = useState<"telegram" | "email">("telegram");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState("");

  const handleTelegramAuth = async () => {
    setIsLoading(true);
    setError("");
    try {
      // In production, this would use Telegram Login Widget
      // For now, we'll simulate with a mock payload
      const telegramData = {
        telegramId: "123456789",
        username: "testuser",
        firstName: "Test",
        authDate: Math.floor(Date.now() / 1000),
        hash: "mock_hash",
      };

      const response = await api.telegramAuth(telegramData);
      const result = await login({ telegramData });
      
      if (result.success) {
        // Redirect based on role (though telegram users typically are USER role)
        router.push("/dashboard");
      } else {
        setError(result.message || "Telegram authentication failed");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Telegram authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (mode === "login") {
        const response = await api.login(email, password);
        const result = await login({ email, password });
        
        if (result.success) {
          // Wait a moment for auth context to update
          setTimeout(() => {
            // Redirect based on role
            if (response.user.role === "ADMIN") {
              router.push("/admin");
            } else {
              router.push("/dashboard");
            }
          }, 100);
        } else {
          setError(result.message || "Login failed");
        }
      } else {
        const response = await api.register({ email, password, username, firstName });
        const result = await login({ email, password });
        
        if (result.success) {
          router.push("/dashboard");
        } else {
          setError(result.message || "Registration failed");
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <main className="container mx-auto px-4 py-24">
        <div className="max-w-md mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6 mono-btn-ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>

          <Card className="mono-card">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-white">
                {mode === "login" ? "Sign In" : "Create Account"}
              </CardTitle>
              <CardDescription className="text-zinc-400">
                {mode === "login" ? "Access your GasBot account" : "Start using GasBot today"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Auth Method Toggle */}
              <div className="flex gap-2 mb-6">
                <Button
                  variant={method === "telegram" ? "default" : "outline"}
                  className={`flex-1 ${method === "telegram" ? "mono-btn-primary" : "mono-btn-secondary"}`}
                  onClick={() => setMethod("telegram")}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Telegram
                </Button>
                <Button
                  variant={method === "email" ? "default" : "outline"}
                  className={`flex-1 ${method === "email" ? "mono-btn-primary" : "mono-btn-secondary"}`}
                  onClick={() => setMethod("email")}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {method === "telegram" ? (
                <div className="text-center space-y-4">
                  <div className="p-6 mono-surface rounded-lg">
                    <p className="text-sm text-zinc-400 mb-4">
                      Connect your Telegram account to access GasBot
                    </p>
                    <Button
                      className="w-full mono-btn-primary"
                      onClick={handleTelegramAuth}
                      disabled={isLoading}
                    >
                      {isLoading ? "Connecting..." : "Continue with Telegram"}
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    We'll never post to your Telegram account without your permission.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  {mode === "register" && (
                    <>
                      <div>
                        <Label htmlFor="username" className="text-white">Username</Label>
                        <Input
                          id="username"
                          placeholder="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="mono-input mt-2"
                          required={mode === "register"}
                        />
                      </div>
                      <div>
                        <Label htmlFor="firstName" className="text-white">First Name</Label>
                        <Input
                          id="firstName"
                          placeholder="John"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="mono-input mt-2"
                          required={mode === "register"}
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <Label htmlFor="email" className="text-white">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mono-input mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password" className="text-white">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mono-input mt-2"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full mono-btn-primary"
                    disabled={isLoading}
                  >
                    {isLoading
                      ? (mode === "login" ? "Signing in..." : "Creating account...")
                      : (mode === "login" ? "Sign In" : "Create Account")}
                  </Button>
                  {mode === "login" && (
                    <div className="text-center">
                      <Link href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                  )}
                </form>
              )}

              <div className="pt-6 border-t mono-divider">
                <p className="text-center text-sm text-zinc-400">
                  {mode === "login" ? (
                    <>
                      Don't have an account?{" "}
                      <button
                        onClick={() => setMode("register")}
                        className="text-white hover:underline ml-1"
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        onClick={() => setMode("login")}
                        className="text-white hover:underline ml-1"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}