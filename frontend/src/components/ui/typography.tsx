import * as React from "react"
import { cn } from "./button"

export function H1({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn("scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl", className)}
      {...props}
    />
  )
}

export function H2({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("scroll-m-20 text-3xl font-bold tracking-tight first:mt-0", className)}
      {...props}
    />
  )
}

export function H3({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("scroll-m-20 text-2xl font-bold tracking-tight", className)}
      {...props}
    />
  )
}

export function P({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("leading-7 [&:not(:first-child)]:mt-6", className)}
      {...props}
    />
  )
}

export function Lead({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xl text-gray-400", className)}
      {...props}
    />
  )
}
