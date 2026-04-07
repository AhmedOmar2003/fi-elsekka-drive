"use client"

import * as React from "react"
import Link from "next/link"
import { CategoryCard } from "@/components/ui/category-card"
import { getCategoryDesign } from "@/services/categoriesService"
import { useProducts } from "@/contexts/ProductsContext"

export function HomeCategoriesList() {
    const { categories, isLoadingCategories: isLoading } = useProducts();

    if (isLoading) {
        return (
            <div className="flex items-start gap-4 overflow-x-auto px-4 pb-4 pt-2 no-scrollbar -mx-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 md:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex w-[29vw] min-w-[108px] shrink-0 flex-col items-center gap-2 sm:w-auto sm:min-w-0">
                        <div className="relative h-[104px] w-full overflow-hidden rounded-[28px] bg-surface-hover before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent sm:h-[160px]" />
                        <div className="h-3 w-14 rounded-full bg-surface-hover relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" />
                    </div>
                ))}
            </div>
        )
    }

    if (categories.length === 0) {
        return null;
    }

    const categoryPriority = ['ملابس وأزياء', 'سوبر ماركت', 'طعام', 'صيدلية', 'إلكترونيات', 'ألعاب أطفال', 'أدوات منزلية', 'عناية شخصية']

    const sortedCategories = [...categories].sort((a, b) => {
        const aIndex = categoryPriority.indexOf(a.name)
        const bIndex = categoryPriority.indexOf(b.name)

        if (aIndex !== -1 || bIndex !== -1) {
            if (aIndex === -1) return 1
            if (bIndex === -1) return -1
            return aIndex - bIndex
        }

        return a.name.localeCompare(b.name, 'ar')
    });

    return (
        <div className="flex items-start gap-4 overflow-x-auto px-4 pb-4 pt-2 no-scrollbar -mx-4 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 md:grid-cols-6">
            {sortedCategories.map((cat) => {
                const design = getCategoryDesign(cat.name);
                return (
                    <div key={cat.id} className="snap-start shrink-0 w-[31vw] min-w-[116px] sm:w-auto sm:min-w-0">
                        <CategoryCard
                            slug={cat.id}
                            name={cat.name}
                            icon={<design.iconComponent className="w-8 h-8 sm:w-10 sm:h-10 text-current" />}
                            className="w-full h-full"
                        />
                    </div>
                )
            })}
        </div>
    )
}
