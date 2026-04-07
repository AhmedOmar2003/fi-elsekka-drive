import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractAccessToken } from "@/lib/admin-guard";
import { attachOrderEconomics, CURRENT_DELIVERY_FEE, ORDER_ECONOMICS_VERSION } from "@/lib/order-economics";
import { buildRestaurantOrderSnapshotFromCart } from "@/lib/restaurant-order";
import { reserveInventoryForItems } from "@/lib/order-inventory";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || "";

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

async function notifyAdminsAboutOrder(accessToken: string, orderId: string, origin: string) {
  await fetch(new URL(`/api/orders/${orderId}/admin-alert`, origin), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(() => null);
}

async function notifyRestaurantAboutOrder(accessToken: string, orderId: string, origin: string) {
  await fetch(new URL(`/api/orders/${orderId}/restaurant-alert`, origin), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(() => null);
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const token = extractAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authData.user;
  const requestOrigin = new URL(request.url).origin;
  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  const cartItems = Array.isArray(body?.cartItems) ? body.cartItems : [];
  const shippingDetails = body?.shippingDetails || {};
  const subtotalAmount = Number(body?.subtotalAmount || 0);
  const clearCartAfterOrder = body?.clearCartAfterOrder !== false;

  if (!userId || userId !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const hasTextRequestText = !!shippingDetails?.custom_request_text;
  const hasTextRequestImages = Array.isArray(shippingDetails?.custom_request_image_urls) && shippingDetails.custom_request_image_urls.length > 0;
  const isTextRequestOrder = shippingDetails?.request_mode === "custom_category_text" && (hasTextRequestText || hasTextRequestImages);
  const restaurantOrderSnapshot = buildRestaurantOrderSnapshotFromCart(cartItems);
  const shippingWithEconomics = isTextRequestOrder
    ? {
        ...(shippingDetails || {}),
        ...restaurantOrderSnapshot,
        delivery_fee: CURRENT_DELIVERY_FEE,
        subtotal_amount: 0,
        gross_collected: 0,
        platform_base_revenue: 0,
        driver_revenue: 0,
        merchant_discount_amount: 0,
        platform_revenue: 0,
        merchant_settlement: 0,
        economics_version: ORDER_ECONOMICS_VERSION,
        search_pending: true,
        search_status: "searching",
        search_requested_at: new Date().toISOString(),
        pricing_pending: true,
      }
    : attachOrderEconomics(
        {
          ...(shippingDetails || {}),
          ...restaurantOrderSnapshot,
          delivery_fee: CURRENT_DELIVERY_FEE,
          economics_version: ORDER_ECONOMICS_VERSION,
        },
        subtotalAmount + CURRENT_DELIVERY_FEE,
        0
      );

  const orderTotalAmount = isTextRequestOrder ? 0 : shippingWithEconomics.gross_collected;

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: userId,
      status: "pending",
      total_amount: orderTotalAmount,
      shipping_address: shippingWithEconomics,
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || "Failed to create order" }, { status: 500 });
  }

  try {
    if (cartItems.length > 0) {
      const orderItems = cartItems.map((item: any) => {
        let finalPrice = item.applied_price ?? item.product?.price ?? 0;
        if (item.applied_price == null && item.product?.discount_percentage && item.product.discount_percentage > 0) {
          finalPrice = Math.round(finalPrice * (1 - item.product.discount_percentage / 100));
        }
        return {
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          price_at_purchase: finalPrice,
          selected_variant_json: item.selected_variant_json || null,
        };
      });

      const { error: itemsError } = await supabaseAdmin
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        throw new Error(itemsError.message || "Failed to create order items");
      }

      if (!isTextRequestOrder) {
        await reserveInventoryForItems(
          supabaseAdmin,
          order.id,
          orderItems.map((item: { product_id: string; quantity: number }) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
          shippingWithEconomics,
          "order_created"
        );
      }

      if (clearCartAfterOrder) {
        const { error: clearError } = await supabaseAdmin
          .from("cart_items")
          .delete()
          .eq("user_id", userId);

        if (clearError) {
          console.error("Failed to clear cart after order:", clearError.message);
        }
      }
    }

    if (shippingDetails?.is_grace_period === false) {
      await Promise.allSettled([
        notifyAdminsAboutOrder(token, order.id, requestOrigin),
        notifyRestaurantAboutOrder(token, order.id, requestOrigin),
      ]);
    }

    return NextResponse.json({ data: order });
  } catch (error: any) {
    await supabaseAdmin.from("order_items").delete().eq("order_id", order.id);
    await supabaseAdmin.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: error?.message || "Failed to complete order" }, { status: 400 });
  }
}
