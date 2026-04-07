import { cache } from "react"
import type { Metadata } from "next"
import CategoryPageClient from "./category-page-client"
import {
  fetchCategoryByIdServer,
  fetchBestSellersPageServer,
  fetchPaginatedProductsServer,
} from "@/services/serverCatalogService"
import { fetchRestaurantsServer } from "@/services/serverRestaurantsService"
import {
  getCategoryTaxonomyConfig,
  getTaxonomyPrimaryOptions,
} from "@/lib/category-taxonomy"
import { fetchPublicAppSettingsServer } from "@/services/serverAppSettingsService"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fi-elsekka.vercel.app"
const PAGE_SIZE = 12

export const revalidate = 300

const getCategoryPageData = cache(async (slug: string, view: string, page: number) => {
  if (slug === "all" && view === "best-sellers") {
    const bestSellerResult = await fetchBestSellersPageServer(page, PAGE_SIZE)
    return {
      category: null,
      products: bestSellerResult.products,
      hasMore: page + 1 < bestSellerResult.totalPages,
      restaurants: [],
      listingMode: "best-sellers" as const,
      totalPages: bestSellerResult.totalPages,
      currentPage: page + 1,
      totalItems: bestSellerResult.total,
    }
  }

  if (slug === "all") {
    const paginatedResult = await fetchPaginatedProductsServer(page, PAGE_SIZE)
    return {
      category: null,
      products: paginatedResult.products,
      hasMore: paginatedResult.hasMore,
      restaurants: [],
      listingMode: "all" as const,
      totalPages: paginatedResult.totalPages,
      currentPage: page + 1,
      totalItems: paginatedResult.total,
    }
  }

  const [category, paginatedResult] = await Promise.all([
    fetchCategoryByIdServer(slug),
    fetchPaginatedProductsServer(page, PAGE_SIZE, slug),
  ])

  const restaurants =
    category?.name === "طعام"
      ? await fetchRestaurantsServer(category.id)
      : []

  return {
    category,
    products: paginatedResult.products,
    hasMore: paginatedResult.hasMore,
    restaurants,
    listingMode: "category" as const,
    totalPages: paginatedResult.totalPages,
    currentPage: page + 1,
    totalItems: paginatedResult.total,
  }
})

function buildCategoryDescription(categoryName: string, categoryDescription?: string | null) {
  if (categoryDescription?.trim()) return categoryDescription.trim()
  return `شوف منتجات ${categoryName} على في السكة، واختار اللي يناسبك بسهولة ومن غير لفة كتير.`
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string; view?: string; page?: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { q, view, page } = await searchParams

  if (slug === "all") {
    const settings = await fetchPublicAppSettingsServer()
    const siteName = settings.siteName || "في السكة"
    const query = q?.trim()
    const isBestSellersView = view === "best-sellers"
    const title = isBestSellersView
      ? `الأكثر طلبًا | ${siteName}`
      : query
        ? `نتايج البحث عن ${query} | ${siteName}`
        : `كل المنتجات | ${siteName}`
    const description = isBestSellersView
      ? `شوف المنتجات الأكثر طلبًا على ${siteName} مرتبة حسب الطلبات الفعلية من الأعلى للأقل.`
      : query
      ? `شوف نتايج البحث عن ${query} على ${siteName}، ووصّل اللي يعجبك لحد عندك بسهولة.`
      : `لف في كل منتجات ${siteName} من مكان واحد، واختار اللي يناسبك بسرعة.`
    const normalizedPage = Math.max(1, Number(page || "1") || 1)
    const url = isBestSellersView
      ? `${SITE_URL}/category/all?view=best-sellers&page=${normalizedPage}`
      : query
        ? `${SITE_URL}/category/all?q=${encodeURIComponent(query)}&page=${normalizedPage}`
        : `${SITE_URL}/category/all?page=${normalizedPage}`

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        siteName,
        locale: "ar_EG",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    }
  }

  const { category } = await getCategoryPageData(slug, "", 0)
  const settings = await fetchPublicAppSettingsServer()
  const siteName = settings.siteName || "في السكة"
  const categoryName = category?.name || "قسم المنتجات"
  const description = buildCategoryDescription(categoryName, category?.description)
  const taxonomyConfig = getCategoryTaxonomyConfig(category?.name)
  const taxonomyKeywords = taxonomyConfig
    ? getTaxonomyPrimaryOptions(category?.name).map((option) => option.label)
    : []
  const normalizedPage = Math.max(1, Number(page || "1") || 1)
  const url = `${SITE_URL}/category/${slug}?page=${normalizedPage}`

  return {
    title: `${categoryName} | ${siteName}`,
    description,
    keywords: [categoryName, ...taxonomyKeywords, siteName, "توصيل", "طلبات"],
    alternates: { canonical: url },
    openGraph: {
      title: `${categoryName} | ${siteName}`,
      description,
      url,
      siteName,
      locale: "ar_EG",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${categoryName} | ${siteName}`,
      description,
    },
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string; view?: string; page?: string }>
}) {
  const { slug } = await params
  const { q, view, page } = await searchParams
  const currentPage = Math.max(1, Number(page || "1") || 1) - 1
  const { category, products, hasMore, restaurants, listingMode, totalPages, totalItems } = await getCategoryPageData(slug, view || "", currentPage)

  return (
    <CategoryPageClient
      initialCategory={category}
      initialProducts={products}
      initialHasMore={hasMore}
      initialRestaurants={restaurants}
      initialSearchQuery={q?.trim() || ""}
      listingMode={listingMode}
      currentPage={currentPage + 1}
      totalPages={totalPages}
      totalItems={totalItems}
    />
  )
}
