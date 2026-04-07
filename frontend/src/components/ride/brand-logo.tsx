import Link from "next/link";
import { Route } from "lucide-react";
import { cn } from "@/components/ui/button";

export function BrandLogo({
  compact = false,
  href = "/",
  tagline,
  className,
}: {
  compact?: boolean;
  href?: string;
  tagline?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-3", className)}>
      <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[20px] bg-gradient-to-br from-surface-container to-surface-container-high border border-primary/20 shadow-[0_4px_16px_rgba(61,161,132,0.15)] transition-transform group-hover:scale-105 group-active:scale-95">
        <span className="absolute inset-[4px] rounded-[16px] bg-gradient-to-b from-surface-container-low to-surface-container border border-white/5" />
        <Route className="relative w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(61,161,132,0.8)]" strokeWidth={2.5} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="flex items-baseline gap-1">
          <span className="text-xl font-black text-foreground" style={{ fontFamily: "var(--font-logo)" }}>
            في 
          </span>
          <span className="text-xl font-black text-primary" style={{ fontFamily: "var(--font-logo)" }}>
            السكة
          </span>
        </span>
        {!compact && tagline ? (
          <span className="mt-1.5 text-[10px] uppercase tracking-wider font-bold text-gray-500">{tagline}</span>
        ) : null}
      </span>
    </Link>
  );
}
