import * as React from "react"
import { cn } from "./button"

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-surface-hover",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

/** Skeleton that mirrors the shape of a ProductCard */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-3xl bg-surface border border-surface-hover", className)}>
      {/* Image area */}
      <Skeleton className="aspect-[4/3] sm:aspect-[3/2] w-full rounded-none" />

      {/* Content area */}
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        {/* Rating row */}
        <Skeleton className="h-4 w-20 rounded-full" />

        {/* Title */}
        <Skeleton className="h-5 w-4/5 rounded-lg" />
        <Skeleton className="h-5 w-3/5 rounded-lg" />

        {/* Price row */}
        <div className="mt-2 flex items-center justify-between pt-3 border-t border-surface-hover">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-24 rounded-lg" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
          <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
        </div>
      </div>
    </div>
  )
}
