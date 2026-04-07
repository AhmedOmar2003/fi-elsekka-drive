import * as React from "react"
import { cn } from "./button"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "destructive" | "success";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  
  const baseClasses = "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary tracking-wide shadow-[var(--shadow-material-1)]"
  
  const variants = {
    default: "border-primary/10 bg-[linear-gradient(135deg,var(--surface-accent),rgba(20,148,111,0.12))] text-primary hover:bg-surface-accent-strong",
    secondary: "border-surface-border bg-[linear-gradient(180deg,var(--surface-container),var(--surface-container-high))] text-foreground hover:bg-surface-container-high",
    destructive: "border-secondary/10 bg-[linear-gradient(135deg,rgba(235,93,134,0.12),rgba(235,93,134,0.18))] text-secondary hover:bg-secondary/20",
    success: "border-emerald-500/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.2))] text-emerald-600 hover:bg-emerald-500/20",
    outline: "text-foreground border-surface-border bg-[linear-gradient(180deg,var(--brand-surface),transparent)]",
  }

  return (
    <div className={cn(baseClasses, variants[variant], className)} {...props} />
  )
}

export { Badge }
