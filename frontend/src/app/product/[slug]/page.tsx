import type { Metadata } from "next"
import ProductPageClient from "./product-page-client"
import { fetchProductDetails, fetchRelatedProducts } from "@/services/productsService"
import { cache } from "react"
import { fetchPublicAppSettingsServer } from "@/services/serverAppSettingsService"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fi-elsekka.vercel.app"
const getProductForPage = cache((slug: string) => fetchProductDetails(slug))

export const revalidate = 300;

const toAbsoluteUrl = (value?: string | null) => {
  if (!value) return `${SITE_URL}/icon.svg`
  if (value.startsWith("http://") || value.startsWith("https://")) return value
  return `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductForPage(slug)
  const settings = await fetchPublicAppSettingsServer()
  const siteName = settings.siteName || "في السكة"

  if (!product) {
    return {
      title: `المنتج ده مش متاح دلوقتي | ${siteName}`,
      description: `شوف منتجات تانية على ${siteName}، ويمكن تلاقي اللي يناسبك بسهولة.`,
    }
  }

  const title = `${product.name} | ${siteName}`
  const description =
    product.description?.trim() ||
    "شوف تفاصيل المنتج على في السكة واطلبه بسهولة لحد عندك."
  const image = toAbsoluteUrl(product.images?.[0] || product.image_url)
  const url = `${SITE_URL}/product/${slug}`

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName,
      locale: "ar_EG",
      type: "website",
      images: [
        {
          url: image,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await getProductForPage(slug)
  const relatedProducts = product ? await fetchRelatedProducts(product.id, 8) : []

  return <ProductPageClient initialProduct={product} initialRelatedProducts={relatedProducts} />
}
