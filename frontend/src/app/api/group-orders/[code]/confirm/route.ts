import { NextResponse } from "next/server"
import {
  fetchGroupOrderGraphByCode,
  requireRequestUser,
  groupOrdersAdmin,
} from "@/lib/group-orders-server"

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  if (!groupOrdersAdmin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const { code } = await context.params
  const user = await requireRequestUser(request)
  if (!user) {
    return NextResponse.json({ error: "لازم تسجل دخول صاحب الطلب أولًا" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const finalOrderId = String(body?.finalOrderId || "").trim()
  if (!finalOrderId) {
    return NextResponse.json({ error: "رقم الطلب النهائي مطلوب" }, { status: 400 })
  }

  const graph = await fetchGroupOrderGraphByCode(code)
  if (!graph) {
    return NextResponse.json({ error: "الطلب الجماعي ده مش موجود" }, { status: 404 })
  }

  if (graph.groupOrder.host_user_id !== user.id) {
    return NextResponse.json({ error: "فقط صاحب الطلب يقدر يؤكد الطلب الجماعي" }, { status: 403 })
  }

  if (graph.groupOrder.status !== "open") {
    return NextResponse.json({ error: "الطلب الجماعي ده متأكد بالفعل" }, { status: 400 })
  }

  const { error } = await groupOrdersAdmin
    .from("group_orders")
    .update({
      status: "confirmed",
      final_order_id: finalOrderId,
    })
    .eq("id", graph.groupOrder.id)

  if (error) {
    return NextResponse.json({ error: error.message || "فشل تأكيد الطلب الجماعي" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
