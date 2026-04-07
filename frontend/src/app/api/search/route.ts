import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabasePublic = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

export async function GET(request: NextRequest) {
  if (!supabasePublic) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const query = request.nextUrl.searchParams.get('q')?.trim() || ''

  if (query.length < 2) {
    return NextResponse.json({ products: [], categories: [] })
  }

  const safeQuery = query.slice(0, 60)

  const [productsResult, categoriesResult] = await Promise.all([
    supabasePublic
      .from('products')
      .select('id, name, price, image_url, discount_percentage, specifications, categories ( name )')
      .ilike('name', `%${safeQuery}%`)
      .order('created_at', { ascending: false })
      .limit(6),
    supabasePublic
      .from('categories')
      .select('id, name')
      .ilike('name', `%${safeQuery}%`)
      .order('name')
      .limit(3),
  ])

  if (productsResult.error || categoriesResult.error) {
    return NextResponse.json(
      {
        error: productsResult.error?.message || categoriesResult.error?.message || 'Search failed',
      },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      products: productsResult.data || [],
      categories: categoriesResult.data || [],
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=120',
      },
    }
  )
}
