import { NextResponse } from "next/server"
import {
  fetchGroupOrderGraphByCode,
  getOptionalRequestUser,
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
  const body = await request.json().catch(() => ({}))
  const participantKey = String(body?.participantKey || "").trim()
  const displayName = String(body?.displayName || "").trim()

  if (!displayName && !participantKey) {
    return NextResponse.json({ error: "اكتب اسمك الأول علشان تدخل الطلب الجماعي" }, { status: 400 })
  }

  const graph = await fetchGroupOrderGraphByCode(code)
  if (!graph) {
    return NextResponse.json({ error: "الطلب الجماعي ده مش موجود" }, { status: 404 })
  }

  if (graph.groupOrder.status !== "open") {
    return NextResponse.json({ error: "الطلب الجماعي ده اتأكد بالفعل ومبقاش متاح للتعديل" }, { status: 400 })
  }

  const user = await getOptionalRequestUser(request)

  if (participantKey) {
    const existingByKey = graph.participants.find((participant) => participant.access_key === participantKey)
    if (existingByKey) {
      return NextResponse.json({
        participantKey: existingByKey.access_key,
        displayName: existingByKey.display_name,
        participantId: existingByKey.id,
        isHost: existingByKey.is_host,
      })
    }
  }

  if (user?.id === graph.groupOrder.host_user_id) {
    const hostParticipant = graph.participants.find((participant) => participant.is_host)
    if (hostParticipant) {
      return NextResponse.json({
        participantKey: hostParticipant.access_key,
        displayName: hostParticipant.display_name,
        participantId: hostParticipant.id,
        isHost: true,
      })
    }
  }

  if (user?.id) {
    const existingByUser = graph.participants.find((participant) => participant.user_id === user.id)
    if (existingByUser) {
      return NextResponse.json({
        participantKey: existingByUser.access_key,
        displayName: existingByUser.display_name,
        participantId: existingByUser.id,
        isHost: existingByUser.is_host,
      })
    }
  }

  if (!displayName) {
    return NextResponse.json({ error: "اكتب اسمك علشان نميز إضافاتك في الطلب" }, { status: 400 })
  }

  const newParticipantKey = crypto.randomUUID()
  const { data: participant, error } = await groupOrdersAdmin
    .from("group_order_participants")
    .insert({
      group_order_id: graph.groupOrder.id,
      user_id: user?.id || null,
      display_name: displayName,
      is_host: false,
      access_key: newParticipantKey,
    })
    .select("id, display_name, access_key, is_host")
    .single()

  if (error || !participant) {
    return NextResponse.json({ error: error?.message || "فشل دخولك للطلب الجماعي" }, { status: 500 })
  }

  return NextResponse.json({
    participantKey: participant.access_key,
    displayName: participant.display_name,
    participantId: participant.id,
    isHost: participant.is_host,
  })
}
