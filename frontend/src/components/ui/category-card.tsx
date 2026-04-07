import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "./button"

export interface CategoryCardProps {
  slug: string;
  name: string;
  icon?: React.ReactNode;
  imageUrl?: string;
  className?: string;
}

export function CategoryCard({ slug, name, icon, imageUrl, className }: CategoryCardProps) {
  return (
    <Link 
      href={`/category/${slug}`}
      className={cn(
        "group relative z-0 flex h-full flex-col items-center gap-3 rounded-[24px] border border-surface-border/70 bg-surface px-3 py-4 shadow-[var(--shadow-material-1)] transition-all duration-300 ease-out hover:z-10 hover:-translate-y-1 hover:shadow-[var(--shadow-material-2)]",
        className
      )}
    >
      <div className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-surface-border bg-surface-container transition-all duration-300 shadow-[var(--shadow-material-1)] group-hover:scale-[1.02] sm:h-[92px] sm:w-[92px] sm:rounded-[26px]">
        
        <div className="absolute inset-0 bg-primary/0 opacity-70 transition-opacity duration-300 group-hover:bg-primary/5"></div>

        {icon ? (
          <div className="relative z-10 text-gray-600 transition-colors duration-300 transform group-hover:scale-105 group-hover:text-primary dark:text-gray-300">
            {icon}
          </div>
        ) : imageUrl ? (
          <Image 
            src={imageUrl} 
            alt={name} 
            width={44}
            height={44}
            className="relative z-10 h-9 w-9 object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-md sm:h-11 sm:w-11" 
          />
        ) : null}
      </div>
      <span className="w-full overflow-hidden text-ellipsis text-center font-heading text-[11px] font-semibold text-foreground transition-colors group-hover:text-primary sm:text-sm">
        {name}
      </span>
    </Link>
  )
}
