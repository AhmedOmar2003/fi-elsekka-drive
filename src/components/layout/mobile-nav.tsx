"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CarTaxiFront, CircleUserRound, MapPinned } from "lucide-react";
import { cn } from "@/components/ui/button";

const items = [
  { href: "/", label: "الرئيسية", icon: <MapPinned className="h-5 w-5" /> },
  { href: "/book", label: "احجز", icon: <CarTaxiFront className="h-5 w-5" /> },
  { href: "/trips", label: "رحلاتي", icon: <MapPinned className="h-5 w-5" /> },
  { href: "/notifications", label: "الإشعارات", icon: <Bell className="h-5 w-5" /> },
  { href: "/account", label: "حسابي", icon: <CircleUserRound className="h-5 w-5" /> },
];

export function MobileNav() {
  const pathname = usePathname();
  const hidden = pathname.startsWith("/captain/join");

  if (hidden) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-background/92 backdrop-blur-xl md:hidden">
      <nav className="mx-auto flex h-[76px] max-w-xl items-center justify-around px-2">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-[58px] flex-col items-center gap-1 rounded-[20px] px-3 py-2 text-[11px] font-black transition-colors",
                active ? "bg-primary/10 text-primary" : "text-gray-500 hover:text-foreground",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
