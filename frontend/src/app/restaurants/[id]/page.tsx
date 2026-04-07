import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { RestaurantMenuBrowser } from "@/components/restaurants/restaurant-menu-browser"
import { fetchCategoryByIdServer } from "@/services/serverCatalogService"
import { fetchRestaurantByIdServer, fetchRestaurantMenuServer } from "@/services/serverRestaurantsService"
import { toProductCardProps } from "@/lib/product-presentation"
import { getProductCatalogMetadata } from "@/lib/product-metadata"
import { ArrowRight, Clock3, Sparkles, Store, UtensilsCrossed } from "lucide-react"
import Link from "next/link"
import { fetchPublicAppSettingsServer } from "@/services/serverAppSettingsService"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fi-elsekka.vercel.app"

export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const restaurant = await fetchRestaurantByIdServer(id)
  const settings = await fetchPublicAppSettingsServer()
  const siteName = settings.siteName || "في السكة"

  if (!restaurant) {
    return {
      title: `مطعم غير موجود | ${siteName}`,
    }
  }

  const description =
    restaurant.short_description?.trim() ||
    `شوف منيو ${restaurant.name} على في السكة واطلب اللي يعجبك بسهولة.`

  return {
    title: `${restaurant.name} | مطاعم ${siteName}`,
    description,
    alternates: { canonical: `${SITE_URL}/restaurants/${id}` },
    openGraph: {
      title: `${restaurant.name} | مطاعم ${siteName}`,
      description,
      url: `${SITE_URL}/restaurants/${id}`,
      siteName,
      locale: "ar_EG",
      type: "website",
      images: restaurant.image_url ? [{ url: restaurant.image_url }] : undefined,
    },
  }
}

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const restaurant = await fetchRestaurantByIdServer(id)

  if (!restaurant) {
    notFound()
  }

  const foodCategory = restaurant.category_id ? await fetchCategoryByIdServer(restaurant.category_id) : null
  const products = await fetchRestaurantMenuServer(restaurant.id, foodCategory?.id)
  const cards = products.map((product) => {
    const metadata = getProductCatalogMetadata(product.specifications)
    return {
      ...toProductCardProps(product),
      section: metadata.restaurantSection || "المنيو كله",
    }
  })
  const restaurantSections = restaurant.menu_sections || []

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pb-28 md:pb-10">
        <section className="border-b border-surface-hover bg-gradient-to-b from-surface to-background py-8 md:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
              <div className="space-y-5">
                <Link
                  href={foodCategory?.id ? `/category/${foodCategory.id}` : "/category/all"}
                  className="mb-5 hidden items-center gap-2 text-sm font-black text-primary md:inline-flex"
                >
                  <ArrowRight className="h-4 w-4" />
                  رجوع لقسم الطعام
                </Link>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-black text-foreground md:text-5xl">{restaurant.name}</h1>
                  <div className="inline-flex rounded-full border border-orange-500/15 bg-orange-500/10 px-3 py-1 text-xs font-black text-orange-300">
                    {restaurant.cuisine || "مطاعم في السكة"}
                  </div>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-400 md:text-base">
                  {restaurant.description || restaurant.short_description || "منيو مرتب وواضح، والأسعار والعروض كلها قدامك من غير لفة."}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black ${restaurant.is_available ? "border-emerald-500/15 bg-emerald-500/10 text-emerald-300" : "border-amber-500/15 bg-amber-500/10 text-amber-300"}`}>
                    <Store className="h-4 w-4" />
                    {restaurant.is_available ? "المطعم متاح الآن" : "المطعم غير متاح حاليًا"}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-surface-hover bg-background/70 px-4 py-3 text-sm font-black text-gray-300">
                    <Clock3 className="h-4 w-4 text-primary" />
                    وقت التوصيل بيتأكد من الإدارة بعد الطلب
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-surface-hover bg-background/70 px-4 py-3 text-sm font-black text-gray-300">
                    <Sparkles className="h-4 w-4 text-primary" />
                    اطلب من الموقع مباشرة علشان نرتب لك التوصيل بدقة
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-surface-hover bg-background/70 px-4 py-3 text-sm font-black text-gray-300">
                    <UtensilsCrossed className="h-4 w-4 text-primary" />
                    المنيو والأسعار والعروض كلها محدثة من داخل في السكة
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[32px] border border-surface-hover bg-surface-container shadow-[var(--shadow-material-2)]">
                {restaurant.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={restaurant.image_url} alt={restaurant.name} className="h-full min-h-[300px] w-full object-cover md:min-h-[380px]" />
                ) : (
                  <div className="flex min-h-[320px] items-center justify-center text-gray-500">
                    <Store className="h-14 w-14" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-6 rounded-[28px] border border-surface-hover bg-surface p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-foreground">المنيو</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {cards.length > 0
                    ? `فيه ${cards.length} صنف جاهزين للطلب من ${restaurant.name}.`
                    : "لسه المنيو ما اتحطتش بالكامل، لكن المطعم اتجهز للظهور."}
                </p>
              </div>
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href={foodCategory?.id ? `/category/${foodCategory.id}/request` : "/category/all"}>
                  ملقتش اللي عاوزه؟
                </Link>
              </Button>
            </div>
          </div>

          {cards.length === 0 ? (
            <div className="rounded-3xl border border-surface-hover bg-surface px-6 py-16 text-center">
              <p className="text-lg font-black text-foreground">المنيو لسه بتتجهز</p>
              <p className="mt-2 text-sm text-gray-500">ارجع قريب، أو اطلب المنتج اللي محتاجه من زر ملقتش اللي عاوزه؟</p>
            </div>
          ) : (
            <RestaurantMenuBrowser items={cards} restaurantName={restaurant.name} sections={restaurantSections} />
          )}
        </section>
      </main>
      <Footer />
    </>
  )
}
