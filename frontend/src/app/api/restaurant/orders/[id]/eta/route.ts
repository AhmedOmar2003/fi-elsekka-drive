import { NextResponse } from "next/server";
import { createUserNotificationWithPush } from "@/lib/user-push-server";
import { requireRestaurantApi, restaurantSupabaseAdmin } from "@/lib/restaurant-guard";
import { getProductCatalogMetadata } from "@/lib/product-metadata";

function resolveOrderId(request: Request) {
  const routeMatch = request.url.match(/\/api\/restaurant\/orders\/([^/]+)\/eta/);
  return routeMatch?.[1] ? decodeURIComponent(routeMatch[1]) : null;
}

async function notifyAdmins(orderId: string, restaurantName: string, etaText: string) {
  if (!restaurantSupabaseAdmin) return;

  const { data: admins } = await restaurantSupabaseAdmin
    .from("users")
    .select("id")
    .in("role", ["super_admin", "admin", "operations_manager", "support_agent"])
    .neq("disabled", true);

  const message = `${restaurantName} رد بموعد التوصيل: ${etaText}`;

  await Promise.allSettled(
    (admins || []).map((admin: any) =>
      createUserNotificationWithPush(restaurantSupabaseAdmin, admin.id, {
        title: "موعد توصيل جديد من المطعم",
        message,
        link: `/admin/orders`,
      })
    )
  );

  await restaurantSupabaseAdmin.channel("admin-notifications").send({
    type: "broadcast",
    event: "restaurant-eta-submitted",
    payload: {
      orderId,
      restaurantName,
      etaText,
    },
  });
}

export async function PATCH(request: Request) {
  if (!restaurantSupabaseAdmin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const auth = await requireRestaurantApi(request);
  if (!auth.ok) return auth.response;

  const orderId = resolveOrderId(request);
  if (!orderId) {
    return NextResponse.json({ error: "رقم الطلب غير صحيح" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const etaText = String(body?.etaText || "").trim();
  const etaHours = Math.max(0, Number(body?.etaHours || 0));
  const etaDays = Math.max(0, Number(body?.etaDays || 0));
  const etaNote = String(body?.etaNote || "").trim();

  if (!etaText) {
    return NextResponse.json({ error: "اكتب نصًا واضحًا لموعد التوصيل" }, { status: 400 });
  }

  if (!Number.isFinite(etaHours) || !Number.isFinite(etaDays) || (etaHours <= 0 && etaDays <= 0)) {
    return NextResponse.json({ error: "حدد عدد ساعات أو أيام على الأقل" }, { status: 400 });
  }

  const { data: order, error: orderError } = await restaurantSupabaseAdmin
    .from("orders")
    .select(`
      id,
      status,
      shipping_address,
      order_items(
        id,
        product_id,
        quantity,
        products(id, specifications)
      )
    `)
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  if (["cancelled", "delivered"].includes(order.status)) {
    return NextResponse.json({ error: "لا يمكن تحديث موعد طلب مغلق" }, { status: 400 });
  }

  const restaurantOwnsOrder = (order.order_items || []).some((item: any) => {
    const metadata = getProductCatalogMetadata(item?.products?.specifications);
    return metadata.restaurantItem && metadata.restaurantId === auth.profile.restaurant.id;
  });

  if (!restaurantOwnsOrder) {
    return NextResponse.json({ error: "هذا الطلب لا يخص المطعم الحالي" }, { status: 403 });
  }

  const updatedShipping = {
    ...(order.shipping_address || {}),
    restaurant_order: true,
    restaurant_id: auth.profile.restaurant.id,
    restaurant_name: auth.profile.restaurant.name,
    restaurant_eta_status: "submitted",
    restaurant_eta_text: etaText,
    restaurant_eta_hours: etaHours,
    restaurant_eta_days: etaDays,
    restaurant_eta_note: etaNote,
    restaurant_eta_submitted_at: new Date().toISOString(),
    restaurant_eta_approved_at: null,
  };

  const { error: updateError } = await restaurantSupabaseAdmin
    .from("orders")
    .update({
      shipping_address: updatedShipping,
    })
    .eq("id", orderId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message || "فشل حفظ وقت التوصيل" }, { status: 500 });
  }

  await notifyAdmins(orderId, auth.profile.restaurant.name, etaText);

  return NextResponse.json({
    success: true,
    shipping_address: updatedShipping,
  });
}
