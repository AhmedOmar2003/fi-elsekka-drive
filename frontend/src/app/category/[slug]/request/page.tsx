"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ArrowRight } from "lucide-react"
import { useProducts } from "@/contexts/ProductsContext"
import { CategoryRequestPanel } from "@/components/categories/category-request-panel"

export default function CategoryRequestPage() {
  const params = useParams()
  const slug = typeof params.slug === "string" ? params.slug : ""
  const { categories } = useProducts()

  const currentCategory = React.useMemo(
    () => categories.find(category => category.id === slug) || null,
    [categories, slug]
  )

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pb-24 md:pb-8">
        <div className="border-b border-surface-hover bg-surface py-6 md:py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Link
              href={currentCategory ? `/category/${currentCategory.id}` : "/categories"}
              className="inline-flex items-center gap-2 text-sm font-black text-primary transition-colors hover:text-primary/80"
            >
              <ArrowRight className="h-4 w-4" />
              الرجوع للقسم
            </Link>
            <h1 className="mt-4 text-3xl font-black text-foreground md:text-4xl">
              {currentCategory?.name === "صيدلية" ? "ابعت طلبك الصيدلي" : "اطلب منتج مش لاقيه"}
            </h1>
            <p className="mt-2 text-gray-500">
              {currentCategory?.name === "صيدلية"
                ? "اكتب طلبك أو ارفع الروشتة، وإحنا هنراجعها ونرد عليك بالسعر."
                : `لو ملقتش اللي عاوزه في ${currentCategory?.name || "القسم"}، اكتب لنا الطلب وإحنا هندورلك عليه ونرجعلك بالسعر.`}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {currentCategory ? (
            <CategoryRequestPanel category={currentCategory} compact />
          ) : (
            <div className="rounded-3xl border border-surface-hover bg-surface p-8 text-center shadow-premium">
              <h2 className="text-2xl font-black text-foreground">القسم ده مش موجود</h2>
              <p className="mt-3 text-sm text-gray-500">ارجع للتصنيفات واختار القسم اللي تحب تبعت منه الطلب.</p>
              <Link
                href="/categories"
                className="mt-6 inline-flex items-center rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white transition-colors hover:bg-primary/90"
              >
                ارجع للتصنيفات
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
