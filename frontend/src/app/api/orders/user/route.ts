import { NextResponse } from "next/server"
import { requireRequestUser, groupOrdersAdmin } from "@/lib/group-orders-server"

export async function GET(request: Request) {
  const user = await requireRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!groupOrdersAdmin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const orderSelect = `
    *,
    order_items (
      id,
      product_id,
      quantity,
      price_at_purchase,
      selected_variant_json,
      product:products (name, price)
    )
  `

  const { data: ownOrders, error: ownOrdersError } = await groupOrdersAdmin
    .from("orders")
    .select(orderSelect)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (ownOrdersError) {
    return NextResponse.json({ error: ownOrdersError.message || "فشل تحميل طلباتك" }, { status: 500 })
  }

  const { data: participantRows, error: participantError } = await groupOrdersAdmin
    .from("group_order_participants")
    .select("group_order_id")
    .eq("user_id", user.id)

  if (participantError) {
    return NextResponse.json({ error: participantError.message || "فشل تحميل الطلبات الجماعية" }, { status: 500 })
  }

  const groupOrderIds = Array.from(new Set((participantRows || []).map((row) => row.group_order_id).filter(Boolean)))
  let sharedOrders: any[] = []

  if (groupOrderIds.length > 0) {
    const { data: groupOrders, error: groupOrdersError } = await groupOrdersAdmin
      .from("group_orders")
      .select("id, final_order_id")
      .in("id", groupOrderIds)
      .eq("status", "confirmed")
      .not("final_order_id", "is", null)

    if (groupOrdersError) {
      return NextResponse.json({ error: groupOrdersError.message || "فشل قراءة الطلبات الجماعية المؤكدة" }, { status: 500 })
    }

    const finalOrderIds = Array.from(
      new Set(
        (groupOrders || [])
          .map((groupOrder) => groupOrder.final_order_id)
          .filter(Boolean)
      )
    )

    if (finalOrderIds.length > 0) {
      const { data: sharedOrderRows, error: sharedOrdersError } = await groupOrdersAdmin
        .from("orders")
        .select(orderSelect)
        .in("id", finalOrderIds)
        .order("created_at", { ascending: false })

      if (sharedOrdersError) {
        return NextResponse.json({ error: sharedOrdersError.message || "فشل تحميل الطلبات المشتركة" }, { status: 500 })
      }

      sharedOrders = sharedOrderRows || []
    }
  }

  const mergedOrders = [...(ownOrders || []), ...sharedOrders]
  const uniqueOrders = Array.from(
    new Map(mergedOrders.map((order) => [order.id, order])).values()
  ).sort((left: any, right: any) => {
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })

  return NextResponse.json({ data: uniqueOrders })
}
