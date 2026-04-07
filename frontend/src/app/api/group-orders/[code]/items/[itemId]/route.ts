import { NextResponse } from "next/server"
import {
  fetchGroupOrderGraphByCode,
  getOptionalRequestUser,
  groupOrdersAdmin,
} from "@/lib/group-orders-server"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ code: string; itemId: string }> }
) {
  if (!groupOrdersAdmin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const { code, itemId } = await context.params
  const body = await request.json().catch(() => ({}))
  const participantKey = String(body?.participantKey || "").trim()
  const quantity = Number(body?.quantity || 0)

  if (!participantKey || !itemId) {
    return NextResponse.json({ error: "بيانات التعديل ناقصة" }, { status: 400 })
  }

  const graph = await fetchGroupOrderGraphByCode(code)
  if (!graph) {
    return NextResponse.json({ error: "الطلب الجماعي ده مش موجود" }, { status: 404 })
  }

  if (graph.groupOrder.status !== "open") {
    return NextResponse.json({ error: "الطلب الجماعي اتأكد بالفعل ومبقاش يقبل تعديل" }, { status: 400 })
  }

  const user = await getOptionalRequestUser(request)
  const viewerParticipant =
    graph.participants.find((participant) => participant.access_key === participantKey) ||
    (user?.id === graph.groupOrder.host_user_id
      ? graph.participants.find((participant) => participant.is_host)
      : null)

  if (!viewerParticipant) {
    return NextResponse.json({ error: "اكتب اسمك الأول في الطلب الجماعي قبل التعديل" }, { status: 401 })
  }

  const item = graph.items.find((entry) => entry.id === itemId)
  if (!item) {
    return NextResponse.json({ error: "العنصر ده مش موجود" }, { status: 404 })
  }

  const canManage = user?.id === graph.groupOrder.host_user_id || item.participant_id === viewerParticipant.id
  if (!canManage) {
    return NextResponse.json({ error: "تقدر تعدل فقط إضافاتك أنت" }, { status: 403 })
  }

  if (quantity <= 0) {
    const { error } = await groupOrdersAdmin
      .from("group_order_items")
      .delete()
      .eq("id", itemId)

    if (error) {
      return NextResponse.json({ error: error.message || "فشل حذف المنتج" }, { status: 500 })
    }
  } else {
    const { error } = await groupOrdersAdmin
      .from("group_order_items")
      .update({ quantity })
      .eq("id", itemId)

    if (error) {
      return NextResponse.json({ error: error.message || "فشل تحديث الكمية" }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
