import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Lock } from "lucide-react";

interface AuthModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onAuthenticate: (secret: string) => Promise<{ success: boolean; token?: string; message?: string }>;
}

export function AuthModal({ isOpen, onClose, onAuthenticate }: AuthModalProps) {
  const [secret, setSecret] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await onAuthenticate(secret);
      if (result.success) {
        if (result.token) {
          localStorage.setItem('admin_token', result.token);
        }
        onClose?.();
      } else {
        setError(result.message || "Authentication failed");
      }
    } catch (err) {
      setError("An error occurred during authentication");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md glassmorphism border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            <Shield className="h-6 w-6 text-indigo-500" />
            Admin Authentication
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Enter your admin secret to access the dashboard
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                type="password"
                placeholder="Enter admin secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="pl-10 bg-slate-900/50 border-slate-700 text-slate-200 placeholder:text-slate-500"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 btn-glow" disabled={isLoading}>
              {isLoading ? "Authenticating..." : "Access Dashboard"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-700 text-slate-300 hover:bg-slate-800">
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}