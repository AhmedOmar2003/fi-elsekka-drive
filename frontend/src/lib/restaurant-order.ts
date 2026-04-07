import { getProductCatalogMetadata } from "@/lib/product-metadata";

type CartItemLike = {
  product?: {
    specifications?: Record<string, any> | null;
  } | null;
};

export type RestaurantEtaStatus = "pending_restaurant" | "submitted" | "approved";

export type RestaurantOrderSnapshot = {
  isRestaurantOrder: boolean;
  restaurantId: string;
  restaurantName: string;
  restaurantItemsCount: number;
  etaStatus: RestaurantEtaStatus;
  etaText: string;
  etaHours: number;
  etaDays: number;
  etaNote: string;
  etaSubmittedAt: string | null;
  etaApprovedAt: string | null;
};

export function buildRestaurantOrderSnapshotFromCart(cartItems: CartItemLike[]) {
  const restaurantItems = cartItems
    .map((item) => getProductCatalogMetadata(item?.product?.specifications))
    .filter((meta) => meta.restaurantItem && meta.restaurantId);

  if (restaurantItems.length === 0) return {};

  const primaryRestaurant = restaurantItems[0];

  return {
    restaurant_order: true,
    restaurant_id: primaryRestaurant.restaurantId,
    restaurant_name: primaryRestaurant.restaurantName,
    restaurant_items_count: restaurantItems.length,
    restaurant_eta_status: "pending_restaurant" as RestaurantEtaStatus,
    restaurant_eta_text: "",
    restaurant_eta_hours: 0,
    restaurant_eta_days: 0,
    restaurant_eta_note: "",
    restaurant_eta_submitted_at: null,
    restaurant_eta_approved_at: null,
  };
}

export function getRestaurantOrderSnapshot(shippingAddress?: Record<string, any> | null): RestaurantOrderSnapshot {
  const shipping = shippingAddress || {};

  return {
    isRestaurantOrder:
      shipping.restaurant_order === true ||
      !!String(shipping.restaurant_id || "").trim() ||
      !!String(shipping.restaurant_name || "").trim(),
    restaurantId: String(shipping.restaurant_id || "").trim(),
    restaurantName: String(shipping.restaurant_name || "").trim(),
    restaurantItemsCount: Math.max(0, Number(shipping.restaurant_items_count || 0)),
    etaStatus: (["pending_restaurant", "submitted", "approved"].includes(String(shipping.restaurant_eta_status))
      ? shipping.restaurant_eta_status
      : "pending_restaurant") as RestaurantEtaStatus,
    etaText: String(shipping.restaurant_eta_text || "").trim(),
    etaHours: Math.max(0, Number(shipping.restaurant_eta_hours || 0)),
    etaDays: Math.max(0, Number(shipping.restaurant_eta_days || 0)),
    etaNote: String(shipping.restaurant_eta_note || "").trim(),
    etaSubmittedAt: shipping.restaurant_eta_submitted_at || null,
    etaApprovedAt: shipping.restaurant_eta_approved_at || null,
  };
}

export function formatRestaurantEtaWindow(days: number, hours: number) {
  if (days > 0 && hours > 0) return `${days} يوم و${hours} ساعة`;
  if (days > 0) return `${days} يوم`;
  if (hours > 0) return `${hours} ساعة`;
  return "غير محدد";
}
