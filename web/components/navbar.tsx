"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TelegramLinkModal } from "@/components/telegram-link-modal";
import { Button } from "@/components/ui/button";
import { Zap, User, LogOut, Menu, X } from "lucide-react";

interface NavbarProps {
  isAuthenticated?: boolean;
  userName?: string;
  onLogin?: () => void;
  onLogout?: () => void;
}

export function Navbar({ isAuthenticated = false, userName, onLogin, onLogout }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/airdrops", label: "Airdrops" },
    { href: "/features", label: "Features" },
    { href: "/dashboard", label: "Orders", authenticated: true },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 border-b border-[#232C36] bg-[#0B0F14]/85 backdrop-blur-xl transition-all duration-300 ${
        isScrolled ? "py-3" : "py-4"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#FF8A3D]" />
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              Trezvor
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map(
              (link) =>
                (!link.authenticated || isAuthenticated) && (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-[#8B98A5] hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                )
            )}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <TelegramLinkModal />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161B22] border border-[#232C36] rounded-full">
                  <User className="h-4 w-4 text-[#8B98A5]" />
                  <span className="font-data text-sm text-[#EDEFEA]">{userName || "User"}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="text-[#8B98A5] hover:text-white hover:bg-[#161B22] p-2 rounded-md transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={onLogin}
                className="bg-[#FF8A3D] hover:bg-[#FF9D5C] text-[#0B0F14] font-semibold rounded-sm"
              >
                Sign in
              </Button>
            )}

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-[#8B98A5] hover:text-white"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-[#0B0F14] border-b border-[#232C36] py-4 px-4">
            <div className="flex flex-col gap-4">
              {navLinks.map(
                (link) =>
                  (!link.authenticated || isAuthenticated) && (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-sm text-[#8B98A5] hover:text-white transition-colors py-2"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  )
              )}
              {!isAuthenticated && (
                <button
                  onClick={() => {
                    onLogin?.();
                    setIsMobileMenuOpen(false);
                  }}
                  className="bg-[#FF8A3D] hover:bg-[#FF9D5C] text-[#0B0F14] font-semibold rounded-sm w-full py-2"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}