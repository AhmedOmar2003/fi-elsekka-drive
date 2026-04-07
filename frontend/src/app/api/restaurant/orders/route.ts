import { NextResponse } from "next/server";
import { getProductCatalogMetadata } from "@/lib/product-metadata";
import { requireRestaurantApi, restaurantSupabaseAdmin } from "@/lib/restaurant-guard";

export async function GET(request: Request) {
  if (!restaurantSupabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured: missing service role key" }, { status: 500 });
  }

  const auth = await requireRestaurantApi(request);
  if (!auth.ok) return auth.response;
  const restaurant = auth.profile.restaurant;

  const baseSelect = `
      *,
      users(full_name, email, phone),
      order_items(
        id,
        product_id,
        quantity,
        price_at_purchase,
        selected_variant_json,
        products(id, name, price, image_url, specifications)
      )
    `;

  let ordersResult = await restaurantSupabaseAdmin
    .from("orders")
    .select(baseSelect)
    .contains("shipping_address", { restaurant_id: restaurant.id })
    .order("created_at", { ascending: false })
    .limit(120);

  if (ordersResult.error) {
    ordersResult = await restaurantSupabaseAdmin
      .from("orders")
      .select(baseSelect)
      .order("created_at", { ascending: false })
      .limit(120);
  }

  const { data: orders, error: ordersError } = ordersResult;

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message || "Failed to load orders" }, { status: 500 });
  }

  const filteredOrders = (orders || [])
    .map((order: any) => {
      const restaurantItems = (order.order_items || []).filter((item: any) => {
        const metadata = getProductCatalogMetadata(item?.products?.specifications);
        return metadata.restaurantItem && metadata.restaurantId === restaurant.id;
      });

      if (restaurantItems.length === 0) return null;

      const restaurantTotal = restaurantItems.reduce((sum: number, item: any) => {
        const unitPrice = Number(item.price_at_purchase || item.products?.price || 0);
        const quantity = Number(item.quantity || 1);
        return sum + unitPrice * quantity;
      }, 0);

      return {
        ...order,
        order_items: restaurantItems,
        restaurant_total: restaurantTotal,
      };
    })
    .filter(Boolean);

  return NextResponse.json({
    restaurant,
    orders: filteredOrders,
  });
}
