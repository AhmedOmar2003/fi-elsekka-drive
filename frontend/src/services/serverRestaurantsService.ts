import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Product } from './productsService'
import type { Restaurant } from './restaurantsService'
import { getProductCatalogMetadata, normalizeStringArray } from '@/lib/product-metadata'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getPublicServerSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anon key are required.')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function normalizeRestaurantRecord(restaurant: Restaurant | null) {
  if (!restaurant) return null
  return {
    ...restaurant,
    menu_sections: normalizeStringArray(restaurant.menu_sections),
  } as Restaurant
}

export async function fetchRestaurantsServer(categoryId?: string | null): Promise<Restaurant[]> {
  const supabase = getPublicServerSupabase()
  let query = supabase
    .from('restaurants')
    .select('*, categories(name)')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  const { data, error } = await query
  if (error) {
    console.error('fetchRestaurantsServer error:', error.message)
    return []
  }

  return ((data || []) as Restaurant[]).map((item) => normalizeRestaurantRecord(item)!)
}

export async function fetchRestaurantByIdServer(id: string): Promise<Restaurant | null> {
  const supabase = getPublicServerSupabase()
  const { data, error } = await supabase
    .from('restaurants')
    .select('*, categories(name)')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('fetchRestaurantByIdServer error:', error.message)
    return null
  }

  return normalizeRestaurantRecord(data as Restaurant)
}

export async function fetchRestaurantMenuServer(restaurantId: string, foodCategoryId?: string | null): Promise<Product[]> {
  const supabase = getPublicServerSupabase()
  const baseSelect = `
      id, name, description, price, category_id, specifications, created_at, updated_at,
      image_url, discount_percentage, stock_quantity, is_best_seller, show_in_offers,
      categories ( name ),
      product_specifications ( id, label, description )
    `

  let query = supabase
    .from('products')
    .select(baseSelect)
    .contains('specifications', { restaurant_id: restaurantId, restaurant_item: true })
    .order('created_at', { ascending: false })
    .limit(120)

  if (foodCategoryId) {
    query = query.eq('category_id', foodCategoryId)
  }

  let result = await query
  if (result.error) {
    let fallbackQuery = supabase
      .from('products')
      .select(baseSelect)
      .order('created_at', { ascending: false })
      .limit(120)

    if (foodCategoryId) {
      fallbackQuery = fallbackQuery.eq('category_id', foodCategoryId)
    }

    result = await fallbackQuery
  }

  const { data, error } = result
  if (error) {
    console.error('fetchRestaurantMenuServer error:', error.message)
    return []
  }

  return (data || [])
    .map((item) => item as unknown as Product)
    .filter((product) => {
      const metadata = getProductCatalogMetadata(product.specifications)
      return metadata.restaurantId === restaurantId && metadata.restaurantItem
    })
}
