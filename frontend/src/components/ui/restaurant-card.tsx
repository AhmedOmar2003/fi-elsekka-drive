"use client"

import Link from "next/link"
import Image from "next/image"
import { Button, cn } from "./button"
import { Clock3, Store, UtensilsCrossed } from "lucide-react"

type RestaurantCardProps = {
  id: string
  name: string
  shortDescription?: string | null
  cuisine?: string | null
  imageUrl?: string | null
  isAvailable?: boolean
  className?: string
}

export function RestaurantCard({
  id,
  name,
  shortDescription,
  cuisine,
  imageUrl,
  isAvailable = true,
  className,
}: RestaurantCardProps) {
  return (
    <div
      className={cn(
        "group aspect-square overflow-hidden rounded-[30px] border border-surface-border bg-surface shadow-[var(--shadow-material-1)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-material-2)]",
        className
      )}
    >
      <Link href={`/restaurants/${id}`} className="grid h-full grid-rows-[1.28fr_auto] md:grid-rows-[1.08fr_auto]">
        <div className="relative overflow-hidden bg-surface-container">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={name}
              fill
              sizes="(max-width: 768px) 92vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-500">
              <UtensilsCrossed className="h-10 w-10" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent p-4">
            <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${isAvailable ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
              {isAvailable ? "متاح الآن" : "مغلق حاليًا"}
            </span>
          </div>
        </div>
        <div className="flex min-h-0 flex-col justify-between p-3.5 md:p-4">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-black leading-6 text-foreground md:line-clamp-1 md:text-base">{name}</h3>
              {cuisine ? (
                <span className="mt-1.5 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">
                  {cuisine}
                </span>
              ) : null}
            </div>
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10 text-primary">
              <Store className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-2 min-h-0">
            <p className="line-clamp-2 text-[11px] leading-5 text-gray-500 md:line-clamp-2 md:text-xs md:leading-6">
              {shortDescription || "منيو مرتب وسهل من داخل في السكة. ادخل شوف الأصناف واطلب مباشرة."}
            </p>
          </div>

          <div className="mt-3 border-t material-divider pt-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-500 md:text-[11px]">
                  <Clock3 className="h-3.5 w-3.5 shrink-0" />
                  <span className="line-clamp-2 md:line-clamp-1">الإدارة تتابع وقت التوصيل مع المطعم</span>
                </span>
              </div>

              <Button
                asChild
                className="h-10 w-full shrink-0 rounded-2xl px-4 text-xs font-black md:w-auto md:text-sm"
              >
                <span>ادخل شوف اللي بيقدمه</span>
              </Button>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
