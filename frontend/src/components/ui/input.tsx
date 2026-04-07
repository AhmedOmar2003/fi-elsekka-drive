import * as React from "react"
import { cn } from "./button"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-2xl border border-surface-border bg-surface-container px-4 py-2 text-sm text-foreground shadow-[var(--shadow-material-1)] transition-all duration-200 placeholder:text-gray-400/80",
          "focus-visible:outline-none focus-visible:ring-[4px] focus-visible:ring-primary/10 focus-visible:border-primary/40 focus-visible:bg-surface",
          "hover:border-surface-border/80",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-secondary focus-visible:ring-secondary/20 focus-visible:border-secondary",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
