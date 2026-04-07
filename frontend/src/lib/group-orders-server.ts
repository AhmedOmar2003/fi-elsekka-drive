import { createClient, type User } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY || ""

export const groupOrdersAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null

export type GroupOrderRecord = {
  id: string
  code: string
  host_user_id: string
  status: "open" | "confirmed" | "cancelled"
  final_order_id: string | null
  created_at: string
  updated_at: string
}

export type GroupOrderParticipantRecord = {
  id: string
  group_order_id: string
  user_id: string | null
  display_name: string
  is_host: boolean
  access_key: string
  created_at: string
}

export type GroupOrderItemRecord = {
  id: string
  group_order_id: string
  participant_id: string
  product_id: string
  quantity: number
  selected_variant_json: Record<string, any> | null
  unit_price: number
  created_at: string
  updated_at: string
}

type GroupOrderProduct = {
  id: string
  name: string
  price: number
  image_url?: string | null
  discount_percentage?: number | null
  specifications?: Record<string, any> | null
}

export type GroupOrderDetailsResponse = {
  groupOrder: {
    id: string
    code: string
    status: "open" | "confirmed" | "cancelled"
    createdAt: string
    updatedAt: string
    finalOrderId: string | null
  }
  participants: Array<{
    id: string
    displayName: string
    isHost: boolean
    createdAt: string
  }>
  itemGroups: Array<{
    participantId: string
    displayName: string
    isHost: boolean
    subtotal: number
    items: Array<{
      id: string
      productId: string
      quantity: number
      unitPrice: number
      lineTotal: number
      selectedVariantJson: Record<string, any> | null
      product: GroupOrderProduct | null
    }>
  }>
  totalAmount: number
  totalItems: number
  viewer: {
    isHost: boolean
    participantId: string | null
    displayName: string | null
    canEdit: boolean
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.get("authorization")
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length)
  }

  const cookie = req.headers.get("cookie") || ""
  const match = cookie.match(/sb-[^-]+-auth-token=([^;]+)/)
  if (match) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1]))
      return parsed.access_token || null
    } catch {
      return null
    }
  }

  const alt = cookie.match(/sb-access-token=([^;]+)/)
  return alt?.[1] || null
}

export async function getOptionalRequestUser(req: Request): Promise<User | null> {
  if (!groupOrdersAdmin) return null
  const token = extractToken(req)
  if (!token) return null
  const { data, error } = await groupOrdersAdmin.auth.getUser(token)
  if (error) return null
  return data.user || null
}

export async function requireRequestUser(req: Request): Promise<User | null> {
  return getOptionalRequestUser(req)
}

export function getEffectiveProductPrice(product: {
  price?: number | null
  discount_percentage?: number | null
}) {
  const basePrice = Number(product.price || 0)
  const discount = Number(product.discount_percentage || 0)
  if (discount > 0) {
    return Math.round(basePrice * (1 - discount / 100))
  }
  return basePrice
}

export async function generateUniqueGroupOrderCode() {
  if (!groupOrdersAdmin) {
    throw new Error("Supabase service role is not configured")
  }

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")
    const { data } = await groupOrdersAdmin
      .from("group_orders")
      .select("id")
      .eq("code", code)
      .maybeSingle()

    if (!data) {
      return code
    }
  }

  throw new Error("تعذر إنشاء كود صالح للطلب الجماعي، جرّب تاني.")
}

export async function fetchGroupOrderGraphByCode(code: string) {
  if (!groupOrdersAdmin) {
    throw new Error("Supabase service role is not configured")
  }

  const normalizedCode = String(code || "").trim().toUpperCase()
  if (!normalizedCode) {
    return null
  }

  const { data: groupOrder, error: groupOrderError } = await groupOrdersAdmin
    .from("group_orders")
    .select("*")
    .eq("code", normalizedCode)
    .maybeSingle()

  if (groupOrderError) {
    throw new Error(groupOrderError.message)
  }

  if (!groupOrder) {
    return null
  }

  const [{ data: participants, error: participantsError }, { data: items, error: itemsError }] = await Promise.all([
    groupOrdersAdmin
      .from("group_order_participants")
      .select("*")
      .eq("group_order_id", groupOrder.id)
      .order("created_at", { ascending: true }),
    groupOrdersAdmin
      .from("group_order_items")
      .select("*")
      .eq("group_order_id", groupOrder.id)
      .order("created_at", { ascending: true }),
  ])

  if (participantsError) {
    throw new Error(participantsError.message)
  }

  if (itemsError) {
    throw new Error(itemsError.message)
  }

  const productIds = Array.from(new Set((items || []).map((item) => item.product_id).filter(Boolean)))
  let products: GroupOrderProduct[] = []

  if (productIds.length > 0) {
    const { data: productRows, error: productsError } = await groupOrdersAdmin
      .from("products")
      .select("id, name, price, image_url, discount_percentage, specifications")
      .in("id", productIds)

    if (productsError) {
      throw new Error(productsError.message)
    }

    products = (productRows || []) as GroupOrderProduct[]
  }

  return {
    groupOrder: groupOrder as GroupOrderRecord,
    participants: (participants || []) as GroupOrderParticipantRecord[],
    items: (items || []) as GroupOrderItemRecord[],
    products,
  }
}

export function buildGroupOrderDetailsResponse(
  graph: NonNullable<Awaited<ReturnType<typeof fetchGroupOrderGraphByCode>>>,
  options?: {
    viewerUserId?: string | null
    participantKey?: string | null
  }
): GroupOrderDetailsResponse {
  const participantMap = new Map(graph.participants.map((participant) => [participant.id, participant]))
  const productMap = new Map(graph.products.map((product) => [product.id, product]))
  const viewerUserId = options?.viewerUserId || null
  const participantKey = options?.participantKey || null
  const hostParticipant = graph.participants.find((participant) => participant.is_host) || null
  const viewerParticipant =
    graph.participants.find((participant) => participant.access_key === participantKey) ||
    (viewerUserId ? graph.participants.find((participant) => participant.user_id === viewerUserId) : null) ||
    null
  const isHost = viewerUserId === graph.groupOrder.host_user_id

  const itemGroups = graph.participants
    .map((participant) => {
      const items = graph.items
        .filter((item) => item.participant_id === participant.id)
        .map((item) => {
          const product = productMap.get(item.product_id) || null
          const lineTotal = Number(item.unit_price || 0) * Number(item.quantity || 0)
          return {
            id: item.id,
            productId: item.product_id,
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unit_price || 0),
            lineTotal,
            selectedVariantJson: item.selected_variant_json || null,
            product,
          }
        })

      return {
        participantId: participant.id,
        displayName: participant.display_name,
        isHost: participant.is_host,
        subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
        items,
      }
    })
    .filter((group) => group.items.length > 0)

  return {
    groupOrder: {
      id: graph.groupOrder.id,
      code: graph.groupOrder.code,
      status: graph.groupOrder.status,
      createdAt: graph.groupOrder.created_at,
      updatedAt: graph.groupOrder.updated_at,
      finalOrderId: graph.groupOrder.final_order_id,
    },
    participants: graph.participants.map((participant) => ({
      id: participant.id,
      displayName: participant.display_name,
      isHost: participant.is_host,
      createdAt: participant.created_at,
    })),
    itemGroups,
    totalAmount: itemGroups.reduce((sum, group) => sum + group.subtotal, 0),
    totalItems: itemGroups.reduce((sum, group) => sum + group.items.reduce((groupSum, item) => groupSum + item.quantity, 0), 0),
    viewer: {
      isHost,
      participantId: viewerParticipant?.id || hostParticipant?.id || null,
      displayName: viewerParticipant?.display_name || (isHost ? hostParticipant?.display_name || null : null),
      canEdit: graph.groupOrder.status === "open" && (Boolean(viewerParticipant) || isHost),
    },
  }
}
