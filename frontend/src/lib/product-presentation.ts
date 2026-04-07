import type { Product } from "@/services/productsService";
import { getProductCatalogMetadata } from "@/lib/product-metadata";

export type ProductMode = "single" | "bundle";

export type BundleItem = {
  name: string;
  quantity?: string;
  note?: string;
};

type ProductCardLike = {
  id: string;
  title: string;
  price: number;
  oldPrice?: number;
  discountBadge?: string;
  infoBadge?: string;
  rating?: number;
  reviewsCount?: number;
  imageUrl: string;
  productMode: ProductMode;
  bundleItems: BundleItem[];
};

export function getProductMode(specifications?: Record<string, any> | null): ProductMode {
  return specifications?.product_mode === "bundle" ? "bundle" : "single";
}

export function getBundleItems(specifications?: Record<string, any> | null): BundleItem[] {
  const rawItems = Array.isArray(specifications?.bundle_items) ? specifications.bundle_items : [];

  return rawItems
    .map((item: any) => ({
      name: String(item?.name || "").trim(),
      quantity: String(item?.quantity || "").trim(),
      note: String(item?.note || "").trim(),
    }))
    .filter((item: BundleItem) => item.name);
}

export function getBundleSummary(bundleItems: BundleItem[]) {
  if (bundleItems.length === 0) return "";
  if (bundleItems.length === 1) return bundleItems[0].name;
  if (bundleItems.length === 2) return `${bundleItems[0].name} + ${bundleItems[1].name}`;
  return `${bundleItems[0].name} + ${bundleItems.length - 1} منتجات تانية`;
}

export function getBundleItemCount(specifications?: Record<string, any> | null) {
  return getBundleItems(specifications).length;
}

export function toProductCardProps(product: Product): ProductCardLike {
  const metadata = getProductCatalogMetadata(product.specifications);
  let price = product.price;
  let oldPrice: number | undefined = metadata.oldPrice && metadata.oldPrice > price ? metadata.oldPrice : undefined;
  let discountBadge = product.specifications?.discount_badge;

  if (product.discount_percentage && product.discount_percentage > 0) {
    price = Math.round(product.price * (1 - product.discount_percentage / 100));
    oldPrice = product.price;
    discountBadge = `خصم ${product.discount_percentage}%`;
  }

  return {
    id: product.id,
    title: product.name,
    price,
    oldPrice,
    discountBadge,
    rating: product.specifications?.rating,
    reviewsCount: product.specifications?.reviews_count,
    imageUrl: product.image_url || product.specifications?.image_url || "",
    productMode: getProductMode(product.specifications),
    bundleItems: getBundleItems(product.specifications),
  };
}
