import { NextResponse } from "next/server"
import {
  buildGroupOrderDetailsResponse,
  fetchGroupOrderGraphByCode,
  getOptionalRequestUser,
} from "@/lib/group-orders-server"

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params
  const participantKey = new URL(request.url).searchParams.get("participantKey")

  try {
    const graph = await fetchGroupOrderGraphByCode(code)
    if (!graph) {
      return NextResponse.json({ error: "الطلب الجماعي ده مش موجود" }, { status: 404 })
    }

    const user = await getOptionalRequestUser(request)
    const payload = buildGroupOrderDetailsResponse(graph, {
      viewerUserId: user?.id || null,
      participantKey,
    })

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "تعذر تحميل الطلب الجماعي" },
      { status: 500 }
    )
  }
}
