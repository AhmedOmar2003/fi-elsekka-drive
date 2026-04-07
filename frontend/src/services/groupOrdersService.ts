import { supabase } from "@/lib/supabase"
import type { SelectedVariantJson } from "@/lib/product-variants"

export type GroupOrderView = {
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
      product: {
        id: string
        name: string
        price: number
        image_url?: string | null
        discount_percentage?: number | null
        specifications?: Record<string, any> | null
      } | null
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

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error || "حصلت مشكلة غير متوقعة")
  }
  return data as T
}

export async function createGroupOrder(
  seedItems: Array<{
    productId: string
    quantity: number
    selectedVariantJson?: SelectedVariantJson
    unitPrice?: number | null
  }> = []
) {
  const headers = await getAuthHeader()
  const response = await fetch("/api/group-orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ seedItems }),
  })

  return parseResponse<{
    code: string
    participantKey: string
    displayName: string
    shareUrl: string
  }>(response)
}

export async function fetchGroupOrder(code: string, participantKey?: string | null) {
  const headers = await getAuthHeader()
  const params = new URLSearchParams()
  if (participantKey) {
    params.set("participantKey", participantKey)
  }

  const response = await fetch(`/api/group-orders/${encodeURIComponent(code)}${params.toString() ? `?${params.toString()}` : ""}`, {
    headers,
    cache: "no-store",
  })

  return parseResponse<GroupOrderView>(response)
}

export async function joinGroupOrder(code: string, displayName: string, participantKey?: string | null) {
  const headers = await getAuthHeader()
  const response = await fetch(`/api/group-orders/${encodeURIComponent(code)}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ displayName, participantKey }),
  })

  return parseResponse<{
    participantKey: string
    displayName: string
    participantId: string
    isHost: boolean
  }>(response)
}

export async function addGroupOrderItem(
  code: string,
  participantKey: string,
  productId: string,
  quantity = 1,
  options?: {
    selectedVariantJson?: SelectedVariantJson
    unitPrice?: number | null
  }
) {
  const headers = await getAuthHeader()
  const response = await fetch(`/api/group-orders/${encodeURIComponent(code)}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      participantKey,
      productId,
      quantity,
      selectedVariantJson: options?.selectedVariantJson || null,
      unitPrice: options?.unitPrice ?? null,
    }),
  })

  return parseResponse<{ success: true }>(response)
}

export async function updateGroupOrderItem(
  code: string,
  itemId: string,
  participantKey: string,
  quantity: number,
) {
  const headers = await getAuthHeader()
  const response = await fetch(`/api/group-orders/${encodeURIComponent(code)}/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ participantKey, quantity }),
  })

  return parseResponse<{ success: true }>(response)
}

export async function finalizeGroupOrder(code: string, finalOrderId: string) {
  const headers = await getAuthHeader()
  const response = await fetch(`/api/group-orders/${encodeURIComponent(code)}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ finalOrderId }),
  })

  return parseResponse<{ success: true }>(response)
}
