import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractAccessToken } from "@/lib/admin-guard";
import { restoreOrderInventory } from "@/lib/order-inventory";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || "";

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;

function resolveOrderId(request: NextRequest, context: any) {
  const params = context?.params || {};
  const routeId = typeof params.id === "string" ? params.id : undefined;
  const derivedId = request.url.includes("/api/orders/")
    ? request.url.split("/api/orders/")[1]?.split("/cancel")[0]?.split(/[?#]/)[0]
    : undefined;
  const rawId = routeId || derivedId;
  return rawId ? decodeURIComponent(rawId) : undefined;
}

export async function POST(request: NextRequest, context: any) {
  const id = resolveOrderId(request, context);

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
  }

  const token = extractAccessToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const origin = body?.origin === "account" ? "account" : "grace_period";

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, shipping_address")
    .eq("id", id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.user_id !== authData.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentShipping = order.shipping_address || {};
  const now = new Date().toISOString();
  const duringGracePeriod = currentShipping.is_grace_period === true;
  const nextShipping = {
    ...currentShipping,
    customer_cancelled_order: true,
    customer_cancelled_during_grace_period: duringGracePeriod,
    customer_cancel_origin: origin,
    customer_cancelled_at: now,
    customer_cancelled_reason: duringGracePeriod ? "cancelled_by_customer_within_grace_period" : "cancelled_by_customer",
  };

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      status: "cancelled",
      shipping_address: nextShipping,
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "تعذر إلغاء الطلب" }, { status: 500 });
  }

  try {
    await restoreOrderInventory(supabaseAdmin, id, "customer_cancelled");
  } catch (inventoryError: any) {
    console.error("restoreOrderInventory(customer cancel) error:", inventoryError?.message || inventoryError);
  }

  return NextResponse.json({ data });
}
