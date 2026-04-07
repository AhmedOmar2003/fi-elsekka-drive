"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button, cn } from "./button"
import { Heart, Star, ShoppingCart, Check } from "lucide-react"
import { useCart } from "@/contexts/CartContext"
import { useFavorites } from "@/contexts/FavoritesContext"
import { addGroupOrderItem } from "@/services/groupOrdersService"
import { getStoredGroupParticipant } from "@/lib/group-order-session"
import { toast } from "sonner"
import { formatMoney } from "@/lib/formatters"

export interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  oldPrice?: number;
  discountBadge?: string;
  infoBadge?: string;
  imageUrl: string;
  rating?: number;
  reviewsCount?: number;
  productMode?: "single" | "bundle";
  bundleItems?: { name: string; quantity?: string; note?: string }[];
  className?: string;
}

export function ProductCard({
  id,
  title,
  price,
  oldPrice,
  discountBadge,
  infoBadge,
  imageUrl,
  rating,
  reviewsCount,
  productMode = "single",
  bundleItems = [],
  className,
}: ProductCardProps) {
  const { addItem } = useCart()
  const { isFavorite, toggleFavorite } = useFavorites()
  const router = useRouter()
  const [isAdded, setIsAdded] = React.useState(false)
  const [groupOrderCode, setGroupOrderCode] = React.useState<string | null>(null)
  const fav = isFavorite(id)
  const hasVisibleOldPrice = typeof oldPrice === "number" && oldPrice > price
  const productHref = groupOrderCode ? `/product/${id}?groupOrder=${groupOrderCode}` : `/product/${id}`

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const syncGroupOrderCode = () => {
      const params = new URLSearchParams(window.location.search)
      setGroupOrderCode(params.get("groupOrder"))
    }

    syncGroupOrderCode()
    window.addEventListener("popstate", syncGroupOrderCode)

    return () => {
      window.removeEventListener("popstate", syncGroupOrderCode)
    }
  }, [])

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (groupOrderCode) {
      const participant = getStoredGroupParticipant(groupOrderCode)
      if (!participant?.participantKey) {
        toast.error("اكتب اسمك الأول داخل الطلب الجماعي قبل ما تضيف منتجات")
        router.push(`/group-order/${groupOrderCode}`)
        return
      }

      await addGroupOrderItem(groupOrderCode, participant.participantKey, id, 1)
      toast.success(`اتضاف "${title}" في الطلب الجماعي`)
    } else {
      await addItem(id, 1)
    }

    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 2000)
  }

  const handleToggleFav = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await toggleFavorite(id)
  }

  const isBundle = productMode === "bundle"
  return (
    <div className={cn("group relative flex h-full flex-col overflow-hidden rounded-[24px] border border-surface-border/80 bg-surface shadow-[var(--shadow-material-1)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[var(--shadow-material-2)] hover:border-surface-border touch-manipulation sm:min-h-[320px] sm:rounded-[28px]", className)}>
      <Link href={productHref} className="relative aspect-[4/3] sm:aspect-[4/3] w-full overflow-hidden bg-surface-container">

        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="w-full h-full object-cover object-center scale-[1.06] transition-transform duration-500 group-hover:scale-[1.14]"
          />
        </div>

        {/* Discount Badge */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
          {isBundle && (
            <span className="inline-flex items-center rounded-full border border-primary/10 bg-primary px-3 py-1 text-[11px] font-black tracking-wide text-white shadow-[var(--shadow-material-1)]">
              باكج
            </span>
          )}
          {discountBadge && (
            <span className="inline-flex items-center rounded-full border border-secondary/10 bg-secondary px-3 py-1 text-[11px] font-black tracking-wide text-white shadow-[var(--shadow-material-1)]">
              {discountBadge}
            </span>
          )}
          {infoBadge && (
            <span className="inline-flex items-center rounded-full border border-primary/10 bg-primary/90 px-3 py-1 text-[11px] font-black tracking-wide text-white shadow-[var(--shadow-material-1)]">
              {infoBadge}
            </span>
          )}
        </div>

        {/* Favorite Heart Button */}
        <button
          onClick={handleToggleFav}
          aria-label={fav ? "إزالة من المفضلة" : "أضف للمفضلة"}
          className={cn(
            "absolute top-3 left-3 z-10 rounded-full border border-white/20 p-2 backdrop-blur-md shadow-sm transition-all duration-300 active:scale-90",
            fav
              ? "bg-secondary/10 text-secondary border-secondary/20 opacity-100"
              : "bg-background/60 text-foreground/60 hover:text-secondary hover:bg-background/90 opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
          )}
        >
          <Heart className={cn("w-5 h-5 transition-transform", fav && "fill-current")} />
        </button>

        {/* Subtle premium gradient overlay on image hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      </Link>

      <div className="relative z-20 flex flex-1 flex-col bg-surface px-3 pb-2.5 pt-2.5 sm:p-5">
        {/* Rating */}
        {rating && (
          <div className="mb-1.5 inline-flex w-fit items-center gap-1 rounded-full border border-surface-border bg-surface-container px-2 py-1 text-[10px] font-medium transition-colors group-hover:bg-surface-container-high sm:mb-2 sm:gap-1.5 sm:px-2.5 sm:text-[11px]">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-500" />
            <span className="text-foreground tracking-wide">{rating} <span className="mr-1 hidden sm:inline opacity-60">({reviewsCount})</span></span>
          </div>
        )}

        <Link href={productHref} className="mb-0.5 block h-[33px] sm:h-[42px]">
          <h3 className="line-clamp-2 text-[12.5px] font-heading font-semibold leading-[1.35] text-foreground transition-colors group-hover:text-primary sm:text-base">
            {title}
          </h3>
        </Link>

        <div className="mt-1 flex items-end justify-between gap-2 border-t material-divider pt-1">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[17px] font-heading font-black tracking-tight text-primary sm:text-xl">{formatMoney(price)}</span>
            </div>
            {hasVisibleOldPrice && (
              <span className="text-[11px] font-heading text-gray-500 line-through sm:text-xs">{formatMoney(oldPrice)}</span>
            )}
            {!hasVisibleOldPrice && <span className="h-1.5 sm:h-2"></span>}
          </div>

          <Button
            size="icon"
            variant="primary"
            className={cn(
              "h-[42px] w-[42px] shrink-0 rounded-2xl bg-primary text-white shadow-[var(--shadow-material-1)] ring-1 ring-primary/15 transition-all duration-300 active:scale-90 hover:bg-primary-hover sm:h-12 sm:w-12",
              isAdded ? "bg-primary text-white ring-primary/15 hover:bg-primary-hover" : ""
            )}
            aria-label="أضف للسلة"
            onClick={handleAddToCart}
          >
            {isAdded ? <Check className="h-[17px] w-[17px] text-white sm:h-[18px] sm:w-[18px]" strokeWidth={2.4} /> : <ShoppingCart className="h-[17px] w-[17px] text-white sm:h-[18px] sm:w-[18px]" strokeWidth={2.2} />}
          </Button>
        </div>
      </div>
    </div>
  )
}
