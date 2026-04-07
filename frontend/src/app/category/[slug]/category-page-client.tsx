"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ProductCard } from "@/components/ui/product-card"
import { RestaurantCard } from "@/components/ui/restaurant-card"
import { ProductCardSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import { Product } from "@/services/productsService"
import type { Restaurant } from "@/services/restaurantsService"
import { useProducts } from "@/contexts/ProductsContext"
import { isRequestOnlyTextCategory } from "@/lib/text-category-orders"
import { CategoryRequestPanel } from "@/components/categories/category-request-panel"
import { toProductCardProps } from "@/lib/product-presentation"
import type { Category } from "@/services/categoriesService"
import {
  getCategoryTaxonomyConfig,
  getTaxonomyLabel,
  getTaxonomyPrimaryOptions,
  getTaxonomySecondaryOptions,
  matchesProductTaxonomy,
} from "@/lib/category-taxonomy"

type CategoryPageClientProps = {
  initialCategory?: Category | null
  initialProducts?: Product[]
  initialHasMore?: boolean
  initialRestaurants?: Restaurant[]
  initialSearchQuery?: string
  listingMode?: "all" | "category" | "best-sellers"
  currentPage?: number
  totalPages?: number
  totalItems?: number
}

export default function CategoryPageClient({
  initialCategory = null,
  initialProducts = [],
  initialHasMore = false,
  initialRestaurants = [],
  initialSearchQuery = "",
  listingMode = "all",
  currentPage = 1,
  totalPages = 0,
  totalItems = 0,
}: CategoryPageClientProps) {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = typeof params.slug === "string" ? params.slug : "all"

  const [isFilterOpen, setIsFilterOpen] = React.useState(false)
  const { categories } = useProducts()

  const isAllPage = slug === "all"
  const isBestSellersView = isAllPage && listingMode === "best-sellers"

  const [allPageProducts, setAllPageProducts] = React.useState<Product[]>(isAllPage ? initialProducts : [])
  const [categoryProducts, setCategoryProducts] = React.useState<Product[]>(!isAllPage ? initialProducts : [])
  const [restaurants] = React.useState<Restaurant[]>(initialRestaurants)
  const isLoading = false

  React.useEffect(() => {
    if (isAllPage) {
      setAllPageProducts(initialProducts)
    } else {
      setCategoryProducts(initialProducts)
    }
  }, [initialProducts, isAllPage])

  const allProducts = isAllPage ? allPageProducts : categoryProducts
  const searchQuery = searchParams.get("q") || initialSearchQuery
  const activeGroupOrderCode = searchParams.get("groupOrder")
  const buildPageHref = React.useCallback((pageNumber: number) => {
    const params = new URLSearchParams(
      Object.fromEntries(Array.from(searchParams.entries()).filter(([key]) => key !== "page"))
    )
    params.set("page", String(pageNumber))
    return `/category/${slug}?${params.toString()}`
  }, [searchParams, slug])

  const [sortBy, setSortBy] = React.useState("popular")
  const [priceFilters, setPriceFilters] = React.useState<Set<string>>(new Set())
  const [categoryFilters, setCategoryFilters] = React.useState<Set<string>>(new Set())
  const [taxonomyPrimaryFilter, setTaxonomyPrimaryFilter] = React.useState("")
  const [taxonomySecondaryFilter, setTaxonomySecondaryFilter] = React.useState("")
  const [availableOnly, setAvailableOnly] = React.useState(false)
  const [offersOnly, setOffersOnly] = React.useState(false)

  const currentCategory = React.useMemo(() => {
    if (isAllPage) return null
    return categories.find(c => c.id === slug) || initialCategory || null
  }, [categories, slug, isAllPage, initialCategory])

  const categoryName = isBestSellersView ? "الأكثر طلبًا" : currentCategory?.name || (isAllPage ? "كل المنتجات" : "قسم المنتجات")
  const isRequestOnlyCategoryPage = !!currentCategory && isRequestOnlyTextCategory(currentCategory.name)
  const canShowRequestPageLink = !!currentCategory && !isAllPage
  const isFoodCategoryPage = currentCategory?.name === "طعام"
  const taxonomyConfig = getCategoryTaxonomyConfig(currentCategory?.name)
  const taxonomyPrimaryOptions = getTaxonomyPrimaryOptions(currentCategory?.name)
  const taxonomySecondaryOptions = getTaxonomySecondaryOptions(currentCategory?.name, taxonomyPrimaryFilter)

  const togglePriceFilter = (range: string) => {
    setPriceFilters(prev => {
      const next = new Set(prev)
      next.has(range) ? next.delete(range) : next.add(range)
      return next
    })
  }

  const toggleCategoryFilter = (catId: string) => {
    setCategoryFilters(prev => {
      const next = new Set(prev)
      next.has(catId) ? next.delete(catId) : next.add(catId)
      return next
    })
  }

  const clearAllFilters = () => {
    setSortBy("popular")
    setPriceFilters(new Set())
    setCategoryFilters(new Set())
    setTaxonomyPrimaryFilter("")
    setTaxonomySecondaryFilter("")
    setAvailableOnly(false)
    setOffersOnly(false)
  }

  const hasActiveFilters =
    priceFilters.size > 0 ||
    categoryFilters.size > 0 ||
    sortBy !== "popular" ||
    !!taxonomyPrimaryFilter ||
    !!taxonomySecondaryFilter ||
    availableOnly ||
    offersOnly

  const showRestaurantsView = isFoodCategoryPage && taxonomyPrimaryFilter === "restaurants"

  const displayProducts = React.useMemo(() => {
    let filtered = [...allProducts]

    if (isBestSellersView) {
      return filtered
    }

    if (isFoodCategoryPage) {
      filtered = filtered.filter((product) => product.specifications?.restaurant_item !== true)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q))
    }

    if (categoryFilters.size > 0) {
      filtered = filtered.filter(p => p.category_id && categoryFilters.has(p.category_id))
    }

    if (taxonomyConfig) {
      filtered = filtered.filter((p) =>
        matchesProductTaxonomy(p.specifications, {
          primary: taxonomyPrimaryFilter,
          secondary: taxonomySecondaryFilter,
          tertiary: "",
        })
      )
    }

    if (availableOnly) {
      filtered = filtered.filter((p) => (p.stock_quantity ?? 0) > 0)
    }

    if (offersOnly) {
      filtered = filtered.filter((p) => !!p.show_in_offers || !!p.discount_percentage)
    }

    if (priceFilters.size > 0) {
      filtered = filtered.filter(p => {
        const price = p.discount_percentage ? Math.round(p.price * (1 - p.discount_percentage / 100)) : p.price
        if (priceFilters.has("under50") && price < 50) return true
        if (priceFilters.has("50to200") && price >= 50 && price <= 200) return true
        if (priceFilters.has("200to500") && price > 200 && price <= 500) return true
        if (priceFilters.has("over500") && price > 500) return true
        return false
      })
    }

    switch (sortBy) {
      case "newest":
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case "price-low":
        filtered.sort((a, b) => {
          const pa = a.discount_percentage ? Math.round(a.price * (1 - a.discount_percentage / 100)) : a.price
          const pb = b.discount_percentage ? Math.round(b.price * (1 - b.discount_percentage / 100)) : b.price
          return pa - pb
        })
        break
      case "price-high":
        filtered.sort((a, b) => {
          const pa = a.discount_percentage ? Math.round(a.price * (1 - a.discount_percentage / 100)) : a.price
          const pb = b.discount_percentage ? Math.round(b.price * (1 - b.discount_percentage / 100)) : b.price
          return pb - pa
        })
        break
      default:
        filtered.sort((a, b) => {
          return ((b.specifications as any)?.rating || 0) - ((a.specifications as any)?.rating || 0)
        })
    }

    return filtered
  }, [
    allProducts,
    searchQuery,
    categoryFilters,
    priceFilters,
    sortBy,
    taxonomyConfig,
    taxonomyPrimaryFilter,
    taxonomySecondaryFilter,
    availableOnly,
    offersOnly,
    isBestSellersView,
    isFoodCategoryPage,
  ])

  const productCards = displayProducts.map(toProductCardProps)
  const restaurantCards = React.useMemo(() => {
    let filtered = [...restaurants]
    if (taxonomySecondaryFilter) {
      filtered = filtered.filter((restaurant) =>
        String(restaurant.cuisine || "")
          .toLowerCase()
          .includes(taxonomySecondaryFilter.toLowerCase())
      )
    }
    return filtered
  }, [restaurants, taxonomySecondaryFilter])
  const visibleItemsCount = showRestaurantsView ? restaurantCards.length : productCards.length
  const pageSize = 12
  const rangeStart = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const rangeEnd = totalItems > 0 ? Math.min((currentPage - 1) * pageSize + visibleItemsCount, totalItems) : 0
  const paginationItems = React.useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    const items: Array<number | string> = [1]
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)

    if (start > 2) {
      items.push("start-ellipsis")
    }

    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
      items.push(pageNumber)
    }

    if (end < totalPages - 1) {
      items.push("end-ellipsis")
    }

    items.push(totalPages)
    return items
  }, [currentPage, totalPages])

  return (
    <>
      <Header />
      <main className="flex-1 pb-28 md:pb-8 bg-background min-h-screen">
        <div className="bg-surface border-b border-surface-hover py-6 md:py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl md:text-4xl font-black text-foreground">
              {searchQuery ? `نتايج البحث: "${searchQuery}"` : showRestaurantsView ? "مطاعم في السكة" : categoryName}
            </h1>
            <p className="mt-2 text-gray-500">
              {searchQuery
                    ? `تم العثور على ${productCards.length} منتج`
                    : isBestSellersView
                      ? `عرض ${totalItems} منتج من الأكثر طلبًا مرتبة من الأعلى للأقل.`
                : showRestaurantsView
                  ? "اختار المطعم اللي يعجبك، وادخل شوف المنيو والطلبات اللي بيقدمها من مكان واحد."
                : isRequestOnlyCategoryPage
                  ? "القسم ده بيتطلب بالنص أو بالروشتة، وإحنا هنراجعه معاك خطوة بخطوة."
                                                : "تصفح المنتجات الأول، ولو ملقتش اللي عاوزه اطلبه من زر ملقتش المنتج؟"}
            </p>
            {isFoodCategoryPage && restaurants.length > 0 && !showRestaurantsView ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setTaxonomyPrimaryFilter("restaurants")
                    setTaxonomySecondaryFilter("")
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm font-black text-orange-300 transition-colors hover:bg-orange-500 hover:text-white"
                >
                  <Search className="h-4 w-4" />
                  ادخل على المطاعم
                </button>
              </div>
            ) : null}
            {canShowRequestPageLink && currentCategory ? (
              <div className="mt-4">
                <Link
                  href={`/category/${currentCategory.id}/request`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-black text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  <Search className="h-4 w-4" />
                  {isRequestOnlyCategoryPage ? "افتح صفحة الطلب" : "ملقتش المنتج؟ اطلبه من هنا"}
                </Link>
              </div>
            ) : null}
            {activeGroupOrderCode ? (
              <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-black text-primary">
                أنت تضيف الآن إلى طلب جماعي. أي منتج هتختاره هنا هيروح لنفس الرابط اللي شاركته مع أصحابك.
              </div>
            ) : null}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {isRequestOnlyCategoryPage ? (
            currentCategory ? <CategoryRequestPanel category={currentCategory} compact /> : null
          ) : (
            <div className="flex flex-col md:flex-row gap-8">
              {!isBestSellersView && (
              <div className="flex items-center justify-between mb-4 md:hidden">
                <span className="text-sm text-gray-500 font-medium">
                  {showRestaurantsView ? `عرض ${restaurantCards.length} مطعم` : `عرض ${productCards.length} منتج`}
                </span>
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="flex items-center gap-2 bg-surface border border-surface-hover px-4 py-2.5 rounded-xl text-sm font-bold text-foreground hover:bg-surface-hover active:scale-95 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                  تصفية وترتيب
                  {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary"></span>}
                </button>
              </div>
              )}

                {!isBestSellersView && (
                <aside className={`md:w-64 shrink-0 flex-col gap-8 ${isFilterOpen ? "flex" : "hidden md:flex"}`}>
                  {hasActiveFilters && (
                  <button onClick={clearAllFilters} className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-400 mb-2 transition-colors">
                    <X className="w-3.5 h-3.5" />مسح كل الفلاتر
                  </button>
                  )}
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-foreground pb-2 border-b border-surface-hover">تصفية سريعة</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 rtl:space-x-reverse">
                      <Checkbox id="available-only" checked={availableOnly} onChange={() => setAvailableOnly(prev => !prev)} />
                      <Label htmlFor="available-only" className="text-foreground cursor-pointer">المتوفر فقط</Label>
                    </div>
                    <div className="flex items-center space-x-3 rtl:space-x-reverse">
                      <Checkbox id="offers-only" checked={offersOnly} onChange={() => setOffersOnly(prev => !prev)} />
                      <Label htmlFor="offers-only" className="text-foreground cursor-pointer">العروض والخصومات فقط</Label>
                    </div>
                  </div>
                </div>
                {taxonomyConfig && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg text-foreground pb-2 border-b border-surface-hover">التصنيف</h3>
                    <div className="space-y-3">
                      <div>
                        <Label className="mb-2 block text-sm text-gray-400">{taxonomyConfig.primaryLabel}</Label>
                        <Select
                          value={taxonomyPrimaryFilter}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            setTaxonomyPrimaryFilter(e.target.value)
                            setTaxonomySecondaryFilter("")
                          }}
                          className="w-full"
                        >
                          <option value="">كل التصنيفات الرئيسية</option>
                          {taxonomyPrimaryOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label className="mb-2 block text-sm text-gray-400">{taxonomyConfig.secondaryLabel}</Label>
                        <Select
                          value={taxonomySecondaryFilter}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTaxonomySecondaryFilter(e.target.value)}
                          className="w-full"
                          disabled={!taxonomyPrimaryFilter}
                        >
                          <option value="">كل التصنيفات الفرعية</option>
                          {taxonomySecondaryOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-foreground pb-2 border-b border-surface-hover">الترتيب</h3>
                  <Select value={sortBy} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value)} className="w-full">
                    <option value="popular">الأكثر شعبية</option>
                    <option value="newest">أضيف حديثاً</option>
                    <option value="price-low">السعر: من الأقل للأعلى</option>
                    <option value="price-high">السعر: من الأعلى للأقل</option>
                  </Select>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-foreground pb-2 border-b border-surface-hover">السعر</h3>
                  <div className="space-y-3">
                    {[{ id: "under50", label: "أقل من 50 ج.م" }, { id: "50to200", label: "50 - 200 ج.م" }, { id: "200to500", label: "200 - 500 ج.م" }, { id: "over500", label: "أكثر من 500 ج.م" }].map(range => (
                      <div key={range.id} className="flex items-center space-x-3 rtl:space-x-reverse">
                        <Checkbox id={`price-${range.id}`} checked={priceFilters.has(range.id)} onChange={() => togglePriceFilter(range.id)} />
                        <Label htmlFor={`price-${range.id}`} className="text-foreground cursor-pointer">{range.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                {isAllPage && categories.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg text-foreground pb-2 border-b border-surface-hover">النوع</h3>
                    <div className="space-y-3">
                      {categories.map(cat => (
                        <div key={cat.id} className="flex items-center space-x-3 rtl:space-x-reverse">
                          <Checkbox id={`cat-${cat.id}`} checked={categoryFilters.has(cat.id)} onChange={() => toggleCategoryFilter(cat.id)} />
                          <Label htmlFor={`cat-${cat.id}`} className="text-foreground cursor-pointer">{cat.name}</Label>
                          <span className="text-[10px] text-gray-500 ms-auto">({allProducts.filter(p => p.category_id === cat.id).length})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Button onClick={() => setIsFilterOpen(false)} className="md:hidden mt-4">عرض {productCards.length} نتيجة</Button>
              </aside>
                )}

              <div className="flex-1">
                <div className="hidden md:flex justify-between items-center mb-6">
                  <span className="text-sm text-gray-500">
                    {showRestaurantsView ? `عرض ${restaurantCards.length} مطعم` : isBestSellersView ? `عرض ${productCards.length} من ${totalItems} منتج` : `عرض ${productCards.length} نتيجة`}
                  </span>
                  {hasActiveFilters && !isBestSellersView && <button onClick={clearAllFilters} className="text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors">مسح الفلاتر</button>}
                </div>

                {!isBestSellersView && (
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAvailableOnly(prev => !prev)}
                    className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-black transition-colors ${
                      availableOnly
                        ? "border-primary bg-primary text-white"
                        : "border-surface-hover bg-surface text-gray-300 hover:border-primary/30"
                    }`}
                  >
                    المتوفر فقط
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffersOnly(prev => !prev)}
                    className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-black transition-colors ${
                      offersOnly
                        ? "border-rose-500 bg-rose-500 text-white"
                        : "border-surface-hover bg-surface text-gray-300 hover:border-rose-500/30"
                    }`}
                  >
                    العروض فقط
                  </button>
                  {taxonomyConfig && taxonomyPrimaryFilter ? (
                    <button
                      type="button"
                      onClick={() => {
                        setTaxonomyPrimaryFilter("")
                        setTaxonomySecondaryFilter("")
                      }}
                      className="inline-flex items-center rounded-full border border-surface-hover bg-surface px-3 py-2 text-xs font-black text-gray-300 hover:border-primary/30"
                    >
                      رجّع كل التصنيفات
                    </button>
                  ) : null}
                </div>
                )}

                {isLoading ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
                    {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
                  </div>
                ) : showRestaurantsView ? (
                  restaurantCards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-20 h-20 bg-surface rounded-2xl flex items-center justify-center mb-4 border border-surface-hover">
                        <Search className="w-9 h-9 text-gray-400" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">لسه مفيش مطاعم مضافة هنا</h3>
                      <p className="text-gray-500">أول ما تضيف مطاعم من لوحة الإدارة، هتظهر هنا للعميل بشكل منظم.</p>
                    </div>
                  ) : (
                    <div className="w-full space-y-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
                      {restaurantCards.map((restaurant) => (
                        <RestaurantCard
                          key={restaurant.id}
                          id={restaurant.id}
                          name={restaurant.name}
                          shortDescription={restaurant.short_description}
                          cuisine={restaurant.cuisine}
                          imageUrl={restaurant.image_url}
                          isAvailable={restaurant.is_available}
                          className="block w-full max-w-none"
                        />
                      ))}
                    </div>
                  )
                ) : productCards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-surface rounded-2xl flex items-center justify-center mb-4 border border-surface-hover">
                      <svg className="w-9 h-9 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">مفيش منتجات بالمواصفات دي</h3>
                    <p className="text-gray-500 mb-6">جرب تغير الفلاتر أو اختار تصنيف تاني أو اطلب المنتج من زر "ملقتش المنتج؟"</p>
                    {hasActiveFilters && <Button variant="outline" onClick={clearAllFilters} className="rounded-xl">مسح كل الفلاتر</Button>}
                  </div>
                ) : (
                  <>
                    {taxonomyConfig && (taxonomyPrimaryFilter || taxonomySecondaryFilter) && (
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black text-gray-500">التصنيف الحالي:</span>
                        {taxonomyPrimaryFilter ? (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                            {getTaxonomyLabel(currentCategory?.name, taxonomyPrimaryFilter, taxonomySecondaryFilter).primary}
                          </span>
                        ) : null}
                        {taxonomySecondaryFilter ? (
                          <span className="inline-flex items-center rounded-full bg-surface-hover px-3 py-1 text-xs font-black text-gray-300">
                            {getTaxonomyLabel(currentCategory?.name, taxonomyPrimaryFilter, taxonomySecondaryFilter).secondary}
                          </span>
                        ) : null}
                      </div>
                    )}
                    <div className={`grid grid-cols-2 gap-3 sm:gap-6 ${isBestSellersView ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
                      {productCards.map(product => <ProductCard key={product.id} {...product} />)}
                    </div>

                    {totalPages > 1 && !showRestaurantsView ? (
                      <div className="mt-10 space-y-4">
                        <div className="text-center text-sm font-bold text-gray-400">
                          عرض {rangeStart} - {rangeEnd} من أصل {totalItems} منتج
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                        <Link
                          href={buildPageHref(Math.max(1, currentPage - 1))}
                          aria-disabled={currentPage <= 1}
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                            currentPage <= 1
                              ? "pointer-events-none border-surface-hover text-gray-600"
                              : "border-surface-hover bg-surface text-foreground hover:bg-surface-hover"
                          }`}
                        >
                          <ChevronRight className="h-4 w-4" />
                          السابق
                        </Link>
                        <div className="rounded-xl border border-surface-hover bg-surface px-3 py-2 text-sm font-black text-foreground">
                          صفحة {currentPage} من {totalPages}
                        </div>
                        {paginationItems.map((item, index) =>
                          typeof item === "number" ? (
                            <Link
                              key={item}
                              href={buildPageHref(item)}
                              className={`inline-flex min-w-10 items-center justify-center rounded-xl border px-3 py-2 text-sm font-black transition-colors ${
                                item === currentPage
                                  ? "border-primary bg-primary text-white"
                                  : "border-surface-hover bg-surface text-foreground hover:bg-surface-hover"
                              }`}
                            >
                              {item}
                            </Link>
                          ) : (
                            <span
                              key={`${item}-${index}`}
                              className="inline-flex min-w-10 items-center justify-center px-1 text-sm font-black text-gray-500"
                            >
                              ...
                            </span>
                          )
                        )}
                        <Link
                          href={buildPageHref(Math.min(totalPages, currentPage + 1))}
                          aria-disabled={currentPage >= totalPages}
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                            currentPage >= totalPages
                              ? "pointer-events-none border-surface-hover text-gray-600"
                              : "border-surface-hover bg-surface text-foreground hover:bg-surface-hover"
                          }`}
                        >
                          التالي
                          <ChevronLeft className="h-4 w-4" />
                        </Link>
                      </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
