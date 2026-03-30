"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CircleUserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ride/brand-logo";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { settings } = useAppSettings();

  // Hide header completely on auth screens
  const isAuthScreen = pathname.startsWith("/login") || pathname.startsWith("/register");
  if (isAuthScreen) return null;

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-gradient-to-b from-background/90 to-transparent pt-3 pb-6 pointer-events-none">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 pointer-events-auto">
        
        {/* Right Side (in RTL): Logo */}
        <div className="flex items-center scale-90 origin-right">
          <BrandLogo tagline={settings.siteTagline} />
        </div>

        {/* Left Side (in RTL): Notifications and Account */}
        <div className="flex items-center gap-2.5">
          <Button asChild variant="secondary" size="icon" className="h-[46px] w-[46px] rounded-full shadow-sm bg-surface-container/90 backdrop-blur-md border border-white/5 text-gray-400 hover:text-foreground hover:bg-surface-container transition-colors relative">
            <Link href="/notifications" aria-label="الإشعارات">
              <Bell className="h-5 w-5" />
              {/* Optional pending notification dot fake */}
              <span className="absolute top-3 right-3.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse-slow"></span>
            </Link>
          </Button>

          <Button asChild variant="secondary" size="icon" className="h-[46px] w-[46px] rounded-full shadow-[var(--shadow-premium)] bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 hover:scale-105 active:scale-95 transition-all">
            <Link href={user ? "/account" : "/login"} aria-label="حسابي">
              <CircleUserRound className="h-[22px] w-[22px]" />
            </Link>
          </Button>
        </div>

      </div>
    </header>
  );
}
