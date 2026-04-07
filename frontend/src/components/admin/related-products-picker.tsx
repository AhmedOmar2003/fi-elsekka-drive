"use client";

import * as React from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";

type PickerProduct = {
  id: string;
  name: string;
  image_url?: string | null;
  category_id?: string | null;
  categories?: { name?: string | null } | null;
};

type RelatedProductsPickerProps = {
  products: PickerProduct[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  currentProductId?: string | null;
  currentCategoryId?: string | null;
};

export function RelatedProductsPicker({
  products,
  selectedIds,
  onChange,
  currentProductId,
  currentCategoryId,
}: RelatedProductsPickerProps) {
  const [query, setQuery] = React.useState("");

  const selectedProducts = React.useMemo(() => {
    const lookup = new Map(products.map((product) => [product.id, product]));
    return selectedIds
      .map((id) => lookup.get(id))
      .filter((product): product is PickerProduct => Boolean(product));
  }, [products, selectedIds]);

  const availableProducts = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products
      .filter((product) => product.id !== currentProductId)
      .filter((product) => !selectedIds.includes(product.id))
      .filter((product) => {
        if (!normalizedQuery) return true;
        return product.name.toLowerCase().includes(normalizedQuery);
      })
      .sort((left, right) => {
        const leftSameCategory = currentCategoryId && left.category_id === currentCategoryId ? 1 : 0;
        const rightSameCategory = currentCategoryId && right.category_id === currentCategoryId ? 1 : 0;
        if (rightSameCategory !== leftSameCategory) return rightSameCategory - leftSameCategory;
        return left.name.localeCompare(right.name, "ar");
      })
      .slice(0, 8);
  }, [currentCategoryId, currentProductId, products, query, selectedIds]);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-bold text-gray-500 mb-1.5">منتجات مرتبطة يدويًا</label>
        <p className="text-[11px] text-gray-500">
          لو اخترت منتجات هنا، الترشيحات اليدوية هتظهر أولًا. والباقي هيكمله النظام تلقائيًا.
        </p>
      </div>

      <div className="rounded-2xl border border-surface-hover bg-surface p-3 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث باسم المنتج عشان تضيفه"
            className="w-full rounded-xl border border-surface-hover bg-background py-2.5 pr-9 pl-3 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-primary/50"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {selectedProducts.length === 0 ? (
            <span className="text-[11px] text-gray-500">لسه مفيش منتجات مختارة يدويًا.</span>
          ) : (
            selectedProducts.map((product) => (
              <span
                key={product.id}
                className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary"
              >
                <span className="line-clamp-1 max-w-[180px]">{product.name}</span>
                <button
                  type="button"
                  onClick={() => onChange(selectedIds.filter((id) => id !== product.id))}
                  className="rounded-full p-0.5 hover:bg-primary/15"
                  aria-label={`إزالة ${product.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-surface-hover bg-background/60 max-h-64 overflow-y-auto">
          {availableProducts.length === 0 ? (
            <p className="px-4 py-4 text-center text-xs text-gray-500">
              {query ? "مفيش نتائج مطابقة للبحث ده." : "ابدأ اكتب اسم منتج عشان تختاره بسهولة."}
            </p>
          ) : (
            <div className="divide-y divide-surface-hover">
              {availableProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onChange([...selectedIds, product.id])}
                  className="flex w-full items-center gap-3 px-3 py-3 text-right transition-colors hover:bg-surface-hover"
                >
                  <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-surface-hover shrink-0">
                    {product.image_url ? (
                      <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="48px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-gray-500">بدون صورة</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-bold text-foreground">{product.name}</p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {product.categories?.name || "بدون قسم"}
                      {currentCategoryId && product.category_id === currentCategoryId ? " • نفس القسم" : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
