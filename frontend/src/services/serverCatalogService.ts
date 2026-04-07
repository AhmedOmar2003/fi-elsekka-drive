import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Category } from './categoriesService'
import type { Product } from './productsService'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY

const PRODUCT_CARD_FIELDS = `
  id, name, price, image_url,
  discount_percentage, is_best_seller, show_in_offers,
  category_id, specifications, created_at, stock_quantity
`

const CATEGORY_FIELDS = 'id, name, description, parent_id, created_at, updated_at'

const isUUID = (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)

function getPublicServerSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anon key are required.')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getServerAdminSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function fetchCategoryByIdServer(categoryId: string): Promise<Category | null> {
  if (!isUUID(categoryId)) return null

  const supabase = getPublicServerSupabase()
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_FIELDS)
    .eq('id', categoryId)
    .single()

  if (error) {
    console.error('Error fetching category by id on server:', error.message)
    return null
  }

  return data as Category
}

export async function fetchProductsByCategoryServer(categoryId: string): Promise<Product[]> {
  if (!isUUID(categoryId)) return []

  const supabase = getPublicServerSupabase()
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_CARD_FIELDS)
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching server category products:', error.message)
    return []
  }

  return (data || []) as Product[]
}

export async function fetchPaginatedProductsServer(
  page = 0,
  pageSize = 20,
  categoryId?: string,
): Promise<{ products: Product[]; hasMore: boolean; total: number; totalPages: number }> {
  const from = page * pageSize
  const to = from + pageSize - 1

  const supabase = getPublicServerSupabase()
  let countQuery = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
  let query = supabase
    .from('products')
    .select(PRODUCT_CARD_FIELDS)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (categoryId && isUUID(categoryId)) {
    countQuery = countQuery.eq('category_id', categoryId)
    query = query.eq('category_id', categoryId)
  }

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    query,
    countQuery,
  ])

  if (error) {
    console.error('Error fetching server paginated products:', error.message)
    return { products: [], hasMore: false, total: 0, totalPages: 0 }
  }

  if (countError) {
    console.error('Error counting server paginated products:', countError.message)
  }

  const total = count || 0
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0

  return {
    products: (data || []) as Product[],
    hasMore: (data?.length || 0) === pageSize,
    total,
    totalPages,
  }
}

async function fetchDeliveredBestSellerRankedIds(limit?: number): Promise<string[]> {
  const supabaseAdmin = getServerAdminSupabase()
  if (!supabaseAdmin) return []

  const { data: orderItems, error: orderItemsError } = await supabaseAdmin
    .from('order_items')
    .select('product_id, quantity, orders!inner(status)')
    .eq('orders.status', 'delivered')
    .limit(10000)

  if (orderItemsError) {
    console.error('Error fetching delivered order items on server:', orderItemsError.message)
    return []
  }

  const sales = new Map<string, number>()
  for (const item of orderItems || []) {
    const productId = item.product_id
    if (!productId) continue
    sales.set(productId, (sales.get(productId) || 0) + Number(item.quantity || 1))
  }

  const rankedIds = Array.from(sales.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([productId]) => productId)

  if (typeof limit === 'number') {
    return rankedIds.slice(0, limit)
  }

  return rankedIds
}

export async function fetchBestSellersServer(limit = 4): Promise<Product[]> {
  const supabaseAdmin = getServerAdminSupabase()
  if (!supabaseAdmin) return []

  const rankedIds = await fetchDeliveredBestSellerRankedIds(limit)
  if (rankedIds.length === 0) return []

  const { data: products, error: productsError } = await supabaseAdmin
    .from('products')
    .select(PRODUCT_CARD_FIELDS)
    .in('id', rankedIds)

  if (productsError) {
    console.error('Error fetching best seller products on server:', productsError.message)
    return []
  }

  const productMap = new Map((products || []).map((product) => [product.id, product as Product]))
  return rankedIds
    .map((id) => productMap.get(id))
    .filter((product): product is Product => Boolean(product))
}

export async function fetchBestSellersPageServer(
  page = 0,
  pageSize = 12,
): Promise<{ products: Product[]; total: number; totalPages: number }> {
  const supabaseAdmin = getServerAdminSupabase()
  if (!supabaseAdmin) {
    return { products: [], total: 0, totalPages: 0 }
  }

  const rankedIds = await fetchDeliveredBestSellerRankedIds()
  const total = rankedIds.length
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0

  if (total === 0) {
    return { products: [], total: 0, totalPages: 0 }
  }

  const from = page * pageSize
  const pageIds = rankedIds.slice(from, from + pageSize)

  if (pageIds.length === 0) {
    return { products: [], total, totalPages }
  }

  const { data: products, error: productsError } = await supabaseAdmin
    .from('products')
    .select(PRODUCT_CARD_FIELDS)
    .in('id', pageIds)

  if (productsError) {
    console.error('Error fetching best seller page products on server:', productsError.message)
    return { products: [], total, totalPages }
  }

  const productMap = new Map((products || []).map((product) => [product.id, product as Product]))
  const orderedProducts = pageIds
    .map((id) => productMap.get(id))
    .filter((product): product is Product => Boolean(product))

  return {
    products: orderedProducts,
    total,
    totalPages,
  }
}
