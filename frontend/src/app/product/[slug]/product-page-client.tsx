"use client"

import * as React from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProductCard } from "@/components/ui/product-card"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Star, ShieldCheck, Truck, ChevronRight, Check, Minus, Plus, ShoppingCart, Tag, Camera, Send, MessageSquare, X, Share2, Copy, MapPin, Banknote, Clock3, Users } from "lucide-react"
import { fetchProductDetails, fetchRelatedProducts, Product } from "@/services/productsService"
import { fetchProductReviews, calcReviewStats, createReview, updateReview, fetchUserProductReview, checkUserPurchased, checkUserReviewed, uploadReviewImage, Review, ReviewStats } from "@/services/reviewsService"
import { useCart } from "@/contexts/CartContext"
import { useAuth } from "@/contexts/AuthContext"
import { DiscountCodeInput } from "@/components/ui/discount-code-input"
import { toast } from "sonner"
import { getBundleItems, getBundleSummary, getProductMode, toProductCardProps } from "@/lib/product-presentation"
import { getTaxonomyLabel, getTaxonomySelection } from "@/lib/category-taxonomy"
import { getProductCatalogMetadata } from "@/lib/product-metadata"
import { buildRestaurantSizeVariant, getRestaurantSizeOptions, resolveVariantUnitPrice, type RestaurantSizeOption } from "@/lib/product-variants"
import { CURRENT_DELIVERY_FEE } from "@/lib/order-economics"
import { formatNumberLatin } from "@/lib/formatters"
import { addGroupOrderItem, createGroupOrder } from "@/services/groupOrdersService"
import { getStoredGroupParticipant, saveStoredGroupParticipant } from "@/lib/group-order-session"

function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M19.05 4.94A9.86 9.86 0 0 0 12.03 2C6.57 2 2.13 6.43 2.13 11.9c0 1.75.46 3.46 1.33 4.96L2 22l5.3-1.39a9.9 9.9 0 0 0 4.73 1.2h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.12-2.89-6.97Zm-7.02 15.2h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.15.83.84-3.07-.2-.31a8.16 8.16 0 0 1-1.27-4.37c0-4.53 3.69-8.22 8.24-8.22 2.2 0 4.27.86 5.82 2.41a8.15 8.15 0 0 1 2.4 5.82c0 4.54-3.69 8.23-8.2 8.23Zm4.5-6.13c-.24-.12-1.4-.69-1.62-.76-.21-.08-.37-.12-.53.12-.15.23-.61.76-.74.92-.14.16-.28.18-.52.06a6.65 6.65 0 0 1-1.95-1.2 7.4 7.4 0 0 1-1.36-1.69c-.14-.24-.01-.36.1-.48.11-.11.24-.28.35-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.53-1.28-.72-1.75-.19-.46-.39-.4-.53-.4h-.45c-.16 0-.42.06-.65.3-.22.24-.84.82-.84 2 0 1.17.86 2.3.98 2.46.12.16 1.68 2.57 4.08 3.6.57.24 1.02.38 1.37.49.57.18 1.1.15 1.52.09.46-.07 1.4-.57 1.6-1.12.2-.56.2-1.03.14-1.13-.05-.1-.2-.16-.44-.28Z" />
    </svg>
  )
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.09 4.39 23.08 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.03 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.27h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07Z" />
    </svg>
  )
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.9 2H22l-6.76 7.73L23.2 22h-6.24l-4.9-6.4L6.46 22H3.35l7.23-8.26L1 2h6.4l4.43 5.84L18.9 2Zm-1.1 18h1.72L6.45 3.9H4.61L17.8 20Z" />
    </svg>
  )
}

function TelegramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M21.94 4.66c.17-.8-.4-1.38-1.16-1.09L2.6 10.55c-.74.3-.73 1.34.02 1.62l4.62 1.45 1.79 5.64c.23.72 1.15.84 1.54.2l2.55-4.11 4.95 3.67c.6.44 1.45.11 1.6-.62l2.27-13.74ZM9.4 13.11l9.77-6.18-7.93 7.68a.8.8 0 0 0-.21.37l-.9 3.6-.73-2.3a.8.8 0 0 0-.52-.52l-2.3-.72 3.6-.93c.08-.02.16-.06.22-.12Z" />
    </svg>
  )
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 1.8A3.7 3.7 0 0 0 3.8 7.5v9a3.7 3.7 0 0 0 3.7 3.7h9a3.7 3.7 0 0 0 3.7-3.7v-9a3.7 3.7 0 0 0-3.7-3.7h-9Zm9.7 1.35a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8Z" />
    </svg>
  )
}

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M14.52 2c.28 1.95 1.38 3.4 3.38 4.1.6.21 1.26.32 1.98.34v2.87a8.37 8.37 0 0 1-4.1-1.1v6.13c0 3.5-2.56 6.18-6.08 6.18A6.1 6.1 0 0 1 3.6 14.4c0-3.37 2.74-6.12 6.12-6.12.33 0 .67.03 1 .08v2.96a3.13 3.13 0 0 0-1-.17 3.2 3.2 0 0 0 0 6.4 3.2 3.2 0 0 0 3.2-3.2V2h1.6Z" />
    </svg>
  )
}

export default function ProductPage({
  initialProduct = null,
  initialRelatedProducts = [],
}: {
  initialProduct?: Product | null
  initialRelatedProducts?: Product[]
}) {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addItem } = useCart()
  const { user } = useAuth()
  const activeGroupOrderCode = searchParams.get("groupOrder")

  const [quantity, setQuantity] = React.useState(1)
  const [isAdded, setIsAdded] = React.useState(false)
  const [isMounted, setIsMounted] = React.useState(false)
  const [isShareSheetOpen, setIsShareSheetOpen] = React.useState(false)
  const [shareUrl, setShareUrl] = React.useState("")
  
  const [appliedDiscountPrice, setAppliedDiscountPrice] = React.useState<number | null>(null)
  const [appliedDiscountLabel, setAppliedDiscountLabel] = React.useState<string | null>(null)
  const [selectedRestaurantSizeId, setSelectedRestaurantSizeId] = React.useState("")

  React.useEffect(() => {
    const t = setTimeout(() => setIsMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href)
    }
  }, [])

  const handleAddToCart = async () => {
    if (dbProduct) {
      const cartAppliedPrice = selectedVariantJson ? effectiveUnitPrice : appliedDiscountPrice
      if (activeGroupOrderCode) {
        const participant = getStoredGroupParticipant(activeGroupOrderCode)
        if (!participant?.participantKey) {
          toast.error("اكتب اسمك الأول داخل الطلب الجماعي قبل ما تضيف منتجات")
          router.push(`/group-order/${activeGroupOrderCode}`)
          return
        }

        await addGroupOrderItem(activeGroupOrderCode, participant.participantKey, dbProduct.id, quantity, {
          selectedVariantJson,
          unitPrice: effectiveUnitPrice,
        })
        toast.success(`اتضاف "${dbProduct.name}" في الطلب الجماعي`)
      } else {
        await addItem(dbProduct.id, quantity, cartAppliedPrice, selectedVariantJson)
      }
    }
    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 2000)
  }

  const handleCreateGroupOrder = async () => {
    if (!dbProduct) return
    if (!user) {
      toast.error("سجّل دخول الأول علشان تنشئ طلب جماعي")
      router.push(`/login?redirect=${encodeURIComponent(`/product/${slugOrId}`)}`)
      return
    }

    try {
      const result = await createGroupOrder([{
        productId: dbProduct.id,
        quantity,
        selectedVariantJson,
        unitPrice: effectiveUnitPrice,
      }])
      saveStoredGroupParticipant(result.code, {
        participantKey: result.participantKey,
        displayName: result.displayName,
      })
      toast.success("جهزنا لك رابط الطلب الجماعي، ابعته لأصحابك")
      router.push(`/group-order/${result.code}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "مقدرتش أنشئ الطلب الجماعي دلوقتي")
    }
  }

  const handleBuyNow = async () => {
    if (!dbProduct) return;
    const metadata = getProductCatalogMetadata(dbProduct.specifications)
    if (metadata.restaurantItem && metadata.restaurantAvailable === false) {
      toast.error("المنتج ده غير متوفر حاليًا من المطعم")
      return
    }
    const searchParams = new URLSearchParams();
    searchParams.set("buyNow", dbProduct.id);
    searchParams.set("qty", quantity.toString());
    if (appliedDiscountPrice !== null) {
      searchParams.set("price", appliedDiscountPrice.toString());
    } else if (selectedVariantJson) {
      searchParams.set("price", effectiveUnitPrice.toString());
    }
    if (selectedVariantJson) {
      searchParams.set("variant", JSON.stringify(selectedVariantJson));
    }
    router.push(`/checkout?${searchParams.toString()}`);
  }

  const copyShareLink = React.useCallback(async (targetLabel?: string) => {
    if (!shareUrl) {
      toast.error("لسه الرابط مش جاهز")
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success(targetLabel ? `نسخت الرابط علشان تشاركه على ${targetLabel} ✨` : "تم نسخ الرابط ✨")
    } catch {
      toast.error("مقدرتش أنسخ الرابط، جرب تاني")
    }
  }, [shareUrl])

  const openShareUrl = React.useCallback((targetUrl: string) => {
    if (typeof window !== "undefined") {
      window.open(targetUrl, "_blank", "noopener,noreferrer")
    }
  }, [])

  const slugOrId = typeof params.slug === 'string' ? params.slug : ''

  const [dbProduct, setDbProduct] = React.useState<Product | null>(initialProduct)
  const [relatedProducts, setRelatedProducts] = React.useState<Product[]>(initialRelatedProducts)
  const [isLoading, setIsLoading] = React.useState(!initialProduct)
  const restaurantSizeOptions = React.useMemo(
    () => getRestaurantSizeOptions(dbProduct?.specifications),
    [dbProduct?.specifications]
  )
  const selectedRestaurantSize = React.useMemo<RestaurantSizeOption | null>(() => {
    if (restaurantSizeOptions.length === 0) return null
    return restaurantSizeOptions.find((option) => option.id === selectedRestaurantSizeId) || restaurantSizeOptions[0]
  }, [restaurantSizeOptions, selectedRestaurantSizeId])
  const selectedVariantJson = React.useMemo(
    () => buildRestaurantSizeVariant(selectedRestaurantSize),
    [selectedRestaurantSize]
  )

  React.useEffect(() => {
    if (restaurantSizeOptions.length === 0) {
      setSelectedRestaurantSizeId("")
      return
    }

    setSelectedRestaurantSizeId((currentId) => {
      if (restaurantSizeOptions.some((option) => option.id === currentId)) {
        return currentId
      }
      return restaurantSizeOptions[0].id
    })
  }, [restaurantSizeOptions])

  const normalizedSpecs = React.useMemo(() => {
    if (!dbProduct) return []

    if (Array.isArray(dbProduct.product_specifications) && dbProduct.product_specifications.length > 0) {
      return dbProduct.product_specifications.map((spec) => ({
        label: spec.label,
        value: spec.description,
      }))
    }

    const fallbackSpecs = Array.isArray(dbProduct.specifications?.custom_specs)
      ? dbProduct.specifications.custom_specs
      : []

    return fallbackSpecs
      .filter((spec: any) => spec?.label?.trim() && (spec?.description || spec?.value || '').trim())
      .map((spec: any) => ({
        label: spec.label.trim(),
        value: String(spec.description || spec.value).trim(),
      }))
  }, [dbProduct])

  React.useEffect(() => {
    const loadProduct = async () => {
      setIsLoading(true)
      const [data, related] = await Promise.all([
        fetchProductDetails(slugOrId),
        fetchRelatedProducts(slugOrId, 8),
      ])
      setDbProduct(data)
      setRelatedProducts(related)
      setIsLoading(false)
    }

    if (slugOrId) {
      if (initialProduct?.id === slugOrId) {
        setDbProduct(initialProduct)
        setRelatedProducts(initialRelatedProducts)
        setIsLoading(false)
      } else {
        loadProduct()
      }
    } else {
      setIsLoading(false)
      setRelatedProducts([])
    }
  }, [slugOrId, initialProduct, initialRelatedProducts])

  // ── Reviews state ─────────────────────────────────────────
  const [reviews, setReviews] = React.useState<Review[]>([])
  const [reviewStats, setReviewStats] = React.useState<ReviewStats>({ averageRating: 0, totalReviews: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })
  const [reviewsLoading, setReviewsLoading] = React.useState(true)
  const [canReview, setCanReview] = React.useState(false)
  const [alreadyReviewed, setAlreadyReviewed] = React.useState(false)
  const [existingReview, setExistingReview] = React.useState<Review | null>(null)
  const [showReviewForm, setShowReviewForm] = React.useState(false)

  // Review form state
  const [reviewRating, setReviewRating] = React.useState(5)
  const [reviewComment, setReviewComment] = React.useState("")
  const [reviewImages, setReviewImages] = React.useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)

  // Load reviews function
  const loadReviews = React.useCallback(async () => {
    if (!slugOrId) return
    
    setReviewsLoading(true)
    const data = await fetchProductReviews(slugOrId)
    setReviews(data)
    setReviewStats(calcReviewStats(data))
    setReviewsLoading(false)

    if (user) {
      const [purchased, reviewed, currentReview] = await Promise.all([
        checkUserPurchased(user.id, slugOrId),
        checkUserReviewed(user.id, slugOrId),
        fetchUserProductReview(user.id, slugOrId),
      ])
      setCanReview(purchased)
      setAlreadyReviewed(reviewed)
      setExistingReview(currentReview)
    } else {
      setCanReview(false)
      setAlreadyReviewed(false)
      setExistingReview(null)
    }
  }, [slugOrId, user])

  // Load reviews when product is available
  React.useEffect(() => {
    loadReviews()
  }, [loadReviews])

  // Refetch reviews when window gains focus (e.g. after admin deletes in another tab)
  React.useEffect(() => {
    const handleFocus = () => {
      loadReviews()
    }
    
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadReviews])

  const openReviewForm = React.useCallback(() => {
    if (existingReview) {
      setReviewRating(existingReview.rating)
      setReviewComment(existingReview.comment || "")
      setReviewImages(existingReview.images || [])
    } else {
      setReviewRating(5)
      setReviewComment("")
      setReviewImages([])
    }

    setShowReviewForm(true)
  }, [existingReview])

  const handleSubmitReview = async () => {
    if (!user || !dbProduct) return
    setIsSubmitting(true)

    const reviewerName = (user as any).user_metadata?.full_name || user.email?.split('@')[0] || 'مستخدم'
    const { data, error } = existingReview
      ? await updateReview(
          existingReview.id,
          reviewRating,
          reviewComment,
          reviewImages,
        )
      : await createReview(
          user.id,
          dbProduct.id,
          reviewRating,
          reviewComment,
          reviewImages,
          reviewerName
        )

    if (error) {
      const message = error instanceof Error ? error.message : "جرب تاني بعد شوية"
      toast.error("لسه مش متاح تكتب تقييم", { description: message })
    } else if (data) {
      const nextReviews = existingReview
        ? reviews.map((review) => review.id === data.id ? data : review)
        : [data, ...reviews]

      setReviews(nextReviews)
      setReviewStats(calcReviewStats(nextReviews))
      setShowReviewForm(false)
      setCanReview(true)
      setAlreadyReviewed(true)
      setExistingReview(data)
      setReviewComment(data.comment || "")
      setReviewImages(data.images || [])
      setReviewRating(data.rating)
      toast.success(
        existingReview ? "عدّلنا تقييمك بنجاح ✨" : "شكراً على تقييمك! 🎉",
        { description: existingReview ? "تعديلك وصل وبيساعدنا نفضل نطور التجربة للأحسن." : "رأيك مهم لينا وهيساعدنا نحسن التجربة لكل الناس" }
      )
    }
    setIsSubmitting(false)
  }

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (reviewImages.length >= 3) {
      toast.error("أقصى عدد صور هو 3")
      return
    }
    setIsUploading(true)
    const url = await uploadReviewImage(file)
    if (url) {
      setReviewImages(prev => [...prev, url])
    } else {
      toast.error("فشل رفع الصورة")
    }
    setIsUploading(false)
  }


  const product = dbProduct ? (() => {
    const metadata = getProductCatalogMetadata(dbProduct.specifications)
    const isRestaurantItem = metadata.restaurantItem
    const isRestaurantAvailable = metadata.restaurantAvailable !== false
    let price = selectedRestaurantSize ? resolveVariantUnitPrice(dbProduct, selectedVariantJson) : dbProduct.price;
    let oldPrice: number | undefined = metadata.oldPrice && metadata.oldPrice > price ? metadata.oldPrice : undefined;
    let discountAmount = dbProduct.specifications?.discount_badge || undefined;

    if (dbProduct.discount_percentage && dbProduct.discount_percentage > 0 && selectedRestaurantSize) {
      oldPrice = Math.round((selectedRestaurantSize.price / (1 - dbProduct.discount_percentage / 100)) * 100) / 100;
      discountAmount = `وفر ${formatNumberLatin(Math.max(0, Math.round(oldPrice - selectedRestaurantSize.price)))} ج.م`;
    } else if (dbProduct.discount_percentage && dbProduct.discount_percentage > 0) {
      price = Math.round(dbProduct.price * (1 - dbProduct.discount_percentage / 100));
      oldPrice = dbProduct.price;
      discountAmount = `وفر ${dbProduct.price - price} ج.م`;
    }

    const bundleItems = getBundleItems(dbProduct.specifications)
    const productMode = getProductMode(dbProduct.specifications)
    const taxonomySelection = getTaxonomySelection(dbProduct.specifications)
    const taxonomyLabel = getTaxonomyLabel(dbProduct.categories?.name, taxonomySelection.primary, taxonomySelection.secondary)

    return {
      title: dbProduct.name,
      price,
      oldPrice,
      discountAmount,
      isBestSeller: !!dbProduct.is_best_seller,
      rating: dbProduct.specifications?.rating || 4.9,
      reviewsCount: dbProduct.specifications?.reviews_count || 120,
      stock: isRestaurantItem
        ? (isRestaurantAvailable ? "متاح الآن" : "غير متوفر حاليًا")
        : (dbProduct.stock_quantity ? `متوفر ${dbProduct.stock_quantity} قطعة` : (dbProduct.specifications?.stock || "متوفر")),
      stockQty: isRestaurantItem ? null : (dbProduct.stock_quantity ?? null),
      description: dbProduct.description || "لا يوجد وصف متاح لهذا المنتج حالياً.",
      shortDescription: metadata.shortDescription,
      specs: normalizedSpecs.length > 0
        ? normalizedSpecs
        : [
          { label: "النوع", value: dbProduct.categories?.name || metadata.productType || "عام" },
        ],
      features: dbProduct.specifications?.features || [
        "جودة عالية ومضمونة",
        "توصيل سريع",
        "دفع عند الاستلام",
      ],
      productMode,
      bundleItems,
      bundleSummary: getBundleSummary(bundleItems),
      taxonomyLabel,
      images: Array.from(
        new Set(
          [
            dbProduct.image_url,
            ...(dbProduct.images || []),
          ]
            .filter(Boolean)
            .map((image) => String(image).trim())
            .filter(Boolean)
        )
      ),
      category_name: dbProduct.categories?.name || "منتجات",
      brand: metadata.brand,
      sku: metadata.sku,
      isRestaurantItem,
      isRestaurantAvailable,
      restaurantSizeOptions,
    };
  })() : {
    title: "سماعة بلوتوث لاسلكية عازلة للضوضاء",
    price: 450,
    oldPrice: 600,
    discountAmount: "وفر 150 ج.م",
    isBestSeller: false,
    rating: 4.9,
    reviewsCount: 312,
    stock: "متوفر 15 قطعة فقط",
    stockQty: null,
    description: "استمتع بتجربة صوتية لا مثيل لها مع سماعة البلوتوث اللاسلكية الجديدة. تصميم مريح للأذن، بطارية تدوم حتى 24 ساعة، وعزل تام للضوضاء الخارجية عشان تفصل براحتك.",
    shortDescription: "",
    specs: [
      { label: "الماركة", value: "SoundMax" },
      { label: "عمر البطارية", value: "24 ساعة" },
      { label: "الاتصال", value: "بلوتوث 5.2" },
      { label: "الضمان", value: "سنة واحدة" },
    ],
    features: [
      "صوت نقي وبيز قوي",
      "ميكروفون مزود بتقنية عزل الضوضاء",
      "تحكم باللمس",
      "مقاومة لرذاذ الماء والتعرق",
    ],
    productMode: "single",
    bundleItems: [],
    bundleSummary: "",
    taxonomyLabel: { primary: "", secondary: "", tertiary: "" },
    images: [
      "https://th.bing.com/th/id/OIG3.C_W_T_P_j_B_k_O_d_J_?pid=ImgGn",
      "https://th.bing.com/th/id/OIG2.u.R6D_r_N7J7L0_W0_x_?pid=ImgGn",
      "https://th.bing.com/th/id/OIG1.3T.W.G_A_u2z4O6.7Z1Y?pid=ImgGn",
    ],
    category_name: "إلكترونيات",
    brand: "",
    sku: "",
    isRestaurantItem: false,
    isRestaurantAvailable: true,
    restaurantSizeOptions: [],
  }

  const comparePriceToShow =
    appliedDiscountPrice !== null
      ? product.price
      : (typeof product.oldPrice === "number" && product.oldPrice > product.price ? product.oldPrice : null)

  const effectiveUnitPrice = appliedDiscountPrice !== null ? appliedDiscountPrice : product.price
  const liveTotalPrice = effectiveUnitPrice * quantity
  const liveComparePrice = comparePriceToShow !== null ? comparePriceToShow * quantity : null
  const formatPrice = React.useCallback((value: number) => formatNumberLatin(value), [])

  const [activeImage, setActiveImage] = React.useState(0)

  const trustHighlights = React.useMemo(() => {
    const items: string[] = [
      "مصاريف الشحن واضحة قبل التأكيد",
      "دفع كاش وقت الاستلام",
    ]

    if (reviewStats.totalReviews > 0) {
      items.push(`عليه ${reviewStats.totalReviews} تقييم من العملاء`)
    }

    if (product.isBestSeller) {
      items.push("من الأكثر طلبًا في القسم")
    }

    if (!product.isRestaurantItem && (product.stockQty ?? 0) > 0 && (product.stockQty ?? 0) <= 5) {
      items.push(`متبقي ${product.stockQty} قطع فقط`)
    }
    return items.slice(0, 4)
  }, [product.isBestSeller, product.stockQty, reviewStats.totalReviews])

  const shareTitle = React.useMemo(() => `شوف ${dbProduct?.name || "المنتج ده"} على في السكة`, [dbProduct?.name])
  const shareMessage = React.useMemo(
    () => `المنتج ده عاجبني على في السكة 👇\n${dbProduct?.name || product.title}`,
    [dbProduct?.name, product.title]
  )

  const handleNativeShare = React.useCallback(async () => {
    if (!shareUrl) {
      toast.error("لسه الرابط مش جاهز")
      return
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareMessage,
          url: shareUrl,
        })
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          setIsShareSheetOpen(true)
        }
      }
      return
    }

    setIsShareSheetOpen(true)
  }, [shareMessage, shareTitle, shareUrl])

  const shareTargets = React.useMemo(() => {
    if (!shareUrl) return []

    const encodedUrl = encodeURIComponent(shareUrl)
    const encodedText = encodeURIComponent(`${shareMessage}\n${shareUrl}`)
    const encodedTitle = encodeURIComponent(shareTitle)

    return [
      {
        label: "واتساب",
        icon: WhatsAppIcon,
        iconClassName: "text-[#25D366]",
        helper: "شاركها على واتساب",
        action: () => openShareUrl(`https://wa.me/?text=${encodedText}`),
      },
      {
        label: "فيسبوك",
        icon: FacebookIcon,
        iconClassName: "text-[#1877F2]",
        helper: "انشرها على فيسبوك",
        action: () => openShareUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`),
      },
      {
        label: "X / تويتر",
        icon: XIcon,
        iconClassName: "text-white",
        helper: "شاركها على X",
        action: () => openShareUrl(`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`),
      },
      {
        label: "تيليجرام",
        icon: TelegramIcon,
        iconClassName: "text-[#229ED9]",
        helper: "ابعتها على تيليجرام",
        action: () => openShareUrl(`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`),
      },
      {
        label: "إنستجرام",
        icon: InstagramIcon,
        iconClassName: "text-[#E4405F]",
        helper: "هننسخ الرابط وانت شاركه هناك",
        action: () => copyShareLink("إنستجرام"),
      },
      {
        label: "تيك توك",
        icon: TikTokIcon,
        iconClassName: "text-white",
        helper: "هننسخ الرابط وانت شاركه هناك",
        action: () => copyShareLink("تيك توك"),
      },
    ]
  }, [copyShareLink, openShareUrl, shareMessage, shareTitle, shareUrl])

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="flex-1 pb-24 md:pb-8 bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            {/* Breadcrumb skeleton */}
            <div className="flex gap-2 items-center mb-6">
              <div className="h-4 w-16 rounded-full bg-surface-hover relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
              <div className="h-4 w-4 rounded-full bg-surface-hover" />
              <div className="h-4 w-24 rounded-full bg-surface-hover relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-14">
              {/* Image gallery skeleton */}
              <div className="flex flex-col gap-3">
                <div className="aspect-square w-full rounded-3xl bg-surface-hover relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
                <div className="flex gap-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-20 flex-1 rounded-2xl bg-surface-hover relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
                  ))}
                </div>
              </div>

              {/* Product details skeleton */}
              <div className="flex flex-col gap-4">
                <div className="h-5 w-24 rounded-full bg-surface-hover relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
                <div className="h-8 w-3/4 rounded-xl bg-surface-hover relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
                <div className="h-8 w-1/2 rounded-xl bg-surface-hover relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
                <div className="h-12 w-40 rounded-2xl bg-surface-hover relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent mt-2" />
                <div className="h-px w-full bg-surface-hover my-2" />
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full bg-surface-hover relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
                    <div className={`h-4 rounded-lg bg-surface-hover relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent ${i % 2 === 0 ? 'w-48' : 'w-36'}`} />
                  </div>
                ))}
                <div className="flex gap-3 mt-4">
                  <div className="h-14 flex-1 rounded-2xl bg-surface-hover relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
                  <div className="h-14 w-14 rounded-2xl bg-surface-hover relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />

      <main className="flex-1 pb-24 md:pb-8 bg-background">

        {/* Breadcrumbs */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <nav className="flex text-sm text-gray-500" aria-label="Breadcrumb">
            <ol className="inline-flex items-center gap-1 rtl:space-x-reverse">
              <li><Link href="/" className="hover:text-foreground">الرئيسية</Link></li>
              <li className="text-gray-400 dark:text-gray-600">/</li>
              <li><Link href="/categories" className="hover:text-foreground">{product.category_name}</Link></li>
              <li className="text-gray-400 dark:text-gray-600"><ChevronRight className="w-3 h-3" /></li>
              <li className="text-gray-500 line-clamp-1 max-w-[180px]">{product.title}</li>
            </ol>
          </nav>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

            {/* ── Image Gallery ──────────────────────────────────────────── */}
            <div className="lg:col-span-6 flex flex-col gap-4">

              {/* Main image */}
              <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full rounded-3xl bg-surface border border-surface-hover overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none z-10" />
                <img
                  src={product.images[activeImage]}
                  className="object-cover w-full h-full transform transition-transform duration-700 group-hover:scale-105"
                  alt={product.title}
                />
              </div>

              {/* Thumbnails */}
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
                {product.images.map((img: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`snap-start relative aspect-[4/3] w-[28vw] min-w-[80px] sm:w-28 shrink-0 rounded-2xl overflow-hidden border-2 transition-all duration-300 ${activeImage === idx
                      ? "border-primary ring-2 ring-primary/20 shadow-md"
                      : "border-surface-hover hover:border-gray-500 scale-95 opacity-70 hover:opacity-100"
                      }`}
                  >
                    <img src={img} className="object-cover w-full h-full" alt="" />
                  </button>
                ))}
              </div>

            </div>

            {/* ── Product Info ────────────────────────────────────────────── */}
            <div className="lg:col-span-6 flex flex-col">

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {product.discountAmount && (
                  <Badge className="border border-rose-700/20 bg-rose-600 text-white font-black px-3 py-1 shadow-[var(--shadow-material-2)] hover:bg-rose-700 dark:border-rose-500/30 dark:bg-rose-500">
                    {product.discountAmount}
                  </Badge>
                )}
                {product.productMode === "bundle" && (
                  <Badge className="border border-emerald-700/20 bg-emerald-600 text-white font-black px-3 py-1 shadow-[var(--shadow-material-2)] hover:bg-emerald-700 dark:border-primary/30 dark:bg-primary">
                    باكج جاهزة
                  </Badge>
                )}
                
                {/* Dynamic Rating Badge -> Scrolls to reviews */}
                <a 
                  href="#reviews" 
                  className="flex items-center gap-1.5 text-xs text-yellow-500 bg-surface border border-surface-hover px-3 py-1.5 rounded-full font-bold hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <Star className="w-4 h-4 fill-current" />
                  <span>{reviewsLoading ? '...' : reviewStats.averageRating || 'جديد'}</span>
                  {!reviewsLoading && reviewStats.totalReviews > 0 && (
                    <span className="text-gray-500 font-medium">({reviewStats.totalReviews} تقييم)</span>
                  )}
                </a>
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-heading font-black text-foreground mb-6 leading-[1.3]">
                {product.title}
              </h1>

              {product.shortDescription && (
                <p className="mb-5 max-w-2xl text-sm leading-7 text-gray-400 md:text-base">
                  {product.shortDescription}
                </p>
              )}

              {activeGroupOrderCode && (
                <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-black text-primary">
                  أنت تضيف الآن إلى طلب جماعي، وكل إضافة هنا هتروح لنفس الرابط اللي شاركته مع أصحابك.
                </div>
              )}

              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-surface-hover bg-surface/55 p-4">
                  <div className="mb-2 inline-flex rounded-xl bg-primary/10 p-2 text-primary">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-black text-foreground">التوصيل الحالي</p>
                  <p className="mt-1 text-xs leading-6 text-gray-500">بنوصّل حاليًا داخل قرية ميت العامل فقط، وقريبًا القرى المجاورة.</p>
                </div>
                <div className="rounded-2xl border border-surface-hover bg-surface/55 p-4">
                  <div className="mb-2 inline-flex rounded-xl bg-emerald-500/10 p-2 text-emerald-500">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-black text-foreground">الشحن والدفع</p>
                  <p className="mt-1 text-xs leading-6 text-gray-500">الشحن الحالي {CURRENT_DELIVERY_FEE} ج.م، والدفع كاش وقت الاستلام.</p>
                </div>
              </div>

              {product.productMode === "bundle" && (
                <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-black text-primary mb-1">الباكج دي متجهزة علشان تاخد كذا حاجة مرة واحدة</p>
                  <p className="text-xs text-gray-400">
                    {product.bundleSummary
                      ? `جواها: ${product.bundleSummary}`
                      : `الباكج فيها ${product.bundleItems.length} منتجات متجمعة لك في منتج واحد`}
                  </p>
                </div>
              )}

              {product.taxonomyLabel.primary && (
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-surface-hover px-3 py-1 text-xs font-black text-gray-300">
                    {product.taxonomyLabel.primary}
                  </span>
                  {product.taxonomyLabel.secondary && (
                    <span className="inline-flex items-center rounded-full bg-surface-hover px-3 py-1 text-xs font-black text-gray-400">
                      {product.taxonomyLabel.secondary}
                    </span>
                  )}
                  {product.taxonomyLabel.tertiary && (
                    <span className="inline-flex items-center rounded-full bg-surface-hover px-3 py-1 text-xs font-black text-gray-400">
                      {product.taxonomyLabel.tertiary}
                    </span>
                  )}
                  {product.brand && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                      {product.brand}
                    </span>
                  )}
                  {product.sku && (
                    <span className="inline-flex items-center rounded-full bg-surface-hover px-3 py-1 text-xs font-bold text-gray-500">
                      SKU: {product.sku}
                    </span>
                  )}
                </div>
              )}

              {product.restaurantSizeOptions.length > 0 && (
                <div className="mb-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-foreground">اختار الحجم</p>
                    <p className="text-xs text-gray-500">السعر بيتغير تلقائي حسب الحجم اللي تختاره</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {product.restaurantSizeOptions.map((option) => {
                      const isActive = selectedRestaurantSize?.id === option.id
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedRestaurantSizeId(option.id)}
                          className={[
                            "rounded-2xl border px-4 py-3 text-right transition-all",
                            isActive
                              ? "border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]"
                              : "border-surface-hover bg-surface hover:border-primary/40",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-black text-foreground">{option.label}</span>
                            <span className="text-sm font-black text-primary">{formatPrice(option.price)} ج.م</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Price block */}
              <div className="flex items-end gap-3 mb-6 p-5 rounded-2xl bg-surface-light border border-surface-hover shadow-sm">
                <div className="flex flex-col">
                  <span className="text-gray-500 text-sm font-medium mb-1">
                    {quantity > 1 ? `إجمالي ${quantity} قطع` : "السعر الحالي"}
                  </span>
                  <span className="font-heading text-4xl font-black text-primary tracking-tight">
                    {formatPrice(liveTotalPrice)} <span className="text-lg font-bold">ج.م</span>
                  </span>
                  {quantity > 1 && (
                    <span className="mt-1 text-xs font-bold text-gray-500">
                      سعر القطعة {formatPrice(effectiveUnitPrice)} ج.م
                    </span>
                  )}
                </div>
                {liveComparePrice !== null && (
                  <span className="font-heading text-lg text-gray-500 line-through mb-1">
                    {formatPrice(liveComparePrice)} ج.م
                  </span>
                )}
              </div>

              {/* Discount Code Input */}
              {product.price > 0 && (
                <DiscountCodeInput
                  originalPrice={product.price}
                  productId={dbProduct?.id}
                  categoryId={dbProduct?.category_id}
                  userId={user?.id}
                  onDiscountApplied={(finalPrice, savedAmount, label) => {
                    setAppliedDiscountPrice(finalPrice);
                    setAppliedDiscountLabel(label);
                  }}
                  onDiscountRemoved={() => {
                    setAppliedDiscountPrice(null);
                    setAppliedDiscountLabel(null);
                  }}
                />
              )}

              {/* Stock indicator */}
              {(() => {
                const qty = product.stockQty
                const isRestaurantUnavailable = product.isRestaurantItem && !product.isRestaurantAvailable
                const isOutOfStock = qty !== null && qty <= 0
                const isLowStock = !product.isRestaurantItem && qty !== null && qty > 0 && qty <= 5

                if (isRestaurantUnavailable || isOutOfStock) {
                  return (
                    <div className="mb-6 flex items-center gap-2 text-sm font-medium">
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                      <span className="text-rose-500 font-bold">
                        {product.isRestaurantItem ? "غير متوفر حاليًا من المطعم" : "غير متوفر حالياً — نفذت الكمية"}
                      </span>
                    </div>
                  )
                }
                if (isLowStock) {
                  return (
                    <div className="mb-6 flex items-center gap-2 text-sm font-medium">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                      </div>
                      <span className="text-amber-500 font-bold">باقي {qty} قطع فقط — اطلب قبل ما تنتهي!</span>
                    </div>
                  )
                }
                return (
                  <div className="mb-6 flex items-center gap-2 text-sm font-medium">
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </div>
                    <span className="text-emerald-500">{product.stock}</span>
                  </div>
                )
              })()}

              <div className="mb-7 flex flex-wrap items-center gap-2">
                {product.isBestSeller ? (
                  <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-black text-amber-400">
                    الأكثر طلبًا في القسم
                  </span>
                ) : null}
                {!product.isRestaurantItem && (product.stockQty ?? 0) > 0 && (product.stockQty ?? 0) <= 5 ? (
                  <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-black text-rose-400">
                    متبقي عدد قليل
                  </span>
                ) : null}
              </div>

              {/* ══ DESKTOP CTA CONTAINER ══════════════════════════════════
                   Soft green border wraps the purchase area for visibility.
                   Buttons are left EXACTLY AS-IS (colors, shapes, sizes).
                   ════════════════════════════════════════════════════════ */}
              <div
                className="hidden md:block mb-10"
                style={{
                  opacity: isMounted ? 1 : 0,
                  transform: isMounted ? "translateY(0)" : "translateY(16px)",
                  transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
                }}
              >
                {/* Outer glow / border ring */}
                <div className="relative rounded-3xl p-[2px] bg-gradient-to-br from-primary/50 via-emerald-400/10 to-transparent shadow-[0_4px_32px_rgba(16,185,129,0.12)]">
                  {/* Inner container */}
                  <div className="relative rounded-[calc(1.5rem-2px)] bg-surface/95 px-5 pt-5 pb-4 overflow-hidden">

                    {/* Faint ambient glow in background */}
                    <div className="absolute -top-12 -start-12 w-40 h-40 bg-primary/8 blur-3xl rounded-full pointer-events-none" />

                    {/* Section label */}
                    <p className="text-xs font-bold text-primary/80 uppercase tracking-widest mb-4">
                      أضف إلى طلبك
                    </p>

                    {/* Quantity row */}
                    <div className="flex items-center justify-between mb-5 px-0.5">
                      <span className="text-sm font-bold text-gray-500">الكمية</span>
                      <div className="flex items-center rounded-2xl border border-surface-hover bg-background h-12 shadow-inner">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="px-5 h-full text-gray-500 hover:text-foreground hover:bg-surface-hover rounded-e-2xl active:scale-90 transition-all"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center font-heading font-black text-xl select-none">{quantity}</span>
                        <button
                          onClick={() => setQuantity(quantity + 1)}
                          className="px-5 h-full text-gray-500 hover:text-foreground hover:bg-surface-hover rounded-s-2xl active:scale-90 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-primary/10 mb-4" />

                    {/* Add to Cart button — unchanged */}
                    <div className="mb-3">
                      <Button
                        size="lg"
                        className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95 gap-2"
                        onClick={handleAddToCart}
                      >
                        {isAdded ? <Check className="w-6 h-6" /> : <ShoppingCart className="w-6 h-6" />}
                        <span>{isAdded ? "تمت الإضافة بنجاح ✔" : "أضف للسلة"}</span>
                      </Button>
                    </div>

                    {/* Buy Now button */}
                    <button
                      disabled={product.isRestaurantItem && !product.isRestaurantAvailable}
                      className={[
                        "w-full h-14 rounded-2xl text-xl font-black text-white shadow-xl transition-all inline-flex items-center justify-center",
                        product.isRestaurantItem && !product.isRestaurantAvailable
                          ? "cursor-not-allowed bg-blue-600/45 opacity-60 shadow-blue-600/10"
                          : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 hover:shadow-blue-600/40 active:scale-95",
                      ].join(" ")}
                      onClick={handleBuyNow}
                    >
                      {product.isRestaurantItem && !product.isRestaurantAvailable ? "غير متاح الآن" : "اخلص واشتري دلوقتي"}
                    </button>

                    <div className="mt-3 flex items-center gap-3">
                      {!activeGroupOrderCode && (
                        <button
                          type="button"
                          onClick={handleCreateGroupOrder}
                          className="h-11 rounded-2xl border border-primary/20 bg-primary/5 px-4 text-sm font-bold text-primary inline-flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
                        >
                          <Users className="w-4.5 h-4.5" />
                          طلب جماعي
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsShareSheetOpen(true)}
                        className="h-11 w-11 shrink-0 rounded-2xl border border-primary/20 bg-primary/5 text-primary inline-flex items-center justify-center hover:bg-primary/10 transition-colors"
                        aria-label="شارك المنتج"
                      >
                        <Share2 className="w-4.5 h-4.5" />
                      </button>
                    </div>

                    {/* Trust note */}
                    <p className="mt-4 text-center text-xs text-gray-500 flex items-center justify-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      دفع كاش عند الاستلام &bull; مفيش بيانات بنكية مطلوبة
                    </p>

                  </div>
                </div>
              </div>

              {/* Trust badges */}
              <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-surface/50 border border-surface-hover hover:border-emerald-500/30 transition-colors">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-heading font-bold text-sm text-foreground mb-1">الدفع كاش عند الاستلام</p>
                    <p className="text-xs text-gray-500 leading-relaxed">عاين المنتج براحتك قبل ما تدفع أي حاجة</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-surface/50 border border-surface-hover hover:border-primary/30 transition-colors">
                  <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-heading font-bold text-sm text-foreground mb-1">توصيل سريع ومضمون</p>
                    <p className="text-xs text-gray-500 leading-relaxed">هنعرفك مصاريف الشحن بالضبط قبل التأكيد</p>
                  </div>
                </div>
              </div>

              <div className="mb-8 rounded-3xl border border-surface-hover bg-surface/40 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-sm font-black text-foreground">ليه تكمّل الطلب من هنا؟</p>
                    <p className="mt-2 text-sm leading-7 text-gray-500">
                      وضحنا لك التوصيل الحالي والشحن والدفع من بدري، علشان تبقى عارف كل حاجة قبل ما تكمل. ولو المنتج مش مناسبك، هتلاقي منتجات مشابهة في نفس الصفحة.
                    </p>
                  </div>
                  <div className="grid min-w-[240px] gap-2 text-xs text-gray-400">
                    {trustHighlights.map((item) => (
                      <div key={item} className="inline-flex items-center gap-2 rounded-2xl border border-surface-hover bg-surface px-3 py-2">
                        <Check className="h-4 w-4 text-primary" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Description & Specs */}
              <div className="space-y-8">
                <section>
                  <h3 className="text-xl font-bold mb-3 pb-2 border-b border-surface-hover">عن المنتج</h3>
                  <p className="text-gray-500 leading-relaxed text-sm md:text-base">{product.description}</p>
                  <ul className="mt-4 space-y-2">
                    {product.features.map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-foreground">
                        <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </section>

                {product.productMode === "bundle" && product.bundleItems.length > 0 && (
                  <section>
                    <h3 className="text-xl font-bold mb-3 pb-2 border-b border-surface-hover">جوه الباكج إيه؟</h3>
                    <div className="rounded-2xl border border-primary/15 bg-surface/70 p-4 space-y-3">
                      {product.bundleItems.map((item: any, idx: number) => (
                        <div key={`${item.name}-${idx}`} className="flex items-start justify-between gap-3 rounded-xl bg-surface px-4 py-3 border border-surface-hover">
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-white">{item.name}</p>
                            {item.note ? <p className="text-xs text-gray-400">{item.note}</p> : null}
                          </div>
                          <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black text-primary">
                            {item.quantity || "ضمن الباكج"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="text-xl font-bold mb-3 pb-2 border-b border-surface-hover">المواصفات</h3>
                  <div className="rounded-xl overflow-hidden border border-surface-hover divide-y divide-surface-hover">
                    {product.specs.map((spec: any, idx: number) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center bg-surface px-4 py-3">
                        <span className="w-1/3 text-gray-500 text-sm">{spec.label}</span>
                        <span className="text-foreground text-sm font-medium mt-1 sm:mt-0">{spec.value || spec.description}</span>
                      </div>
                    ))}
                  </div>
                </section>

              </div>
              </div>
            </div>

            {relatedProducts.length > 0 && (
              <section className="mt-14 w-full border-t border-surface-hover pt-10">
                <div className="mb-6 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-black text-foreground">منتجات مشابهة</h3>
                    <p className="mt-1 text-sm text-gray-500">اختيارات قريبة من نفس النوع علشان تلاقي بديل أو تكمل طلبك بحاجة أنسب.</p>
                  </div>
                  {dbProduct?.category_id ? (
                    <Link href={`/category/${dbProduct.category_id}`} className="hidden md:inline-flex text-sm font-bold text-primary hover:text-primary/80">
                      شوف القسم كله
                    </Link>
                  ) : null}
                </div>

                <div className="hidden sm:grid grid-cols-2 gap-6 lg:grid-cols-4">
                  {relatedProducts.slice(0, 8).map((relatedProduct) => (
                    <ProductCard
                      key={relatedProduct.id}
                      {...toProductCardProps(relatedProduct)}
                    />
                  ))}
                </div>

                <div className="sm:hidden -mx-1 overflow-x-auto pb-2 no-scrollbar">
                  <div className="flex gap-4 px-1 snap-x snap-mandatory">
                    {relatedProducts.slice(0, 8).map((relatedProduct) => (
                      <div key={relatedProduct.id} className="snap-start min-w-[46vw] max-w-[46vw]">
                        <ProductCard {...toProductCardProps(relatedProduct)} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ── Reviews Section ────────────────────────────────────────── */}
            <div className="mt-16 pt-10 border-t border-surface-hover w-full" id="reviews">
              <div className="flex items-center gap-3 mb-8">
                <h3 className="text-2xl font-black text-foreground">تقييمات العملاء</h3>
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>

              {reviewsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                  
                  {/* Stats Column - Now on the Right (lg:col-span-4) visually left in RTL */}
                  <div className="lg:col-span-4 flex flex-col gap-4 order-1">
                    <div className="bg-[#11161d] rounded-[2rem] p-8 border border-surface-hover shadow-sm">
                      <div className="text-center mb-8">
                        <span className="font-heading text-6xl font-black text-white block mb-4 leading-none">{reviewStats.averageRating}</span>
                        <div className="flex justify-center gap-1 mb-3">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Star key={star} className={`w-6 h-6 ${star <= Math.round(reviewStats.averageRating) ? 'fill-[#ffc107] text-[#ffc107]' : 'fill-gray-200 text-gray-200 dark:fill-gray-800 dark:text-gray-800'}`} />
                          ))}
                        </div>
                        <p className="text-sm text-gray-500">بناءً على {reviewStats.totalReviews} تقييم</p>
                      </div>

                      <div className="space-y-4">
                        {[5, 4, 3, 2, 1].map(stars => {
                          const count = reviewStats.distribution[stars] || 0
                          const percentage = reviewStats.totalReviews > 0 ? (count / reviewStats.totalReviews) * 100 : 0
                          return (
                            <div key={stars} className="flex items-center gap-4">
                              <div className="flex items-center gap-1 w-8 shrink-0 text-sm font-bold text-gray-400 justify-end">
                                <span>{stars}</span>
                              </div>
                              <div className="flex-1 h-3 bg-[#1e2532] rounded-full overflow-hidden relative">
                                <div className="absolute top-0 bottom-0 left-0 bg-[#ffc107] rounded-full" style={{ width: `${percentage}%` }} />
                              </div>
                              <span className="flex items-center gap-1 text-xs text-gray-500 w-8 shrink-0">
                                <Star className="w-3.5 h-3.5 fill-[#ffc107] text-[#ffc107]" />
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {canReview && !showReviewForm && (
                      <div className={`rounded-[2rem] p-6 border flex flex-col gap-4 items-center ${alreadyReviewed ? 'bg-[#0a2318] border-[#10b981]/20' : 'bg-[#11161d] border-surface-hover'}`}>
                        {alreadyReviewed ? (
                          <div className="w-full flex items-center gap-4 rounded-2xl bg-[#10b981]/5 border border-[#10b981]/10 px-4 py-4">
                            <div className="w-12 h-12 rounded-full bg-[#10b981]/10 flex items-center justify-center text-[#10b981] shrink-0">
                              <Check className="w-6 h-6" />
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-[#10b981] text-base mb-1">أنت قيّمت المنتج قبل كده</p>
                              <p className="text-sm text-[#10b981]/80">
                                لو حابب تغيّر رأيك أو تزود صور جديدة، عدّل تقييمك من هنا.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="w-full text-sm text-gray-400 text-center leading-relaxed">
                            جرّبت المنتج؟ شاركنا رأيك الحقيقي وساعد الناس تاخد قرار أريح.
                          </p>
                        )}

                        <Button
                          onClick={openReviewForm}
                          className="w-full h-14 rounded-2xl font-bold bg-[#10b981] text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 text-base"
                        >
                          {alreadyReviewed ? "تعديل تقييمك" : "اكتب تقييمك للمنتج"}
                        </Button>
                      </div>
                    )}

                    {!user && (
                      <div className="bg-[#11161d] rounded-[2rem] p-6 text-center border border-surface-hover">
                        <p className="text-sm text-gray-400 mb-4">سجل دخول عشان تقدر تكتب تقييم</p>
                        <Button asChild variant="outline" className="w-full h-12 rounded-xl border-surface-hover text-white hover:bg-surface-hover">
                          <Link href="/login">تسجيل الدخول</Link>
                        </Button>
                      </div>
                    )}
                  </div>

                    {/* Reviews List & Form Column - Now on the left (lg:col-span-8) visually right in RTL to take more space */}
                    <div className="lg:col-span-8 flex flex-col gap-6 order-2">
                      
                      {/* Review Form */}
                      {showReviewForm && (
                        <div className="bg-[#11161d] rounded-3xl p-6 border border-primary/30 shadow-[0_0_20px_rgba(16,185,129,0.1)] relative origin-top animate-in fade-in zoom-in-95 duration-200">
                          <button 
                            type="button"
                            onClick={() => setShowReviewForm(false)}
                            className="absolute top-4 end-4 text-gray-400 hover:text-gray-600 p-1 bg-surface-hover rounded-full"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          
                          <h4 className="font-bold text-lg mb-4 text-foreground">
                            {alreadyReviewed ? "عدّل تقييمك للمنتج" : "تقييمك للمنتج"}
                          </h4>
                          
                          {/* Star picker */}
                          <div className="flex gap-2 mb-6">
                            {[1, 2, 3, 4, 5].map(star => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setReviewRating(star)}
                                className="focus:outline-none transition-transform hover:scale-110 active:scale-90"
                              >
                                <Star className={`w-8 h-8 ${star <= reviewRating ? 'fill-[#ffc107] text-[#ffc107]' : 'fill-gray-200 text-gray-200 dark:fill-gray-800 dark:text-gray-800'}`} />
                              </button>
                            ))}
                          </div>

                          {/* Comment box */}
                          <textarea
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="شاركنا رأيك في المنتج بصراحة (اختياري بس بيفرق معانا جداً)..."
                            className="w-full min-h-[120px] resize-y rounded-2xl border border-surface-hover bg-[#0a0d14] p-4 text-sm text-white placeholder:text-gray-400 caret-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-4"
                          />

                          {/* Image uploads */}
                          <div className="mb-6">
                            <p className="text-xs font-bold text-gray-500 mb-2">أضف صور للمنتج من تصويرك (اختياري - متاح 3 صور)</p>
                            <div className="flex gap-3 flex-wrap">
                              {reviewImages.map((url, idx) => (
                                <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-surface-hover group">
                                  <img src={url} alt="Review" className="w-full h-full object-cover" />
                                  <button
                                    onClick={() => setReviewImages(prev => prev.filter((_, i) => i !== idx))}
                                    className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                              ))}
                              
                              {reviewImages.length < 3 && (
                                <label className={`flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-surface-hover hover:border-primary/50 text-gray-400 hover:text-primary transition-colors cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                  {isUploading ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
                                  ) : (
                                    <>
                                      <Camera className="w-6 h-6 mb-1" />
                                      <span className="text-[10px] font-bold">صورة</span>
                                    </>
                                  )}
                                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadImage} disabled={isUploading} />
                                </label>
                              )}
                            </div>
                          </div>

                          <Button 
                            onClick={handleSubmitReview} 
                            disabled={isSubmitting || isUploading}
                            className="w-full h-12 rounded-xl font-bold bg-primary text-white gap-2"
                          >
                            {isSubmitting ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                            ) : (
                              <>
                                <Send className="w-4 h-4 rtl:-scale-x-100" />
                                <span>{alreadyReviewed ? "حفظ التعديل" : "نشر التقييم"}</span>
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {/* List of reviews */}
                      {reviews.length === 0 ? (
                        <div className="bg-[#11161d] rounded-3xl p-10 text-center border border-surface-hover flex flex-col items-center justify-center h-full mt-8">
                          <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-4" />
                          <h4 className="font-bold text-lg text-foreground mb-1">مفيش تقييمات لسه</h4>
                          <p className="text-gray-500 text-sm">كن أول شخص يشارك رأيه في المنتج ده!</p>
                        </div>
                      ) : (
                        <div className="space-y-4 w-full mt-8">
                          {reviews.map((review) => (
                            <div key={review.id} className="bg-[#11161d] rounded-3xl p-6 border border-surface-hover transition-all w-full">
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-3">
                                    <span className="font-bold text-base text-white">{review.user_name || 'مستخدم'}</span>
                                    <span className="flex items-center gap-1 bg-[#0a2318] text-[#10b981] text-xs font-bold px-2 py-1 rounded-md">
                                      <Check className="w-3.5 h-3.5" />
                                      مشترى مؤكد
                                    </span>
                                  </div>
                                  <div className="flex gap-1 pl-1 text-[11px] text-gray-400 font-medium whitespace-nowrap">
                                    {new Date(review.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  {[1, 2, 3, 4, 5].map(star => (
                                    <Star key={star} className={`w-4 h-4 ${star <= review.rating ? 'fill-[#ffc107] text-[#ffc107]' : 'fill-gray-200 text-gray-200 dark:fill-gray-800 dark:text-gray-800'}`} />
                                  ))}
                                </div>
                              </div>
                              
                              {review.comment && (
                                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line mt-2 text-right">
                                  {review.comment}
                                </p>
                              )}

                              {review.images && review.images.length > 0 && (
                                <div className="flex gap-2 mt-4">
                                  {review.images.map((img, idx) => (
                                    <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-xl overflow-hidden border border-surface-hover hover:opacity-80 transition-opacity">
                                      <img src={img} alt="صورة التقييم" className="w-full h-full object-cover" loading="lazy" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
      </main>

      {/* ── MOBILE STICKY PURCHASE BAR ──────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          opacity: isMounted ? 1 : 0,
          transform: isMounted ? "translateY(0)" : "translateY(100%)",
          transition: "opacity 0.5s ease-out, transform 0.5s ease-out",
        }}
      >
        {/* Gradient depth */}
        <div className="h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        <div className="bg-background backdrop-blur-2xl border-t border-surface-hover px-4 pt-3 pb-5 shadow-[0_-12px_40px_rgba(0,0,0,0.5)]">

          {/* Price + qty row */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  {quantity > 1 ? "الإجمالي الحالي" : "سعر الوحدة"}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-heading font-black text-primary text-2xl leading-none">
                    {formatPrice(liveTotalPrice)} <span className="text-sm font-bold">ج.م</span>
                  </span>
                  {liveComparePrice !== null && (
                    <span className="text-sm text-gray-500 line-through">{formatPrice(liveComparePrice)} ج.م</span>
                  )}
                </div>
                {quantity > 1 && (
                  <span className="text-[10px] text-gray-500 font-bold mt-0.5">
                    سعر القطعة {formatPrice(effectiveUnitPrice)} ج.م
                  </span>
                )}
                {appliedDiscountLabel && (
                  <span className="text-[10px] text-primary font-bold mt-0.5">✅ {appliedDiscountLabel}</span>
                )}
              </div>
            <div className="flex items-center rounded-2xl border border-surface-hover bg-surface h-11 shadow-inner">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 h-full text-gray-500 hover:text-foreground hover:bg-surface-hover rounded-e-2xl active:scale-90 transition-all">
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-9 text-center font-heading font-black text-lg select-none">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="px-4 h-full text-gray-500 hover:text-foreground hover:bg-surface-hover rounded-s-2xl active:scale-90 transition-all">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Action buttons */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleAddToCart}
                  className={[
                    "relative flex h-14 w-full rounded-2xl font-heading font-black text-base overflow-hidden transition-all duration-300 active:scale-[0.96] text-white",
                    isAdded
                      ? "bg-emerald-600 shadow-lg shadow-emerald-600/30"
                      : "bg-primary shadow-[0_6px_24px_rgba(16,185,129,0.4)]",
                  ].join(" ")}
                >
                  <span className="flex w-full items-center justify-center gap-2">
                    {isAdded ? <Check className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                    {isAdded ? "تمت الإضافة ✔" : "أضف للسلة"}
                  </span>
                </button>

                <button
                  disabled={product.isRestaurantItem && !product.isRestaurantAvailable}
                  onClick={handleBuyNow}
                  className={[
                    "h-14 w-full rounded-2xl font-heading font-black text-base text-white shadow-[0_6px_24px_rgba(59,130,246,0.35)] transition-all duration-300",
                    product.isRestaurantItem && !product.isRestaurantAvailable
                      ? "cursor-not-allowed bg-blue-600/45 opacity-60"
                      : "bg-blue-600 hover:bg-blue-700 active:scale-[0.96]",
                  ].join(" ")}
                >
                  {product.isRestaurantItem && !product.isRestaurantAvailable ? "غير متاح" : "اخلص واشتري دلوقتي"}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                {!activeGroupOrderCode ? (
                  <button
                    type="button"
                    onClick={handleCreateGroupOrder}
                    className="flex-1 h-10 rounded-2xl border border-primary/15 bg-primary/5 px-4 text-xs font-black text-primary inline-flex items-center justify-center gap-2 active:scale-[0.96] transition-all duration-300"
                  >
                    <Users className="w-4.5 h-4.5" />
                    طلب جماعي
                  </button>
                ) : (
                  <div className="flex-1 h-10 rounded-2xl border border-primary/15 bg-primary/5 px-4 text-xs font-black text-primary inline-flex items-center justify-center">
                    الطلب الجماعي شغال
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="h-10 w-10 shrink-0 rounded-2xl border border-primary/15 bg-primary/5 text-primary inline-flex items-center justify-center active:scale-[0.96] transition-all duration-300"
                  aria-label="شارك المنتج"
                >
                  <Share2 className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

        </div>
      </div>

      {isShareSheetOpen && (
        <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setIsShareSheetOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-[2rem] md:rounded-[2rem] border border-surface-hover bg-[#0b1016] p-5 md:p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <p className="text-sm font-bold text-primary mb-1">شارك المنتج وخلي ناس أكتر تشوفه ✨</p>
                <h3 className="text-xl font-black text-white leading-snug">لو المنتج عاجبك ابعته لحد ممكن يستفيد بيه</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShareSheetOpen(false)}
                className="w-10 h-10 rounded-2xl border border-surface-hover text-gray-400 hover:text-white hover:bg-surface transition-colors inline-flex items-center justify-center shrink-0"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 mb-4">
              <p className="text-white font-bold line-clamp-2">{product.title}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={handleNativeShare}
                className="col-span-2 h-12 rounded-2xl bg-primary text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-primary-hover transition-colors"
              >
                <Share2 className="w-5 h-5" />
                مشاركة سريعة
              </button>

              {shareTargets.map((target) => (
                <button
                  key={target.label}
                  type="button"
                  onClick={target.action}
                  className="rounded-2xl border border-surface-hover bg-surface px-4 py-3 text-start hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-center gap-2 text-white font-bold mb-1">
                    <target.icon className={`w-5 h-5 shrink-0 ${target.iconClassName}`} />
                    <span>{target.label}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{target.helper}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => copyShareLink()}
                className="flex-1 h-11 rounded-2xl border border-surface-hover bg-surface text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-surface-hover transition-colors"
              >
                <Copy className="w-4 h-4" />
                انسخ الرابط
              </button>
              <button
                type="button"
                onClick={() => setIsShareSheetOpen(false)}
                className="flex-1 h-11 rounded-2xl bg-white/5 text-gray-300 font-bold hover:bg-white/10 transition-colors"
              >
                تمام
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  )
}
