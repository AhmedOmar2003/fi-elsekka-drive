"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ride/brand-logo";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { settings } = useAppSettings();

  // Hide header completely on auth screens if desired, but for now just keep it clean.
  const isAuthScreen = pathname.startsWith("/login") || pathname.startsWith("/register");
  if (isAuthScreen) return null;

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-gradient-to-b from-background/90 to-transparent pt-3 pb-6 pointer-events-none">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 pointer-events-auto">
        <div className="flex items-center gap-3">
          <Button asChild variant="secondary" size="icon" className="h-12 w-12 rounded-full shadow-[var(--shadow-material-2)] bg-surface-container/90 backdrop-blur-md border-white/5 text-foreground hover:bg-surface-container">
            <Link href="/account" aria-label="القائمة">
              <Menu className="h-5 w-5" />
            </Link>
          </Button>
        </div>

        <BrandLogo tagline={settings.siteTagline} />

        <div className="flex items-center gap-3">
          <Button asChild variant="secondary" size="icon" className="h-12 w-12 rounded-full shadow-[var(--shadow-material-2)] bg-surface-container/90 backdrop-blur-md border-white/5 text-foreground hover:bg-surface-container">
            <Link href={user ? "/account" : "/login"} aria-label="حسابي">
              <CircleUserRound className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
